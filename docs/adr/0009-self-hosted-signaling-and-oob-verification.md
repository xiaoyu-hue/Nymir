# ADR-009：自托管信令与带外身份核对

- 状态：Accepted
- 日期：2026-10-26
- 相关：`src/config/signaling.ts`、`src/security/outOfBand.ts`、`src/communication/peer.ts`、`src/ui/components/SignalingSettings.tsx`、`src/ui/components/OutOfBandVerify.tsx`、[THREAT_MODEL.md](../THREAT_MODEL.md) §5.3 / §7 / §8

## 背景

ADR-003 明确了"消息内容不经信令，但连接关系与房间存在性会被公共信令观察"这一取舍。阶段 2 之前，这个取舍是**硬编码且不可变更的**：

1. 三套策略（MQTT / Nostr / WebTorrent）的 relay 地址写死在 `peer.ts`，用户无法换成自建节点；
2. `index.html` 的 CSP `connect-src` 只白名单了那几个固定域名，即使代码可配也连不出去；
3. 带外核对只有"在线后看安全码"一条路——双方必须先经公共信令建连，才谈得上核对，无法在建立任何网络连接前完成身份比对。

这三个问题叠加的后果是：想彻底摆脱公共信令的用户，只能自己改源码重新构建。

## 决策

### 1. 信令配置外置（`src/config/signaling.ts`）

- 三套策略各自的 `{ urls, redundancy }` 与 `defaultStrategy` 收拢进 `SignalingConfig`，默认值即原先硬编码的那组公共节点。
- `loadSignalingConfig()` 从 `localStorage['nymir:signaling-config']` 读取，逐字段校验后与默认值合并：
  - 非 `wss://` 的 URL 一律丢弃（防误配成明文 `ws://` 泄流量）；
  - `redundancy` 夹在 `[1, urls.length]`，避免 0 条连接或超出可用节点数的无效值；
  - 任一策略被清空到 0 个 URL 时回退到该策略的默认列表，防止用户手滑把自己锁在门外。
- `saveSignalingConfig()` 写入前同样走一遍 sanitize，返回实际生效的配置（UI 用它回显，保证"看到的即生效的"）。
- `peer.ts` 的 `joinWithStrategy()` 改为在调用时读取配置，**不缓存**——设置页保存后，下次加入房间立即生效，无需刷新。

### 2. CSP 同步放宽

`connect-src` 增加 `wss:` 与 `https:` 通配。这是有意识的权衡：

- **收益**：自托管节点无需改源码、无需重新构建，用户填地址即可用。
- **代价**：CSP 作为"最后一道 XSS 数据外传闸门"的作用被显著削弱——注入脚本可以把数据发往任意 wss 目标。但需注意，XSS 一旦成立，本就能读取已解密的明文与 IndexedDB，`connect-src` 白名单只能提高外传成本、不能阻止泄露；而可配置信令是这个项目的核心诉求。
- **补偿**：`script-src` 保持 `'self'` 不含 `unsafe-inline`/`unsafe-eval`，`object-src 'none'`，`base-uri 'self'` 不变。

### 3. 带外身份核对（`src/security/outOfBand.ts` + `OutOfBandVerify.tsx`）

- 身份串格式：`nymir1:<base64url(JSON{enc,sign})>`，仅含两个公钥，**不含任何私钥、房间号或 peerId**。可安全地经二维码、纸条、气隙渠道传递。
- `parseIdentity()` 做前缀、base64url、JSON 结构三重校验，任何一步失败返回 `null`（不抛异常，避免 UI 崩溃）。
- `computeFingerprintOutOfBand()` 复用既有 `buildFingerprint()`，保证带外算出的 15 位数字 + 7 emoji 与聊天内安全码**完全同源**——两条通道互相印证，而不是各算一套。
- UI 分两页：「我的身份」（展示身份串 + 二维码 + 一键复制）与「核对对方」（粘贴对方串 → 立刻算出安全码，无需对方在线、无需加入房间）。
- 核对结果**只作展示**。本阶段不写入 TOFU 的 verified 状态：把"我看过一眼"变成持久化的"已验证"，需要与 ADR-006 的 pin 语义、ADR-007 的轮换迁移一起重新设计状态机，属独立议题。当前实现的价值是**降低核对的时机门槛**——可以先核对再建连，而不是建连后才想起核对。

### 4. Nostr 隐私（部分缓解，不假装解决）

- 可在设置页把 Nostr relay 换成自建实例，从而消除"公共 relay 看到协调元数据"的问题。这是**部署层面**的缓解，不是协议层面。
- Trystero 的 Nostr 协调消息是明文发到 relay 的（appId + 房间名），**端到端加密的 rendezvous 需要 fork 改造协调协议**，本阶段不做。

## 后果

- **收益**：从"必须信任作者选的公共节点"变成"用户可以选择信任谁"；带外核对不再依赖建连成功；Nostr 用户有了实质的隐私选项。
- **代价**：CSP 收紧程度下降（见上）；配置错误（如自建 relay 不可达）会让用户以为"软件坏了"，UI 已用回退默认值 + 保存后回显降低该风险，但无法完全消除；多了一套需要维护的配置读写与校验逻辑。
- **明确不做**：加密 rendezvous（需 fork Trystero）；带外核对结果持久化为 verified（需重设计状态机）；信令节点的连通性预检/测速 UI（当前只做 URL 格式校验，不验证可达性）。

## 替代方案

- **构建时环境变量**：`VITE_RELAY_URLS` 注入。被否——要求用户自建并重新构建，对非技术用户不可用，正是本 ADR 要解决的问题。
- **仅文档说明如何 fork 改地址**：被否，成本等同"自己改源码"，且 CSP 仍是阻碍。
- **完全移除公共信令，强制自托管**：被否——开箱即用是产品前提，强制自托管会让绝大多数用户无法使用。

## 验证

- `src/__tests__/signaling.test.ts`：默认值、读写往返、非法 URL 丢弃、redundancy 夹取、空列表回退、重置。
- `src/__tests__/outOfBand.test.ts`：序列化往返、前缀/编码/结构校验失败、指纹与 `buildFingerprint` 一致。
- `src/__tests__/SignalingSettings.test.tsx`：保存写入 localStorage、重置清除。
- `src/__tests__/OutOfBandVerify.test.tsx`：身份串渲染、粘贴后算出安全码。
