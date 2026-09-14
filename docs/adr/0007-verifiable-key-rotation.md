# ADR-007：可验证密钥轮换（签名衔接协议）

- 状态：Accepted
- 日期：2026-09-14
- 相关：`src/security/e2eeManager.ts`（rotateKeysVerifiable / handleKeyRotation）、`src/core/message.ts`（key-rotation 通道）、[THREAT_MODEL.md](../THREAT_MODEL.md) §8

## 背景

早期版本曾实现"每 100 条消息自动 rotateKeys()"，但有两个致命缺陷：

1. **无对端通知**：`onKeyRotation` 从未被通信层注册，轮换后对端仍持旧公钥，从约第 100 条消息起全部解密失败。
2. **无签名衔接**：TOFU 按公钥哈希固定且无"旧身份签名新公钥"的证明，即使补上通知，对端也无法区分"合法轮换"与"中间人注入假新钥"，只能一律拒绝。

因此自动轮换被关闭（方案 C），`rotateKeys` 降级为显式 API 并在生产路径禁用。

## 决策

实现**可验证密钥轮换**（签名衔接协议）：

**发起端 `rotateKeysVerifiable()`**
1. 生成新加密密钥对 + 新签名密钥对；
2. 用**旧签名私钥**对「新公钥材料」（`{v, oldSignPub, newEncPub, newSignPub, rotatedAt}`）签名，形成 `KeyRotationNotice`；
3. 应用并持久化新身份（刷新后仍为新钥——原 rotateKeys 不持久化，属缺陷）；
4. 经 `onKeyRotation` 回调由通信层通过独立 `key-rotation` 通道广播给所有 peer。

**对端 `handleKeyRotation()`**
- 无已固定的旧签名公钥 → `no-peer-key`（首次交换请走 `handlePeerPublicKey`）；
- 证明格式非法 / `oldSignPub` 与本端固定旧钥不符 / 验签失败 → `rejected`，**不更新任何状态**；
- 新加密公钥与当前一致（重复广播/重放）→ `ignored`（置于验签前，幂等且无状态变更）；
- 验签通过 → 更新对端公钥 + TOFU re-pin（新公钥哈希钉住）+ **已验证记录迁移**（保留旧指纹 → `getVerificationState` 自然返回 `'changed'`，UI 提示重新核对，不静默通过）→ `accepted`。

## 后果

- **收益**：换钥有了密码学身份证明——中间人无法伪造（拿不到旧私钥）；对端在"安全换钥"与"未授权变更"之间有了可判定的边界；TOFU/verified 状态可跨轮换延续。
- **代价**：轮换需双方在线完成广播（离线对端需等重连后补发，当前无重放队列）；`oldSignPub` 严格匹配上一代——对端连续轮换多次时按顺序逐代验证，乱序到达会被拒（可接受，轮换是低频显式操作）。
- **明确不做**：自动轮换策略（多少条/多久自动换）——协议稳定后再定；密钥轮换 UI 入口——待后续版本。

## 替代方案

- 自动轮换 + 仅通知（旧方案）：已被证伪，长对话解密失败。
- 无签名衔接的 re-pin：无法区分合法轮换与 MITM 注入，违背 TOFU 语义。
- 用新钥签旧钥（反向衔接）：无法证明"新钥持有者认识旧身份"（攻击者可用自己的新钥签名任意旧钥信息），必须是**旧钥签新钥**。

## 相关

[ADR-005](./0005-safety-code.md)、[ADR-006](./0006-tofu-pin.md)、[THREAT_MODEL.md](../THREAT_MODEL.md) §4.2/§8、README「已知局限」「路线图」。
