# ADR-008：临时密钥弱前向保密（Ephemeral-Key Weak Forward Secrecy）

- 状态：Accepted
- 日期：2026-10-26
- 相关：`src/security/e2ee.ts`（`deriveSessionBaseKey` / `getSessionSharedKey`）、`src/security/e2eeManager.ts`（`ensureEphemeral` / `getEphemeralPublicKey` / `removePeerKey` 丢弃）、`src/core/message.ts`（载荷 `eph`）、`src/communication/peer.ts`（`e2ee_key` 握手携带 `eph`）、[THREAT_MODEL.md](../THREAT_MODEL.md) §5.1/§6/§7

## 背景

原设计只用「长期静态 X25519 私钥 × 长期静态对端公钥」做一次 ECDH，派生出**会话根密钥**（static root）。这套根密钥被无限期缓存（`sharedKeys`），且完全由静态私钥决定：

- 一旦长期静态私钥泄露（设备被取证、密钥文件被拖出、XSS 调用已加载的 CryptoKey 之外的任何残留导出途径），**攻击者即可解密所有历史密文**——无论是已发生的还是未来继续发生的会话。
- 这与「端到端加密」给用户的安全直觉严重不符：用户以为「删了聊天记录就安全了」，但攻击者只要持有私钥就能还原一切。

威胁模型（§5.1）已诚实标注该残余风险。本 ADR 在不破坏既有 TOFU / 安全码认证、不破坏跨版本兼容的前提下，引入**一次性临时密钥**，把边界往前推一截。

## 决策

保留静态-静态 ECDH（用于 TOFU 锚定与带外安全码一致性校验，**不能去掉**），并额外叠加**每会话一次性临时 X25519 密钥**，把会话根密钥改为：

```
session_base = HKDF(
  ikm  = static-static  ECDH raw bits,   // 维持 TOFU / 安全码锚点
  salt = ephemeral-ephemeral ECDH raw bits,  // 一次性熵源
  info = 'nymir-session-base-v1'
)
```

**握手与生命周期**
1. 双方各自在内存中懒生成一对临时 X25519 密钥（`ensureEphemeral`），**不持久化**、不入库、不入 IndexedDB。
2. 临时公钥随 `e2ee_key` 握手消息（以及后续消息载荷的 `eph` 字段）发给对端；对端暂存为 `peerEphemeralPublicKeys`。
3. 加密走 `getSessionSharedKey`（combined root）；`e2eeManager.decrypt` 为**故障安全**：先尝试 combined root，抛错则回退 static root（覆盖「握手尚未交换临时公钥」的首个往返窗口，以及与旧客户端互通的兼容窗口）。
4. 会话结束 / `removePeerKey` / `clearAll` 时，临时私钥与对端临时公钥**从内存删除**，垃圾回收后不可恢复。

**因此**：长期静态私钥泄露后，凡是在双方都已启用临时密钥的会话中产生的历史密文，**攻击者无法解密**——他缺少已被丢弃的临时私钥。这把「私钥泄露 = 全量明文」降级为「私钥泄露 = 仅首往返 + 旧客户端窗口可能被解密」。

## 后果

- **收益**
  - 历史密文对静态私钥泄露具有实际抗性（弱前向保密），显著收窄最危险的残余风险。
  - 完全向后兼容：与未升级的旧客户端互通自动回退到纯静态根，不破坏现有用户。
  - 不改动认证模型：TOFU 钉住与安全码校验仍由静态密钥承担，临时密钥只贡献熵。
  - 改动局部、可测试：`src/__tests__/e2ee.test.ts` 固化「仅持静态私钥无法解密临时密文」等不变量。
- **代价与边界（必须如实声明）**
  - **不是强前向保密**：未引入每消息 ratchet（Double Ratchet），同一会话内的根密钥在双方都存活期间仍被缓存；泄露发生时若双方都还在线且缓存未清，该会话仍可能解密。
  - **首往返窗口**：握手完成前、临时公钥尚未交换的消息在静态根下产生，静态私钥泄露可解密这一小窗口。
  - **旧客户端互通**：与未升级客户端会话时回退静态根，无前向保密。
  - 临时私钥仅在内存，浏览器崩溃/刷新后该会话前向保密边界自然成立（缓存随进程消失），但也意味着同一标签页内持续会话的缓存期等于进程存活期。

## 替代方案

- **完整 Double Ratchet（Signal 式）**：每消息 ratchet + DH ratchet，提供强前向保密与后向保密。代价是协议重写、需维护 ratchet 状态持久化与重放防重排、与现有静态根/TOFU 模型耦合大、跨版本迁移复杂。当前威胁模型已明确「不承诺对抗国家级长期分析」，投入产出比不划算，留待后续大版本。
- **纯临时根（去掉静态根）**：能更强，但会**破坏 TOFU 锚定与带外安全码一致性**——安全码将每次握手都变，失去「核对一次、长期信任」的意义。不可接受。
- **不做任何改动**：维持「静态私钥泄露即全量明文」，与威胁模型的诚实声明冲突，且是用户最关心的风险点。本 ADR 的弱方案是风险/复杂度/兼容三者间最务实的折中。

## 相关

[ADR-005](./0005-safety-code.md)、[ADR-006](./0006-tofu-pin.md)、[ADR-007](./0007-verifiable-key-rotation.md)、[THREAT_MODEL.md](../THREAT_MODEL.md) §5.1/§6/§7。
