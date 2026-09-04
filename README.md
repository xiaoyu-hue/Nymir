<div align="center">

<img src="https://img.shields.io/badge/version-1.0.0-7c6aef?style=for-the-badge" alt="version">
<img src="https://img.shields.io/badge/license-AGPL--3.0-22c55e?style=for-the-badge" alt="license">

**[English](./README.en.md) · 中文**

# ✦ Nymir · 树洞

**匿名树洞 · 阅读即焚 · 数据主权归你**

> *你的数据，你的主权。让秘密只属于你。*

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

Nymir 是一款**去中心化**的匿名聊天应用。它不依赖后端服务器，不设中心数据库，不主动收集用户数据。所有通信通过 **WebRTC 端到端加密** 直接在用户设备之间进行，数据存储在你自己的浏览器中。

消息可以设置为**阅读即焚** — 被查看后自动销毁，尽量减少留存。

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   ┌─────────┐        P2P 加密通道        ┌─────────┐       │
│   │         │ ◄──────────────────────► │         │       │
│   │  用户 A  │   WebRTC · 端到端加密     │  用户 B  │       │
│   │         │        无中心服务器        │         │       │
│   └─────────┘                           └─────────┘       │
│                                                              │
│   · 消息在设备之间直接传输，不经过中心服务器               │
│   · 端到端加密，第三方较难读取                             │
│   · 离开房间后数据倾向于被清除                             │
│   · 数据主要存在于你的设备上                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## ✦ 为什么选择 Nymir？

| 特性 | Nymir | 传统聊天应用 |
|---|---|---|
| **服务器** | 无中心服务器 | 有（存储你的数据） |
| **注册** | 无需注册 | 需要手机号/邮箱 |
| **数据存储** | 📱 你的设备 | 🏢 他们的服务器 |
| **加密方式** | 🔐 端到端 P2P | 🔑 服务端可解密 |
| **数据备份** | 💾 JSON 导出 | 通常不可控 |
| **销毁消息** | 🔥 阅后即焚 | 一般永久存储 |
| **追踪/埋点** | 无追踪 | 普遍存在 |
| **开源** | ✅ AGPL-3.0 | 多数闭源 |

---

## ✦ 核心特性

### 🔒 匿名 & 隐私

- **无需注册** — 不要求手机号、邮箱或个人信息
- **随机身份** — 每次连接自动生成匿名 ID
- **端到端加密** — WebRTC 直连，消息内容较难被第三方读取
- **不收集数据** — 不设埋点、不追踪、不记录用户行为日志

```
你的消息路线：
你 ──► 加密 ──► P2P 直连 ──► 解密 ──► 对方
            ↑                    ↑
         较难截取             较难截取
         （无中心服务器）
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

### 🌐 去中心化 P2P

Nymir 的通信架构基于**多层降级策略**，提升连接可用性：

```
优先级 1 ──► BitTorrent 信令（全球公共基础设施）
   │
   │  5秒无响应
   ▼
优先级 2 ──► MQTT 信令（轻量级消息队列）
   │
   │  连接建立
   ▼
优先级 3 ──► WebRTC P2P 直连（端到端加密）

断线自动重连 ──► 最多重试 5 次，每次间隔 3 秒
```

### 💾 数据主权

你的数据**主要由你掌控**：

- 📱 **本地存储** — 数据存放在浏览器 IndexedDB 中
- 📦 **导出备份** — 一键导出为 JSON 格式
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
├─────────────────────────────────────────────────────────────┤
│                    ✦  持久化层  ✦                            │
│                                                             │
│  IndexedDB · JSON 备份导出/导入 · 数据清理                    │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈详解

| 层级 | 技术 | 版本 | 说明 |
|---|---|---|---|
| 前端框架 | React | 19 | 组件化 UI，Hooks 驱动 |
| 类型系统 | TypeScript | 6 | 编译时类型检查 |
| 构建工具 | Vite | 8 | 快速 HMR 与构建 |
| 通信引擎 | Trystero | 0.25 | 无服务器 WebRTC P2P |
| 信令通道 | BitTorrent + MQTT | — | 双通道自动降级 |
| 数据存储 | idb (IndexedDB) | 8 | 浏览器本地持久化 |
| 样式方案 | CSS 变量 + Glassmorphism | — | 液态玻璃效果 |

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

## ✦ 项目结构

```
src/
│
├── communication/              # 📡 通信层
│   ├── peer.ts                #   PeerManager — 连接、频道、重连、策略降级
│   └── types.ts               #   通信类型定义
│
├── persistence/                # 💾 持久化层
│   ├── db.ts                  #   IndexedDB CRUD 操作封装
│   ├── backup.ts              #   JSON 备份导出 / 导入
│   └── types.ts               #   存储类型定义
│
├── core/                       # 🧠 业务逻辑层
│   ├── types.ts               #   Message、BurnMode、RoomInfo 核心类型
│   ├── burn.ts                #   销毁策略计算引擎
│   ├── message.ts             #   消息收发 + 即焚调度
│   └── room.ts                #   房间管理 + 重连逻辑
│
├── ui/                         # 🎨 UI 层
│   ├── components/            #   React 组件
│   │   ├── Starfield.tsx      #     星空背景
│   │   ├── GlassCard.tsx      #     液态玻璃卡片（3 种变体）
│   │   ├── MessageBubble.tsx  #     消息气泡（含销毁动画）
│   │   ├── BurnTimer.tsx      #     销毁倒计时指示器
│   │   ├── ChatView.tsx       #     聊天主界面
│   │   ├── RoomPanel.tsx      #     房间创建/加入面板
│   │   └── BackupPanel.tsx    #     数据备份面板
│   ├── styles/                #   CSS 样式
│   │   ├── globals.css        #     全局样式 + CSS 变量
│   │   ├── glass.css          #     液态玻璃样式
│   │   └── starfield.css      #     星空动画
│   └── hooks/                 #   React Hooks
│       ├── useRoom.ts         #     房间状态 Hook
│       └── useMessages.ts     #     消息状态 Hook
│
├── utils/                      # 🔧 工具函数
│   ├── id.ts                  #   匿名 ID / 房间码生成
│   ├── time.ts                #   时间格式化 / 倒计时
│   └── crypto.ts              #   加密辅助（预留）
│
├── App.tsx                     # 根组件
├── main.tsx                    # 入口
└── index.html                  # HTML 模板
```

---

## ✦ 使用流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  1. 打开应用  │────►│  2. 创建/加入 │────►│  3. 选择模式  │
│             │     │     房间     │     │             │
│  星空主页    │     │  6位房间代码  │     │ 永久/焚/定时 │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
       ┌─────────────┐     ┌─────────────┐     │
       │  5. 退出房间  │◄────│  4. 匿名聊天  │◄────┘
       │             │     │             │
       │  数据本地保留 │     │  P2P 加密    │
       └─────────────┘     └─────────────┘
```

---

## ✦ 安全与隐私

### 安全特性

- ✅ **端到端加密** — WebRTC 数据通道使用 DTLS 加密
- ✅ **P2P 直连** — 消息不经过中心服务器
- ✅ **不记录日志** — 不主动记录用户行为
- ✅ **本地存储** — 数据主要存在于用户设备
- ✅ **阅后即焚** — 消息被查看后自动销毁
- ✅ **定时销毁** — 可自定义销毁倒计时

### 安全注意事项

- 消息在 **P2P 连接建立前** 以明文传输（信令阶段）
- 阅后即焚消息在 **对方设备内存中** 可能短暂存在
- 浏览器缓存可能保留部分数据，建议定期清理
- 建议使用隐私浏览器模式以提升匿名性

---

## ✦ 设计原则

| 原则 | 实践 |
|---|---|
| **隐私优先** | 无中心服务器、不追踪、端到端加密 |
| **数据主权** | 数据存用户本地，支持导出 |
| **模块化** | 通信/逻辑/UI/存储四层分离 |
| **可扩展** | 新销毁策略可低成本接入 |
| **稳定性** | 重连机制 + 双信令降级 |
| **渐进增强** | 核心功能可用，高级功能可选 |
| **轻量依赖** | 仅使用必要的最小依赖 |

---

## ✦ 路线图

### 已完成 ✅

- [x] P2P 实时通信（WebRTC + BitTorrent）
- [x] 阅读即焚三种模式
- [x] 液态玻璃 UI + 星空动画
- [x] 数据本地存储 + JSON 备份
- [x] MQTT 信号降级
- [x] 断线自动重连
- [x] 移动端适配
- [x] 消息撤回
- [x] 多语言支持

### 计划中 🚀

- [ ] 端到端加密增强（AES-256）
- [ ] 图片/文件发送
- [ ] 语音消息
- [ ] 消息已读回执
- [ ] PWA 支持（离线可用）
- [ ] App 打包（Capacitor / Tauri）
- [ ] 群组管理增强

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
不会。Nymir 没有中心服务器，消息通过 WebRTC P2P 直连传输，存储在浏览器本地。
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
使用右下角的备份按钮导出 JSON 文件。如果数据丢失，可以通过导入功能恢复。建议定期备份。
</details>

---

## ✦ 开源协议

本项目采用 [GNU Affero General Public License v3.0](./LICENSE) 开源协议。

选择 AGPL-3.0 的原因：Nymir 是一款关注隐私和去中心化的工具，AGPL 确保基于本项目的衍生作品（包括网络服务部署）也需要开源。

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

### 灵感来源

| 项目 | 说明 |
|---|---|
| [Chitchatter](https://github.com/jeremyckahn/chitchatter) | 基于 Trystero 的 P2P 聊天应用 |
| [n2-mesh](https://github.com/BartoszOsiej/n2-mesh) | WebRTC + MQTT 零依赖 P2P 网络 |

### 信令基础设施

| 服务 | 说明 |
|---|---|
| BitTorrent Trackers | 全球分布式信令通道 |
| [HiveMQ MQTT Broker](https://www.hivemq.com/public-mqtt-broker/) | 信令降级备用通道 |

---

## ✦ 贡献

欢迎贡献！请先阅读 [贡献者行为准则](./CODE_OF_CONDUCT.md)。

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建一个 Pull Request

---

## ✦ 行为准则

本项目遵循 [贡献者行为准则](./CODE_OF_CONDUCT.md)。参与本项目即表示你同意遵守其条款。

---

<div align="center">

<img src="https://img.shields.io/badge/你的数据-你的主权-7c6aef?style=for-the-badge&logo=shield&logoColor=white" alt="your data your sovereignty">

<br>

*Nymir — 让秘密只属于你*

</div>
