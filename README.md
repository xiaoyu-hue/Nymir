<div align="center">

# ✦ Nymir · 树洞

**匿名树洞 · 阅读即焚 · 数据主权归你**

> 无后端、无服务器、无数据记录 — 所有数据存储在你本地浏览器

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Trystero](https://img.shields.io/badge/Trystero-P2P-FF6B35)](https://github.com/dmotz/trystero)
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

</div>

---

## ✦ 什么是 Nymir？

Nymir 是一款**完全去中心化**的匿名聊天应用。

没有后端服务器，没有数据库，没有数据收集。所有通信通过 **WebRTC 端到端加密** 直接在用户设备之间进行，所有数据存储在你自己的浏览器中。

消息可以设置为**阅读即焚** — 被查看后自动销毁，不留痕迹。

```
┌─────────────────────────────────────────────────┐
│                                                 │
│    用户 A  ◄──── P2P 加密通道 ────►  用户 B     │
│                                                 │
│    · 消息直接传输，不经过任何服务器               │
│    · 端到端加密，第三方无法读取                   │
│    · 离开即清除，不保留任何记录                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## ✦ 核心特性

### 🔒 匿名 & 隐私

- 无需注册、无需账号、无需手机号
- 每次连接生成随机匿名 ID
- 端到端加密，消息内容不可被窃听
- 无埋点、无追踪、无数据外传

### 🔥 阅读即焚

| 模式 | 说明 |
|---|---|
| **阅后即焚** | 消息被对方查看后立即销毁 |
| **定时销毁** | 发送后倒计时自动销毁（10秒 ~ 10分钟可选） |
| **永不销毁** | 消息永久保留在本地 |

### 🌐 去中心化 P2P

- 基于 **WebRTC** 的点对点直连通信
- **BitTorrent 信令** — 全球公共基础设施，无需配置
- **MQTT 降级** — BitTorrent 不可用时自动切换
- **自动重连** — 断线后最多重试 5 次恢复连接

### 💾 数据主权

- 所有数据存储在浏览器 **IndexedDB** 中
- 支持 **JSON 格式导出备份**
- 支持导入恢复，跨设备迁移
- 你的数据只属于你

### 🎨 液态玻璃 UI

- **Glassmorphism** 毛玻璃视觉风格
- **星空背景** 120 颗星星 + 流星动画
- **微动态交互** 消息销毁动画、重连脉冲指示
- **移动端适配** safe-area、触控优化、禁缩放

---

## ✦ 技术架构

```
┌──────────────────────────────────────────────────────┐
│  UI 层                                                │
│  React 19 · Glassmorphism · Starfield · BurnTimer     │
├──────────────────────────────────────────────────────┤
│  业务逻辑层                                            │
│  房间管理 · 消息管理 · 销毁策略 · 数据备份              │
├──────────────────────────────────────────────────────┤
│  通信层                                               │
│  Trystero · WebRTC P2P · BitTorrent / MQTT 信令       │
├──────────────────────────────────────────────────────┤
│  持久化层                                             │
│  IndexedDB · JSON 备份导出/导入                        │
└──────────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术 | 说明 |
|---|---|---|
| 前端框架 | React 19 + TypeScript | 类型安全、组件化 |
| 构建工具 | Vite 8 | 极速开发与构建 |
| 通信引擎 | Trystero | 无服务器 WebRTC P2P |
| 信令通道 | BitTorrent + MQTT | 双通道自动降级 |
| 数据存储 | IndexedDB (idb) | 浏览器本地持久化 |
| 样式方案 | CSS 变量 + Glassmorphism | 液态玻璃效果 |

---

## ✦ 快速开始

### 环境要求

- Node.js >= 18
- npm / yarn / pnpm

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/xiaoyu-hue/Nymir.git
cd Nymir

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

浏览器打开 `http://localhost:5173` 即可使用。

### 构建生产版本

```bash
npm run build
npm run preview
```

### 部署为静态站点

构建产物在 `dist/` 目录，可直接部署到任意静态托管：

- GitHub Pages
- Vercel
- Netlify
- Cloudflare Pages

```bash
# 示例：部署到 GitHub Pages
npm run build
# 将 dist/ 目录推送到 gh-pages 分支即可
```

---

## ✦ 项目结构

```
src/
├── communication/          # 通信层 — Trystero P2P 封装
│   ├── peer.ts            #   PeerManager: 连接、频道、重连
│   └── types.ts           #   通信类型定义
│
├── persistence/            # 持久化层 — IndexedDB
│   ├── db.ts              #   CRUD 操作封装
│   ├── backup.ts          #   导出/导入 JSON 备份
│   └── types.ts           #   存储类型定义
│
├── core/                   # 业务逻辑层
│   ├── types.ts           #   Message、BurnMode 等核心类型
│   ├── burn.ts            #   销毁策略计算
│   ├── message.ts         #   消息收发 + 即焚调度
│   └── room.ts            #   房间管理 + 重连逻辑
│
├── ui/                     # UI 层
│   ├── components/        #   React 组件
│   │   ├── Starfield.tsx  #     星空背景
│   │   ├── GlassCard.tsx  #     液态玻璃卡片
│   │   ├── MessageBubble  #     消息气泡
│   │   ├── BurnTimer.tsx  #     销毁倒计时
│   │   ├── ChatView.tsx   #     聊天主界面
│   │   ├── RoomPanel.tsx  #     房间面板
│   │   └── BackupPanel    #     备份面板
│   ├── styles/            #   CSS 样式
│   └── hooks/             #   React Hooks
│
├── utils/                  # 工具函数
├── App.tsx                 # 根组件
└── main.tsx                # 入口
```

---

## ✦ 使用流程

```
1. 打开应用
   └─► 进入星空主页

2. 创建房间（获得 6 位房间代码）
   └─► 或输入朋友的房间代码加入

3. 选择消息模式
   └─► 永久 · 阅后即焚 · 定时销毁

4. 开始匿名聊天
   └─► 消息 P2P 直连，端到端加密

5. 退出房间
   └─► 数据留在本地，可随时导出备份
```

---

## ✦ 设计原则

| 原则 | 实践 |
|---|---|
| **隐私优先** | 无后端、无埋点、端到端加密 |
| **数据主权** | 所有数据存用户本地，支持导出 |
| **模块化** | 通信/逻辑/UI/存储四层严格分离 |
| **可扩展** | 新销毁策略可低成本接入 |
| **稳定性** | 重连机制 + 双信令降级 |
| **渐进增强** | 核心功能可用，高级功能可选 |

---

## ✦ 路线图

- [x] P2P 实时通信（WebRTC + BitTorrent）
- [x] 阅读即焚三种模式
- [x] 液态玻璃 UI + 星空动画
- [x] 数据本地存储 + JSON 备份
- [x] MQTT 信号降级
- [x] 断线自动重连
- [x] 移动端适配
- [ ] 端到端加密增强（AES-256）
- [ ] 图片/文件发送
- [ ] 语音消息
- [ ] 消息已读回执
- [ ] PWA 支持（离线可用）
- [ ] App 打包（Capacitor / Tauri）

---

## ✦ 开源协议

本项目采用 [GNU Affero General Public License v3.0](./LICENSE) 开源协议。

选择 AGPL-3.0 的原因：Nymir 是一款具有明确意识形态属性的隐私工具（数据主权、去中心化、匿名性），AGPL 确保任何基于本项目的衍生作品（包括网络服务部署）都必须开源，防止闭源商用对用户自由的侵蚀。

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
| [Chitchatter](https://github.com/jeremyckahn/chitchatter) | 基于 Trystero 的 P2P 聊天应用，架构参考 |
| [n2-mesh](https://github.com/BartoszOsiej/n2-mesh) | WebRTC + MQTT 零依赖 P2P 网络 |

### 信令基础设施

| 服务 | 说明 |
|---|---|
| [BitTorrent Trackers](https://github.com/nicedoc/idb) | 全球分布式信令通道 |
| [MQTT Brokers](https://www.hivemq.com/public-mqtt-broker/) | 信令降级备用通道 |

### 社区

感谢所有为开源隐私工具做出贡献的开发者。

---

## ✦ 行为准则

本项目遵循 [贡献者行为准则](./CODE_OF_CONDUCT.md)。参与本项目即表示你同意遵守其条款。

---

<div align="center">

**你的数据，你的主权。**

*Nymir — 让秘密只属于你*

</div>
