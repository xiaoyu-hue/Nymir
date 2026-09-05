<div align="center">

<img src="https://img.shields.io/badge/version-1.0.0-7c6aef?style=for-the-badge" alt="version">
<img src="https://img.shields.io/badge/license-AGPL--3.0-22c55e?style=for-the-badge" alt="license">

**[English](./README.en.md) · 中文**

# ✦ Nymir · 树洞

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

---

## ✦ 安全与隐私

### 安全特性

- ✅ **端到端加密** — X25519 + AES-256-GCM
- ✅ **每消息密钥** — HKDF 按消息派生
- ✅ **密文签名（encrypt-then-sign）** — Ed25519 签密文
- ✅ **签名失败可见** — 气泡明确标示，不静默展示
- ✅ **P2P 直连** — 会话消息不经业务云端存储
- ✅ **本地存储** — IndexedDB
- ✅ **阅后即焚** — 可配置
- ✅ **加密备份** — AES-256-GCM

### 安全注意事项

- **首次见面信任（TOFU）**：第一次交换公钥时，中间人抢先注入假公钥，协议无法单凭自身识破
- 阅后即焚无法防止对方截图或复制
- **忘记锁屏密码**可能永久无法打开本地加密数据

### 已知局限

- **Peer 发现依赖公共信令** — 信令侧可能观察连接元数据
- **信令/建连阶段不是端到端加密通道**
- **无服务端离线收件箱**
- **自动密钥轮换当前关闭** — 仍有每消息 HKDF；可验证换钥在路线图
- **假名与设备绑定有限**
- **双端实时依赖浏览器与 NAT**
- **公钥交换经公共信令、无带外指纹校验** — TOFU 钉住首次公钥；**第一次交换**时中间人注入假公钥无法被协议单独识破；无安全码/二维码带外核对
- **流量混淆强度有限** — 约每 30 秒、固定约 48 字节噪声；等间隔等长填充在流量分析中可能可识别，**不能**对抗认真分析

---

## ✦ 路线图

### 已完成 ✅

- [x] P2P 实时通信、阅后即焚、本地存储与加密备份
- [x] E2EE、密文签名、每消息 HKDF、验签失败 UI 提示
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

### 核心依赖

| 项目 | 协议 | 说明 |
|------|------|------|
| [React](https://react.dev) | MIT | UI |
| [Vite](https://vite.dev) | MIT | 构建 |
| [Trystero](https://github.com/dmotz/trystero) | MIT | P2P |
| [TypeScript](https://www.typescriptlang.org) | Apache-2.0 | 类型 |
| [idb](https://github.com/jakearchibald/idb) | ISC | IndexedDB 封装 |

## ✦ 贡献

请阅读 [贡献者行为准则](./CODE_OF_CONDUCT.md)。协作约束见 [AGENTS.md](./AGENTS.md)。

---

*Nymir — 让秘密只属于你*
