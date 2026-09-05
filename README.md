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

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   ┌─────────┐        P2P 加密通道        ┌─────────┐       │
│   │         │ ◄──────────────────────► │         │       │
│   │  用户 A  │   WebRTC · 端到端加密     │  用户 B  │       │
│   │         │     无云端服务器存储       │         │       │
│   └─────────┘                           └─────────┘       │
│                                                              │
│   · 消息在设备之间直接传输，不经过云端服务器               │
│   · 端到端加密（密钥在本机，业务服务器看不到明文）       │
│   · 离开房间后数据倾向于被清除                             │
│   · 数据主要存在于你的设备上                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### ⚠️ 关于"去中心化"的准确说明

Nymir **不是完全去中心化**的。以下是各层面的真实情况：

| 层面 | 去中心化？ | 说明 |
|------|-----------|------|
| **数据存储** | ✅ 是 | IndexedDB 纯本地，无云端 |
| **消息传输** | ✅ 是 | P2P 直连，不经过服务器 |
| **端到端加密** | ✅ 是 | X25519 + AES-256-GCM，密钥不离开设备 |
| **Peer 发现/信令** | ❌ 否 | 依赖公共 MQTT Broker 和 WebTorrent Trackers |
| **身份系统** | ⚠️ 半匿名 | 匿名昵称本地生成，但 P2P 连接需要信令服务器 |

**关键依赖**：Peer 之间的「发现」和「连接建立」依赖公共信令服务器（MQTT Broker、WebTorrent Trackers）。如果这些服务全部下线，新设备之间无法建立连接。但连接建立后，消息本身是 P2P 直传且端对端加密的。

更准确的定位是：**无服务器架构（serverless）+ 本地优先（local-first）+ P2P 通信**。

---

## ✦ 为什么选择 Nymir？

| 对比维度 | 传统即时通讯 | Nymir |
|---------|------------|-------|
| **数据存储** | 云端服务器 | 你的设备本地 |
| **消息路径** | 经过服务器中转 | 设备间 P2P 直连 |
| **账号体系** | 需要注册/手机号 | 无需注册 |
| **加密方式** | 视产品而定 | 端到端加密（默认） |
| **消息销毁** | 依赖服务端策略 | 阅读即焚（客户端） |
| **审计风险** | 服务端可能留存 | 无业务服务端数据库 |

---

## ✦ 核心特性

### 🔒 匿名 & 隐私

- 无需注册、手机号或邮箱
- 每房间本地生成假名
- 消息端到端加密
- 数据主要留在本机

### 🔥 阅读即焚

- **持久**：正常保存
- **阅后即焚**：对方读后可销毁
- **定时销毁**：到期后销毁

### 🌐 P2P 通信架构

- WebRTC 直连 + BitTorrent / MQTT 信令降级
- 断线重连与有限离线重试

### 💾 数据主权

- IndexedDB 本地存储
- 加密 JSON 备份导出/导入

### 🎨 液态玻璃 UI

- 深色主题、移动端适配、PWA

---

## ✦ 技术架构

### 四层分离架构

```
┌─────────────────────────────────────────────────────────────┐
│  UI 层          src/ui                                      │
│  React 组件 · 交互 · i18n                                   │
├─────────────────────────────────────────────────────────────┤
│  Core 层        src/core                                    │
│  房间 · 消息 · 阅后即焚 · 类型                              │
├─────────────────────────────────────────────────────────────┤
│  Communication  src/communication                           │
│  P2P · 信令策略 · 离线队列 · 文件传输                       │
├─────────────────────────────────────────────────────────────┤
│  Security       src/security                                │
│  E2EE · 签名 · 假名 · 安全删除                              │
├─────────────────────────────────────────────────────────────┤
│  Persistence    src/persistence                             │
│  IndexedDB                                                  │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈详解

| 类别 | 技术 |
|------|------|
| 前端 | React 19 · TypeScript · Vite |
| P2P | Trystero · WebRTC · WebTorrent / MQTT |
| 加密 | WebCrypto · X25519 · Ed25519 · AES-256-GCM · HKDF · PBKDF2 |
| 存储 | IndexedDB |

---

## ✦ 快速开始

### 环境要求

- Node.js 20+
- 现代浏览器（需 WebRTC / WebCrypto）

### 三步上手

```bash
# 1. 克隆仓库
git clone https://github.com/xiaoyu-hue/Nymir.git
cd Nymir

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 部署为静态站点

构建产物在 `dist/`，可部署到 GitHub Pages、Cloudflare Pages 等静态托管。

---

## ✦ 安全与隐私

### 安全特性

- ✅ **端到端加密** — X25519 密钥交换 + AES-256-GCM 对称加密
- ✅ **每消息密钥** — HKDF 按消息派生，降低单条密钥泄露的影响面
- ✅ **密文签名（encrypt-then-sign）** — 对密文做 Ed25519 签名，避免对明文猜测验签
- ✅ **签名失败可见** — 验签失败的消息会在气泡上明确标示，不会静默当正常消息展示
- ✅ **P2P 直连** — 会话消息不经过业务云端存储
- ✅ **本地存储** — 数据主要存在于用户设备（IndexedDB）
- ✅ **阅后即焚** — 可配置阅读后销毁 / 定时销毁
- ✅ **加密备份** — 备份文件使用 AES-256-GCM 加密

### 安全注意事项

- **首次见面信任（TOFU）**：第一次交换公钥时，若中间人抢先注入假公钥，应用无法从协议上自动识破；之后同房间内的变更会被更严格对待
- 阅后即焚消息在**对方设备内存中**可能短暂存在；无法保证对方未截图或未复制
- 浏览器缓存 / 系统备份可能保留部分痕迹，高敏感场景请自行评估设备环境
- **忘记锁屏密码 = 本地加密数据可能永久无法打开**，请务必牢记
- 建议在需要更高匿名性时使用隐私浏览模式，并避免在不可信网络上做敏感通信

### 已知局限

- **Peer 发现依赖公共信令** — MQTT Broker、WebTorrent Tracker 等是第三方公共设施；它们挂了则难以发现新对端。连接建立后的聊天内容仍走 P2P 与端到端加密，但「谁在何时连了谁」可能被信令侧观察到
- **信令/建连阶段不是端到端加密通道** — WebRTC 建连依赖信令；应用层聊天密文在密钥交换完成前无法投递
- **无服务端离线收件箱** — 对端不在线时消息无法投递到服务器代收；本端会做有限的本地排队与重试，不能替代「永远在线」的中心化 IM
- **自动密钥轮换当前关闭** — 为避免长对话因轮换通知不完整而整段解不开，已关闭「每 100 条自动换钥」。仍有每消息 HKDF 派生；完整的可验证换钥与前向保密增强仍在路线图
- **假名与设备绑定有限** — 假名在本地生成，换设备 / 清数据会丢本地身份与 TOFU 记录
- **双端实时依赖浏览器与 NAT** — 严格 NAT、后台挂起的移动浏览器标签可能导致延迟或短暂收不到，属运行环境限制，不是「云端已保存」

---

## ✦ 设计原则

| 原则 | 实践 |
|---|---|
| **隐私优先** | 无业务云端消息库、不追踪、端到端加密 |
| **数据主权** | 数据存用户本地，加密备份可导出 |
| **诚实透明** | 准确描述架构，不夸大「完全去中心化」 |
| **模块化** | 通信 / 逻辑 / UI / 存储分层 |
| **稳定性** | 重连 + 双信令降级 |
| **轻量依赖** | 仅使用必要依赖 |

---

## ✦ 路线图

### 已完成 ✅

- [x] P2P 实时通信（WebRTC + BitTorrent）
- [x] 阅读即焚三种模式
- [x] 液态玻璃 UI + 星空动画
- [x] 数据本地存储 + 加密 JSON 备份
- [x] MQTT 信号降级
- [x] 断线自动重连
- [x] 移动端适配
- [x] 消息撤回
- [x] 多语言支持（中文/英文）
- [x] PWA 支持（离线可用）
- [x] 消息已读回执
- [x] 端到端加密（X25519 + AES-256-GCM）
- [x] 消息数字签名（Ed25519）
- [x] 每消息密钥（HKDF）
- [x] 本地密码锁屏（PBKDF2 + AES-256-GCM）
- [x] 假名系统
- [x] 流量混淆（噪声消息）
- [x] 安全删除
- [x] 加密备份
- [x] 文件传输（E2EE 分块）
- [x] 离线消息队列
- [x] 连接质量监控
- [x] 密文签名（encrypt-then-sign）+ 签名版本字段
- [x] 验签失败在 UI 上明确提示（不静默展示）
- [x] CI 测试门禁（typecheck + lint + test）

### 计划中 🚀

- [ ] 可验证的密钥轮换与 TOFU 重固定（恢复自动换钥且不中断会话）
- [ ] 消息搜索
- [ ] 语音消息
- [ ] 多设备同步（WebRTC 直传）
- [ ] 自定义主题（浅色/自定义配色）
- [ ] App 打包（Capacitor / Tauri）
- [ ] 去中心化身份（降低对公共信令的依赖）
- [ ] 群组管理增强（管理员/踢人/禁言）

---

## ✦ 常见问题

<details>
<summary><b>Q: 消息会经过你们的服务器吗？</b></summary>

不会以明文形式存到业务服务器。聊天内容在设备间 P2P 传输并端到端加密。发现对端仍依赖公共信令设施。

</details>

<details>
<summary><b>Q: 阅后即焚安全吗？</b></summary>

它减少本机与对端 UI 上的留存，但无法防止对方截图、复制或在内存中短暂停留。不要把它当成物理级销毁保证。

</details>

<details>
<summary><b>Q: 忘记密码怎么办？</b></summary>

无法找回。本地加密数据可能永久打不开。请事先导出加密备份并妥善保管密码。

</details>

---

## ✦ 开源协议

本项目采用 [AGPL-3.0](./LICENSE) 协议。

---

## ✦ 致谢与技术引用

### 核心依赖

| 项目 | 协议 | 说明 |
|------|------|------|
| [React](https://react.dev) | MIT | UI |
| [Vite](https://vite.dev) | MIT | 构建 |
| [Trystero](https://github.com/dmotz/trystero) | MIT | P2P |
| [TypeScript](https://www.typescriptlang.org) | Apache-2.0 | 类型 |

### 信令基础设施

公共 MQTT Broker 与 WebTorrent Tracker（第三方，可用性不由本项目保证）。

---

## ✦ 贡献

欢迎贡献！请先阅读 [贡献者行为准则](./CODE_OF_CONDUCT.md)。

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送 (`git push origin feature/amazing-feature`)
5. 开 Pull Request

更细的 AI/协作约束见根目录 [AGENTS.md](./AGENTS.md)。

---

<div align="center">

<img src="https://img.shields.io/badge/你的数据-你的主权-7c6aef?style=for-the-badge&logo=shield&logoColor=white" alt="your data your sovereignty">

<br>

*Nymir — 让秘密只属于你*

</div>
