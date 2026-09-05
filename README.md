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
│   · 端到端加密，第三方较难读取                             │
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

| 特性 | Nymir | 传统聊天应用 |
|---|---|---|
| **云端服务器** | 无（P2P 直连） | 有（存储你的数据） |
| **注册** | 无需注册 | 需要手机号/邮箱 |
| **数据存储** | 📱 你的设备 | 🏢 他们的服务器 |
| **加密方式** | 🔐 端到端 P2P | 🔑 服务端可解密 |
| **数据备份** | 💾 加密 JSON 导出 | 通常不可控 |
| **销毁消息** | 🔥 阅后即焚 | 一般永久存储 |
| **追踪/埋点** | 无追踪 | 普遍存在 |
| **开源** | ✅ AGPL-3.0 | 多数闭源 |
| **Peer 发现** | ⚠️ 依赖公共信令服务 | N/A |

---

## ✦ 核心特性

### 🔒 匿名 & 隐私

- **无需注册** — 不要求手机号、邮箱或个人信息
- **随机身份** — 每次连接自动生成匿名 ID
- **端到端加密** — WebRTC 直连 + X25519 密钥交换 + AES-256-GCM 加密
- **不收集数据** — 不设埋点、不追踪、不记录用户行为日志

```
你的消息路线：
你 ──► 加密 ──► P2P 直连 ──► 解密 ──► 对方
            ↑                    ↑
         较难截取             较难截取
         （无云端服务器）
```

### 🔥 阅读即焚

三种销毁模式，由你控制消息的生命周期：

<div align="center">

| 模式 | 触发条件 | 适用场景 |
|---|---|---|
| **阅后即焚** | 对方查看后立即销毁 | 敏感信息、一次性密码 |
| **定时销毁** | 倒计时结束自动销毁（10秒 ~ 10分钟） | 临时讨论、不想留存的对话 |
| **永不销毁** | 保留在本地 | 重要记录、长期保存 |

</div>

### 🌐 P2P 通信架构

Nymir 的通信架构基于**多层降级策略**，提升连接可用性：

```
优先级 1 ──► BitTorrent 信令（公共 Tracker）
   │
   │  5秒无响应
   ▼
优先级 2 ──► MQTT 信令（公共 Broker）
   │
   │  连接建立
   ▼
优先级 3 ──► WebRTC P2P 直连（端到端加密）

断线自动重连 ──► 最多重试 5 次，每次间隔 3 秒
```

> ⚠️ 信令阶段（连接建立前）消息以明文传输。连接建立后，所有消息通过 WebRTC DTLS 加密通道传输。

### 💾 数据主权

你的数据**主要由你掌控**：

- 📱 **本地存储** — 数据存放在浏览器 IndexedDB 中
- 📦 **导出备份** — 一键导出为加密 JSON 文件（AES-256-GCM）
- 🔄 **导入恢复** — 支持跨设备迁移
- 🗑️ **手动清除** — 可随时退出或删除数据

### 🎨 液态玻璃 UI

视觉设计灵感来自玻璃拟态风格：

- **Glassmorphism** — 半透明毛玻璃效果，三层变体（默认/强/柔）
- **星空背景** — 闪烁星星 + 随机流星动画
- **微动态交互** — 消息销毁动画、重连脉冲指示器
- **移动端适配** — safe-area 适配、触控优化

---

## ✦ 技术架构

### 四层分离架构

```
┌─────────────────────────────────────────────────────────────┐
│                    ✦  UI 层  ✦                              │
│                                                             │
│  React 19 · Glassmorphism · Starfield · BurnTimer           │
│  组件化 · Hook 驱动 · 响应式适配                             │
├─────────────────────────────────────────────────────────────┤
│                    ✦  业务逻辑层  ✦                          │
│                                                             │
│  房间管理 · 消息管理 · 销毁策略 · 数据备份                    │
│  事件驱动 · 类型安全                                         │
├─────────────────────────────────────────────────────────────┤
│                    ✦  通信层  ✦                              │
│                                                             │
│  Trystero · WebRTC P2P · BitTorrent / MQTT 双信令            │
│  端到端加密 · 自动重连 · 策略降级                              │
│  文件传输 · 离线消息队列 · NAT 探测 · 连接监控                  │
├─────────────────────────────────────────────────────────────┤
│                    ✦  持久化层  ✦                            │
│                                                             │
│  IndexedDB · 加密 JSON 备份导出/导入 · 数据清理               │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈详解

| 层级 | 技术 | 版本 | 说明 |
|---|---|---|---|
| 前端框架 | React | 19.2.8 | 组件化 UI，Hooks 驱动 |
| 类型系统 | TypeScript | 6.0.2 | 编译时类型检查 |
| 构建工具 | Vite | 8.2.2 | 快速 HMR 与构建 |
| 通信引擎 | Trystero | 0.25.4 | 无服务器 WebRTC P2P |
| 信令通道 | BitTorrent + MQTT | — | 双通道自动降级 |
| 数据存储 | idb (IndexedDB) | 8.0.3 | 浏览器本地持久化 |
| 端到端加密 | X25519 + AES-256-GCM | — | 密钥交换 + 对称加密 |
| 数字签名 | Ed25519 | — | 消息完整性验证 |
| 样式方案 | CSS 变量 + Glassmorphism | — | 液态玻璃效果 |
| PWA 支持 | vite-plugin-pwa | 1.3.0 | 渐进式 Web 应用 |
| 代码检查 | oxlint | 1.79.0 | 快速 JavaScript/TypeScript linter |
| 单元测试 | vitest | 5.0.0 | Vite 原生测试框架 |

---

## ✦ 快速开始

### 环境要求

- Node.js >= 18
- npm / yarn / pnpm

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

浏览器打开 `http://localhost:5173` 即可使用。

### 构建生产版本

```bash
npm run build    # 构建到 dist/
npm run preview  # 预览生产版本
```

### 部署为静态站点

构建产物在 `dist/` 目录，可部署到静态托管平台：

| 平台 | 部署方式 |
|---|---|
| **GitHub Pages** | 推送 `dist/` 到 `gh-pages` 分支 |
| **Vercel** | 连接仓库，自动构建部署 |
| **Netlify** | 连接仓库，构建命令 `npm run build` |
| **Cloudflare Pages** | 连接仓库，构建输出目录 `dist` |

---

## ✦ 安全与隐私

### 安全特性

- ✅ **端到端加密** — X25519 密钥交换 + AES-256-GCM 对称加密
- ✅ **前向保密** — HKDF 每条消息独立密钥派生
- ✅ **消息签名** — Ed25519 数字签名验证消息完整性
- ✅ **P2P 直连** — 消息不经过云端服务器
- ✅ **本地存储** — 数据主要存在于用户设备
- ✅ **阅后即焚** — 消息被查看后自动销毁
- ✅ **加密备份** — 备份文件使用 AES-256-GCM 加密

### 安全注意事项

- **信令阶段**（连接建立前）消息以明文传输
- 阅后即焚消息在**对方设备内存中**可能短暂存在
- 浏览器缓存可能保留部分数据，建议定期清理
- **忘记密码 = 永久丢失数据**，请务必牢记
- 建议使用隐私浏览器模式以提升匿名性

### 已知局限

- **Peer 发现依赖公共信令服务** — MQTT Broker 和 WebTorrent Tracker 是第三方公共基础设施，并非完全去中心化
- **信令阶段无加密** — P2P 连接建立前的消息传输未加密
- **无持久化在线状态** — 设备离线后无法接收消息

---

## ✦ 设计原则

| 原则 | 实践 |
|---|---|
| **隐私优先** | 无云端服务器、不追踪、端到端加密 |
| **数据主权** | 数据存用户本地，加密备份可导出 |
| **诚实透明** | 准确描述架构，不夸大"去中心化" |
| **模块化** | 通信/逻辑/UI/存储四层分离 |
| **稳定性** | 重连机制 + 双信令降级 |
| **轻量依赖** | 仅使用必要的最小依赖 |

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
- [x] 前向保密（HKDF 每消息密钥）
- [x] 本地密码锁屏（PBKDF2 + AES-256-GCM）
- [x] 假名系统（每用户/每房间匿名昵称）
- [x] 流量混淆（随机噪声消息，无标识特征）
- [x] 安全删除（localStorage 覆写清除）
- [x] 加密备份（AES-256-GCM，.nymir 文件）
- [x] 可访问性（ARIA role、focus-visible、label 关联）
- [x] SEO（Open Graph、Twitter Card、noscript）
- [x] UI/UX 微交互动效系统 + 响应式适配
- [x] 文件传输（图片/文件 E2EE 传输，分块传输，进度回调）
- [x] 离线消息队列（发送失败消息暂存，peer 上线后自动重发）
- [x] NAT 类型探测（WebRTC ICE 候选类型检测，优化 P2P 连接）
- [x] 连接质量监控（延迟、连接时长、消息统计、质量评级）

### 计划中 🚀
- [ ] 消息搜索
- [ ] 语音消息
- [ ] 多设备同步（WebRTC 直传）
- [ ] 自定义主题（浅色/自定义配色）
- [ ] App 打包（Capacitor / Tauri）
- [ ] 去中心化身份（消除信令依赖）
- [ ] 群组管理增强（管理员/踢人/禁言）

---

## ✦ 常见问题

<details>
<summary><b>Q: 需要注册账号吗？</b></summary>
<br>
不需要。Nymir 无需注册，打开即可使用。每次连接自动生成随机匿名 ID。
</details>

<details>
<summary><b>Q: 消息会存储在服务器上吗？</b></summary>
<br>
不会。Nymir 没有云端服务器，消息通过 WebRTC P2P 直连传输，存储在浏览器本地。但 Peer 发现（找到对方）依赖公共信令服务器。
</details>

<details>
<summary><b>Q: 这是去中心化应用吗？</b></summary>
<br>
部分是。数据存储和消息传输是去中心化的（P2P 直连 + 本地存储），但 Peer 发现依赖公共信令服务器（MQTT Broker / WebTorrent Tracker），并非完全去中心化。更准确的定位是「无服务器架构 + 本地优先 + P2P 通信」。
</details>

<details>
<summary><b>Q: 阅后即焚安全吗？</b></summary>
<br>
阅后即焚消息在对方查看后会从双方设备中删除。但需注意，对方在查看瞬间可能截屏，且浏览器内存中可能短暂存在明文。
</details>

<details>
<summary><b>Q: 不同网络的设备能互相连接吗？</b></summary>
<br>
可以。通过 BitTorrent Tracker 和 MQTT Broker 进行信令交换，不同网络的设备也能建立 P2P 连接。同一局域网内连接通常更快。
</details>

<details>
<summary><b>Q: 数据丢失了怎么办？</b></summary>
<br>
使用右下角的备份按钮导出加密 JSON 文件。如果数据丢失，可以通过导入功能恢复。建议定期备份。
</details>

---

## ✦ 开源协议

本项目采用 [GNU Affero General Public License v3.0](./LICENSE) 开源协议。

选择 AGPL-3.0 的原因：Nymir 是一款关注隐私和本地优先的工具，AGPL 确保基于本项目的衍生作品（包括网络服务部署）也需要开源。

---

## ✦ 致谢与技术引用

本项目站在以下优秀开源项目的肩膀上，特此致谢：

### 核心依赖

| 项目 | 许可证 | 用途 |
|---|---|---|
| [Trystero](https://github.com/dmotz/trystero) | MIT | 无服务器 WebRTC P2P 通信引擎 |
| [React](https://react.dev) | MIT | 前端 UI 框架 |
| [Vite](https://vite.dev) | MIT | 构建工具与开发服务器 |
| [TypeScript](https://www.typescriptlang.org) | Apache-2.0 | 类型安全的 JavaScript 超集 |
| [idb](https://github.com/nicedoc/idb) | ISC | IndexedDB Promise 封装 |
| [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) | MIT | Vite PWA 支持插件 |
| [vitest](https://vitest.dev) | MIT | Vite 原生测试框架 |
| [oxlint](https://oxc-project.github.io) | MIT | 快速 JavaScript/TypeScript linter |

### 灵感来源

| 项目 | 说明 |
|---|---|
| [Chitchatter](https://github.com/jeremyckahn/chitchatter) | 基于 Trystero 的 P2P 聊天应用 |
| [n2-mesh](https://github.com/BartoszOsiej/n2-mesh) | WebRTC + MQTT 零依赖 P2P 网络 |

### 信令基础设施

| 服务 | 说明 | 去中心化？ |
|---|---|---|
| BitTorrent Trackers | 全球分布式信令通道 | ✅ 分布式 |
| [EMQX MQTT Broker](https://www.emqx.io) | 信令降级备用通道 | ❌ 公共服务器 |

---

## ✦ 贡献

欢迎贡献！请先阅读 [贡献者行为准则](./CODE_OF_CON_CONDUCT.md)。

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建一个 Pull Request

---

<div align="center">

<img src="https://img.shields.io/badge/你的数据-你的主权-7c6aef?style=for-the-badge&logo=shield&logoColor=white" alt="your data your sovereignty">

<br>

*Nymir — 让秘密只属于你*

</div>
