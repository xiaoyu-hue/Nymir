<div align="center">

<img src="https://img.shields.io/badge/version-1.0.0-7c6aef?style=for-the-badge" alt="version">
<img src="https://img.shields.io/badge/license-AGPL--3.0-22c55e?style=for-the-badge" alt="license">

**[English](./README.en.md) · 中文**

# ✦ Nymir · 树洞

> ⚠️ **重要提示**：本项目由 AI 辅助开发，作者为零编程基础的个人开发者。代码尚未经过专业安全审计，**不建议用于真实敏感场景**（如高风险通信、重要数据存储等）。如需用于此类场景，请先自行进行专业安全评估。

**P2P 匿名聊天 · 阅读即焚 · 本地优先**

> *你的数据存于你自己的设备。隐私优先，本地存储。*

<br>

**[🔗 在线体验](https://nymir.xyyovo520.workers.dev/) · [GitHub Pages](https://xiaoyu-hue.github.io/Nymir/)**

[![React](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=white&style=flat-square)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript_6-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite_8-646CFF?logo=vite&logoColor=white&style=flat-square)](https://vite.dev)
[![Trystero](https://img.shields.io/badge/Trystero-P2P-FF6B35?style=flat-square)](https://github.com/dmotz/trystero)
[![WebRTC](https://img.shields.io/badge/WebRTC-加密通信-0F9D58&style=flat-square)](https://webrtc.org)

</div>

---

## ✦ 什么是 Nymir？

在数据被广泛收集和分析的时代，**隐私**正变得越来越珍贵。

Nymir 是一款**基于 P2P 的匿名即时通讯工具**。消息通过 **WebRTC 端到端加密**直接在用户设备之间传输，数据存储在你自己的浏览器中。无云端服务器，无账号体系，无需注册。

消息可以设置为**阅读即焚** — 被查看后可选择自动销毁，减少留存。

### ⚠️ 关于「去中心化」的准确说明

Nymir **不是完全去中心化**的。数据存储与消息传输是本地/P2P；Peer 发现依赖公共 MQTT / WebTorrent 信令。

更准确的定位是：**无业务服务器 + 本地优先 + P2P 通信**。

### 一条消息的旅程

发送时：明文 → AES-256-GCM 加密 → Ed25519 签名 → 通过 P2P 通道发出。
接收时：验签 → 解密 → 字段加密后写入本地 IndexedDB。
加密和签名都在你的浏览器里完成，中间节点（包括公共信令）只能看到密文和签名，看不到明文。

---

## ✦ 安全与隐私

### 安全特性

- ✅ **会话消息端到端加密** — X25519 密钥协商 + AES-256-GCM（建连/信令阶段除外，见已知局限）
- ✅ **每消息密钥** — HKDF 按消息派生，不同消息密钥不同
- ✅ **密文签名（encrypt-then-sign）** — Ed25519 签密文，验签失败不展示
- ✅ **签名失败可见** — 气泡明确标示，不静默展示
- ✅ **带外安全码核对** — 聊天页右上角盾牌显示双方共同的 15 位数字 + 7 emoji，可通过另一条渠道核对以识别中间人；核对后钉住，公钥再变自动红色警告
- ✅ **P2P 直连** — 会话消息不经业务云端存储
- ✅ **本地存储加密** — IndexedDB 字段级加密（AES-256-GCM，PBKDF2 60 万次迭代派生密钥，v4 per-install 随机盐）
- ✅ **持久化身份** — 刷新页面后加密身份不变，TOFU/安全码核对长期有效（v4 起）
- ✅ **阅后即焚** — 可配置
- ✅ **加密备份（V3）** — AES-256-GCM，备份文件自带随机盐，换设备可恢复

### 安全注意事项

- **首次见面信任（TOFU）**：第一次交换公钥时，中间人抢先注入假公钥，协议无法单凭自身识破。**请主动点盾牌核对安全码**——核对是用户可选行为，不核对则等同于裸奔
- **密码至少 10 位**：锁屏密码用于派生加密密钥，太短会被离线暴力破解
- 阅后即焚无法防止对方截图或复制
- **忘记锁屏密码**可能永久无法打开本地加密数据（备份文件也需同一密码恢复）

### 已知局限

- **Peer 发现依赖公共信令** — 信令侧可能观察连接元数据
- **信令/建连阶段不是端到端加密通道**
- **无服务端离线收件箱**
- **自动密钥轮换当前关闭** — 仍有每消息 HKDF；可验证换钥在路线图
- **假名与设备绑定有限**
- **双端实时依赖浏览器与 NAT**
- **流量混淆强度有限** — 约每 30 秒、固定约 48 字节噪声；等间隔等长填充在流量分析中可能可识别，**不能**对抗认真分析
- **ping/pong 监控消息不加密** — 连接质量心跳每 5 秒明文走 P2P 通道（仅时间戳），不泄露内容但泄露在线元数据

### 不适合什么场景

诚实说，Nymir 不是万能的隐私工具，以下场景请谨慎使用或选择更专业的方案：

- **高风险通信**（记者、活动人士、举报人等面临国家级对手的场景）——流量混淆有限、TOFU 有弱点、无离线收件箱，不适合对抗认真的流量分析
- **需要长期留存重要记录**——阅后即焚会主动销毁消息；本地存储加密后若忘记锁屏密码，数据**永久无法恢复**
- **多设备实时同步**——当前无实时多设备同步，消息只存在当前浏览器。可用备份导出/导入在设备间迁移（需同一锁屏密码）
- **公共或共享设备**——本地数据存在浏览器 profile 里，他人用同一浏览器可访问（除非设置了锁屏密码）

---

## ✦ 路线图

### 已完成 ✅

- [x] P2P 实时通信、阅后即焚、本地存储与加密备份
- [x] E2EE、密文签名、每消息 HKDF、验签失败 UI 提示
- [x] 持久化身份密钥（刷新不变，TOFU 长期有效）+ v4 per-install 随机盐
- [x] 跨设备备份恢复（V3 备份文件自带盐）
- [x] localStorage 敏感键删除（仅 `removeItem`，无覆写；浏览器不保证物理擦除）
- [x] CI 测试门禁（typecheck + lint + test）

### 计划中 🚀

- [ ] 可验证密钥轮换与 TOFU 重固定
- [ ] 消息搜索、语音、多设备同步
- [ ] 降低对公共信令的依赖

---

## ✦ 快速开始

```bash
git clone https://github.com/xiaoyu-hue/Nymir.git
cd Nymir && npm install && npm run dev
```

---

## ✦ 开源协议

[AGPL-3.0](./LICENSE)

## ✦ 致谢与依赖

Nymir 站在这些开源项目的肩膀上。没有它们，一个零编程基础的作者不可能做出这个项目。

### 运行时依赖

| 项目 | 协议 | 说明 |
|------|------|------|
| [React](https://react.dev) | MIT | UI 框架 |
| [React DOM](https://react.dev) | MIT | DOM 渲染 |
| [@trystero-p2p/mqtt](https://www.npmjs.com/package/@trystero-p2p/mqtt) | MIT | P2P 信令（MQTT 通道） |
| [@trystero-p2p/torrent](https://www.npmjs.com/package/@trystero-p2p/torrent) | MIT | P2P 信令（WebTorrent 通道） |
| [idb](https://github.com/jakearchibald/idb) | ISC | IndexedDB 封装 |

### 开发与工具链

| 项目 | 协议 | 说明 |
|------|------|------|
| [TypeScript](https://www.typescriptlang.org) | Apache-2.0 | 类型系统 |
| [Vite](https://vite.dev) | MIT | 构建工具 |
| [Vitest](https://vitest.dev) | MIT | 测试框架（264 个测试） |
| [Oxlint](https://oxc.rs) | MIT | 代码检查（CI 门禁） |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app) | MIT | PWA 支持（可安装、离线可用） |
| [jsdom](https://github.com/jsdom/jsdom) | MIT | DOM 测试环境 |
| [@testing-library/react](https://testing-library.com) | MIT | React 组件测试 |

### 特别致谢

- **WebCrypto API**（W3C 标准，浏览器内置）—— X25519 密钥协商、AES-256-GCM 加解密、HKDF 密钥派生、Ed25519 签名全部基于此。Nymir 不实现任何密码学原语，只调用浏览器经过审计的内置实现。
- **所有为开源社区贡献代码、文档和时间的人。**

### 安全码设计灵感

"安全码核对"这一功能并非凭空设计，而是借鉴了主流端到端加密通讯工具的成熟思路：

- **Signal 的 Safety Number / WhatsApp 的 Security Code**——把双方身份公钥派生为人类可比对的短码，再通过带外渠道核对。这一基本思路被直接沿用。
- **Matrix / Element 的 SAS（Short Authentication String）**——"15 位十进制数字分 3 组显示"的形式，参考自 Matrix 的 decimal 验证方式。
- **Telegram 通话的 emoji 密钥、Matrix 的 7-emoji 验证**——为 emoji 视觉辅助提供了灵感。

我们也吸收了它们的教训：Matrix 社区已在 [MSC4405](https://github.com/matrix-org/matrix-spec-proposals/pull/4405) 中提议弃用 emoji 验证（不同操作系统渲染不一致），因此 Nymir 把 **15 位数字作为唯一主验证手段**，emoji 仅作扫一眼的视觉辅助。我们未直接复用上述项目的代码或 emoji 表，派生公式与 64 个 emoji 均为独立实现。

## ✦ 贡献

请阅读 [贡献者行为准则](./CODE_OF_CONDUCT.md)。协作约束见 [AGENTS.md](./AGENTS.md)。

关于作者，见 [AUTHOR.md](./docs/AUTHOR.md)；全部项目文档见 [docs/](./docs/README.md)。

---

*Nymir — 让秘密只属于你*
