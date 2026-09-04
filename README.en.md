<div align="center">

<img src="https://img.shields.io/badge/version-1.0.0-7c6aef?style=for-the-badge" alt="version">
<img src="https://img.shields.io/badge/license-AGPL--3.0-22c55e?style=for-the-badge" alt="license">

**English · [中文](./README.md)**

# ✦ Nymir

**Anonymous Tree-Hole · Read-and-Burn · Your Data, Your Sovereignty**

> *Your data, your sovereignty. Let secrets stay with you.*

<br>

[![React](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=white&style=flat-square)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript_6-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite_8-646CFF?logo=vite&logoColor=white&style=flat-square)](https://vite.dev)
[![Trystero](https://img.shields.io/badge/Trystero-P2P-FF6B35?style=flat-square)](https://github.com/dmotz/trystero)
[![WebRTC](https://img.shields.io/badge/WebRTC-Encrypted-0F9D58?style=flat-square)](https://webrtc.org)

</div>

---

## ✦ What is Nymir?

In an era where data is widely collected and analyzed, **privacy** is becoming increasingly valuable.

Nymir is a **decentralized** anonymous chat application. It does not rely on backend servers, has no central database, and does not actively collect user data. All communication happens directly between user devices through **WebRTC end-to-end encryption**, with data stored in your own browser.

Messages can be set to **read-and-burn** — automatically destroyed after being viewed, minimizing digital footprints.

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   ┌─────────┐        P2P Encrypted        ┌─────────┐      │
│   │         │ ◄───── Channel ──────► │         │      │
│   │  User A  │   WebRTC · E2E Encrypted   │  User B  │      │
│   │         │     No Central Server        │         │      │
│   └─────────┘                           └─────────┘      │
│                                                              │
│   · Messages sent directly between devices                  │
│   · End-to-end encrypted, harder for third parties          │
│   · Data tends to be cleared when leaving a room            │
│   · Data primarily exists on your device                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## ✦ Why Choose Nymir?

| Feature | Nymir | Traditional Chat Apps |
|---|---|---|
| **Servers** | No central server | Yes (stores your data) |
| **Registration** | No registration needed | Requires phone/email |
| **Data Storage** | 📱 Your device | 🏢 Their servers |
| **Encryption** | 🔐 End-to-end P2P | 🔑 Server can decrypt |
| **Backup** | 💾 JSON export | Usually not available |
| **Burn Messages** | 🔥 Read-and-burn | Generally stored forever |
| **Tracking** | No tracking | Commonly present |
| **Open Source** | ✅ AGPL-3.0 | Mostly closed source |

---

## ✦ Core Features

### 🔒 Anonymous & Private

- **No Registration** — No phone number, email, or personal info required
- **Random Identity** — Anonymous ID generated on each connection
- **End-to-End Encryption** — WebRTC direct connection, harder for third parties to read
- **No Data Collection** — No analytics, no tracking, no behavior logging

```
Your message route:
You ──► Encrypt ──► P2P Direct ──► Decrypt ──► Recipient
              ↑                     ↑
         Hard to intercept    Hard to intercept
         (no central server)
```

### 🔥 Read-and-Burn

Three destruction modes, giving you control over message lifecycle:

<div align="center">

| Mode | Trigger | Use Case |
|---|---|---|
| **Read-once** | Destroyed immediately after recipient views | Sensitive info, one-time passwords |
| **Timed** | Auto-destroyed after countdown (10s ~ 10min) | Temporary discussions |
| **Persistent** | Remains stored locally | Important records |

</div>

### 🌐 Decentralized P2P

Nymir's communication architecture uses a **multi-layer fallback strategy** to improve connection reliability:

```
Priority 1 ──► BitTorrent Signaling (global public infrastructure)
   │
   │  5s no response
   ▼
Priority 2 ──► MQTT Signaling (lightweight message queue)
   │
   │  Connection established
   ▼
Priority 3 ──► WebRTC P2P Direct (end-to-end encrypted)

Auto-reconnect ──► Up to 5 attempts, 3s interval
```

### 💾 Data Sovereignty

Your data is **primarily under your control**:

- 📱 **Local Storage** — Data stored in browser IndexedDB
- 📦 **Export Backup** — One-click JSON export
- 🔄 **Import Restore** — Cross-device migration supported
- 🗑️ **Manual Cleanup** — Exit or delete data anytime

### 🎨 Liquid Glass UI

Visual design inspired by glassmorphism:

- **Glassmorphism** — Semi-transparent frosted glass effect, 3 variants (default/strong/subtle)
- **Starfield** — Twinkling stars + random shooting star animations
- **Micro-interactions** — Message burn animation, reconnect pulse indicator
- **Mobile Optimized** — Safe area adaptation, touch-friendly sizing

---

## ✦ Technical Architecture

### Four-Layer Separation

```
┌─────────────────────────────────────────────────────────────┐
│                    ✦  UI Layer  ✦                           │
│                                                             │
│  React 19 · Glassmorphism · Starfield · BurnTimer           │
│  Component-based · Hook-driven · Responsive                 │
├─────────────────────────────────────────────────────────────┤
│                    ✦  Business Logic  ✦                     │
│                                                             │
│  Room Management · Message Manager · Burn Strategies        │
│  Event-driven · Type-safe                                   │
├─────────────────────────────────────────────────────────────┤
│                    ✦  Communication  ✦                      │
│                                                             │
│  Trystero · WebRTC P2P · BitTorrent / MQTT Dual Signaling   │
│  E2E Encryption · Auto-reconnect · Strategy Fallback        │
├─────────────────────────────────────────────────────────────┤
│                    ✦  Persistence  ✦                        │
│                                                             │
│  IndexedDB · JSON Backup Export/Import · Data Cleanup       │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack Details

| Layer | Technology | Version | Description |
|---|---|---|---|
| Frontend | React | 19 | Component-based UI, Hook-driven |
| Type System | TypeScript | 6 | Compile-time type checking |
| Build Tool | Vite | 8 | Fast HMR and build |
| Communication | Trystero | 0.25 | Serverless WebRTC P2P |
| Signaling | BitTorrent + MQTT | — | Dual channel auto-fallback |
| Storage | idb (IndexedDB) | 8 | Browser local persistence |
| Styling | CSS Variables + Glassmorphism | — | Liquid glass effect |

---

## ✦ Quick Start

### Requirements

- Node.js >= 18
- npm / yarn / pnpm

### Get Started in 3 Steps

```bash
# 1. Clone the repository
git clone https://github.com/xiaoyu-hue/Nymir.git
cd Nymir

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open `http://localhost:5173` in your browser.

### Production Build

```bash
npm run build    # Build to dist/
npm run preview  # Preview production build
```

### Deploy as Static Site

Build output is in the `dist/` directory, ready for static hosting:

| Platform | Deployment |
|---|---|
| **GitHub Pages** | Push `dist/` to `gh-pages` branch |
| **Vercel** | Connect repo, auto-build and deploy |
| **Netlify** | Connect repo, build command `npm run build` |
| **Cloudflare Pages** | Connect repo, build output dir `dist` |

---

## ✦ Project Structure

```
src/
│
├── communication/              # 📡 Communication Layer
│   ├── peer.ts                #   PeerManager — connection, channels, reconnect, fallback
│   └── types.ts               #   Communication type definitions
│
├── persistence/                # 💾 Persistence Layer
│   ├── db.ts                  #   IndexedDB CRUD wrapper
│   ├── backup.ts              #   JSON backup export / import
│   └── types.ts               #   Storage type definitions
│
├── core/                       # 🧠 Business Logic Layer
│   ├── types.ts               #   Message, BurnMode, RoomInfo core types
│   ├── burn.ts                #   Burn strategy calculation engine
│   ├── message.ts             #   Message send/receive + burn scheduling
│   └── room.ts                #   Room management + reconnection logic
│
├── ui/                         # 🎨 UI Layer
│   ├── components/            #   React components
│   │   ├── Starfield.tsx      #     Starfield background
│   │   ├── GlassCard.tsx      #     Glass card (3 variants)
│   │   ├── MessageBubble.tsx  #     Message bubble (with burn animation)
│   │   ├── BurnTimer.tsx      #     Burn countdown indicator
│   │   ├── ChatView.tsx       #     Main chat interface
│   │   ├── RoomPanel.tsx      #     Room create/join panel
│   │   └── BackupPanel.tsx    #     Data backup panel
│   ├── styles/                #   CSS styles
│   │   ├── globals.css        #     Global styles + CSS variables
│   │   ├── glass.css          #     Glassmorphism styles
│   │   └── starfield.css      #     Starfield animations
│   └── hooks/                 #   React Hooks
│       ├── useRoom.ts         #     Room state hook
│       └── useMessages.ts     #     Messages state hook
│
├── utils/                      # 🔧 Utilities
│   ├── id.ts                  #   Anonymous ID / room code generation
│   ├── time.ts                #   Time formatting / countdown
│   └── crypto.ts              #   Crypto helpers (reserved)
│
├── App.tsx                     # Root component
├── main.tsx                    # Entry point
└── index.html                  # HTML template
```

---

## ✦ How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  1. Open App │────►│  2. Create/  │────►│  3. Select  │
│             │     │  Join Room   │     │    Mode     │
│  Starfield  │     │  6-digit code│     │ Burn/Timer  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
       ┌─────────────┐     ┌─────────────┐     │
       │  5. Leave    │◄────│  4. Chat    │◄────┘
       │    Room      │     │  Anonymously │
│  Data stays    │     │  P2P E2E   │
│  local         │     │  Encrypted  │
└─────────────┘     └─────────────┘
```

---

## ✦ Security & Privacy

### Security Features

- ✅ **End-to-End Encryption** — WebRTC data channels use DTLS encryption
- ✅ **P2P Direct** — Messages do not pass through central servers
- ✅ **No Logging** — Does not actively record user behavior
- ✅ **Local Storage** — Data primarily exists on user devices
- ✅ **Read-once Burn** — Messages auto-destroy after being viewed
- ✅ **Timed Burn** — Customizable countdown destruction

### Security Considerations

- Messages are transmitted in **plaintext before P2P connection** is established (signaling phase)
- Read-once messages may **briefly exist in recipient's device memory**
- Browser cache may retain some data; consider periodic cleanup
- Private browsing mode is recommended for better anonymity

---

## ✦ Design Principles

| Principle | Practice |
|---|---|
| **Privacy First** | No central server, no tracking, E2E encryption |
| **Data Sovereignty** | Data stored locally, export supported |
| **Modular** | Communication/Logic/UI/Storage fully separated |
| **Extensible** | New burn strategies can be added easily |
| **Stability** | Reconnection + dual signaling fallback |
| **Progressive Enhancement** | Core features work, advanced features optional |
| **Minimal Dependencies** | Only essential dependencies used |

---

## ✦ Roadmap

### Completed ✅

- [x] P2P real-time communication (WebRTC + BitTorrent)
- [x] Three read-and-burn modes
- [x] Glassmorphism UI + starfield animations
- [x] Local data storage + JSON backup
- [x] MQTT signaling fallback
- [x] Auto-reconnection
- [x] Mobile optimization

### Planned 🚀

- [ ] Enhanced E2E encryption (AES-256)
- [ ] Image/file sharing
- [ ] Voice messages
- [ ] Read receipts
- [ ] PWA support (offline capable)
- [ ] App packaging (Capacitor / Tauri)
- [ ] Message recall
- [ ] Enhanced group management
- [ ] Multi-language support

---

## ✦ FAQ

<details>
<summary><b>Q: Do I need to register an account?</b></summary>
<br>
No. Nymir requires no registration — just open and use. A random anonymous ID is generated on each connection.
</details>

<details>
<summary><b>Q: Are messages stored on servers?</b></summary>
<br>
No. Nymir has no central server. Messages are transmitted via WebRTC P2P and stored locally in the browser.
</details>

<details>
<summary><b>Q: Is read-once burn secure?</b></summary>
<br>
Read-once messages are deleted from both devices after being viewed. However, note that the recipient could take a screenshot, and plaintext may briefly exist in browser memory.
</details>

<details>
<summary><b>Q: Can devices on different networks connect?</b></summary>
<br>
Yes. Through BitTorrent Tracker and MQTT Broker for signaling exchange, devices on different networks can establish P2P connections. LAN connections are typically faster.
</details>

<details>
<summary><b>Q: What if data is lost?</b></summary>
<br>
Use the backup button (bottom-right) to export a JSON file. If data is lost, it can be restored via the import feature. Regular backups are recommended.
</details>

---

## ✦ License

This project is licensed under the [GNU Affero General Public License v3.0](./LICENSE).

AGPL-3.0 was chosen because Nymir focuses on privacy and decentralization. AGPL ensures that derivative works (including network service deployments) also remain open source.

---

## ✦ Acknowledgments & Credits

This project builds on the shoulders of these excellent open source projects:

### Core Dependencies

| Project | License | Purpose |
|---|---|---|
| [Trystero](https://github.com/dmotz/trystero) | MIT | Serverless WebRTC P2P communication engine |
| [React](https://react.dev) | MIT | Frontend UI framework |
| [Vite](https://vite.dev) | MIT | Build tool and dev server |
| [TypeScript](https://www.typescriptlang.org) | Apache-2.0 | Type-safe JavaScript superset |
| [idb](https://github.com/nicedoc/idb) | ISC | IndexedDB Promise wrapper |

### Inspiration

| Project | Description |
|---|---|
| [Chitchatter](https://github.com/jeremyckahn/chitchatter) | P2P chat app built on Trystero |
| [n2-mesh](https://github.com/BartoszOsiej/n2-mesh) | WebRTC + MQTT zero-dependency P2P network |

### Signaling Infrastructure

| Service | Description |
|---|---|
| BitTorrent Trackers | Global distributed signaling channel |
| [HiveMQ MQTT Broker](https://www.hivemq.com/public-mqtt-broker/) | Signaling fallback channel |

---

## ✦ Contributing

Contributions are welcome! Please read the [Code of Conduct](./CODE_OF_CONDUCT.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

---

## ✦ Code of Conduct

This project follows the [Contributor Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to abide by its terms.

---

<div align="center">

<img src="https://img.shields.io/badge/Your_Data-Your_Sovereignty-7c6aef?style=for-the-badge&logo=shield&logoColor=white" alt="your data your sovereignty">

<br>

*Nymir — Let secrets stay with you*

</div>
