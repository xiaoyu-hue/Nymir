<div align="center">

<img src="https://img.shields.io/badge/version-1.0.0-7c6aef?style=for-the-badge" alt="version">
<img src="https://img.shields.io/badge/license-AGPL--3.0-22c55e?style=for-the-badge" alt="license">

**English · [中文](./README.md)**

# ✦ Nymir

**P2P Anonymous Chat · Read-and-Burn · Data Stays Local**

> *Your data, your sovereignty. Let secrets stay with you.*

<br>

**[🔗 Try it online](https://nymir.xyyovo520.workers.dev/) · [GitHub Pages](https://xiaoyu-hue.github.io/Nymir/)**

[![React](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=white&style=flat-square)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript_6-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite_8-646CFF?logo=vite&logoColor=white&style=flat-square)](https://vite.dev)
[![Trystero](https://img.shields.io/badge/Trystero-P2P-FF6B35?style=flat-square)](https://github.com/dmotz/trystero)
[![WebRTC](https://img.shields.io/badge/WebRTC-Encrypted-0F9D58&style=flat-square)](https://webrtc.org)

</div>

---

## ✦ What is Nymir?

In an era where data is widely collected and analyzed, **privacy** is becoming increasingly valuable.

Nymir is a **P2P-based anonymous instant messaging tool**. Messages are transmitted directly between user devices through **WebRTC end-to-end encryption**, with data stored in your own browser. No cloud servers, no account system, no registration required.

Messages can be set to **read-and-burn** — automatically destroyed after being viewed, minimizing digital footprints.

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   ┌─────────┐        P2P Encrypted        ┌─────────┐      │
│   │         │ ◄───── Channel ──────► │         │      │
│   │  User A  │   WebRTC · E2E Encrypted   │  User B  │      │
│   │         │    No Cloud Server Storage   │         │      │
│   └─────────┘                           └─────────┘      │
│                                                              │
│   · Messages sent directly between devices                  │
│   · End-to-end encrypted, harder for third parties          │
│   · Data tends to be cleared when leaving a room            │
│   · Data primarily exists on your device                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### ⚠️ Accurate Description: Is Nymir "Decentralized"?

Nymir is **NOT fully decentralized**. Here is the honest breakdown:

| Layer | Decentralized? | Details |
|-------|---------------|---------|
| **Data Storage** | ✅ Yes | IndexedDB, purely local, no cloud |
| **Message Transport** | ✅ Yes | P2P direct, no server relay |
| **End-to-End Encryption** | ✅ Yes | X25519 + AES-256-GCM, keys never leave device |
| **Peer Discovery / Signaling** | ❌ No | Relies on public MQTT Broker & WebTorrent Trackers |
| **Identity System** | ⚠️ Pseudonymous | Anonymous nicknames generated locally, but P2P connection requires signaling servers |

**Key dependency**: Peer "discovery" and "connection establishment" rely on public signaling infrastructure (MQTT Brokers, WebTorrent Trackers). If all of these services go offline simultaneously, new devices cannot discover each other. However, once connected, messages are P2P direct and end-to-end encrypted.

A more accurate description: **Serverless + Local-first + P2P Communication**.

---

## ✦ Why Choose Nymir?

| Feature | Nymir | Traditional Chat Apps |
|---|---|---|
| **Cloud Servers** | None (P2P direct) | Yes (stores your data) |
| **Registration** | No registration needed | Requires phone/email |
| **Data Storage** | 📱 Your device | 🏢 Their servers |
| **Encryption** | 🔐 End-to-end P2P | 🔑 Server can decrypt |
| **Backup** | 💾 Encrypted JSON export | Usually not available |
| **Burn Messages** | 🔥 Read-and-burn | Generally stored forever |
| **Tracking** | No tracking | Commonly present |
| **Open Source** | ✅ AGPL-3.0 | Mostly closed source |
| **Peer Discovery** | ⚠️ Relies on public signaling | N/A |

---

## ✦ Core Features

### 🔒 Anonymous & Private

- **No Registration** — No phone number, email, or personal info required
- **Random Identity** — Anonymous ID generated on each connection
- **End-to-End Encryption** — WebRTC direct + X25519 key exchange + AES-256-GCM
- **No Data Collection** — No analytics, no tracking, no behavior logging

```
Your message route:
You ──► Encrypt ──► P2P Direct ──► Decrypt ──► Recipient
              ↑                     ↑
         Hard to intercept    Hard to intercept
         (no cloud server)
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

### 🌐 P2P Communication Architecture

Nymir's communication architecture uses a **multi-layer fallback strategy** to improve connection reliability:

```
Priority 1 ──► BitTorrent Signaling (public trackers)
   │
   │  5s no response
   ▼
Priority 2 ──► MQTT Signaling (public broker)
   │
   │  Connection established
   ▼
Priority 3 ──► WebRTC P2P Direct (end-to-end encrypted)

Auto-reconnect ──► Up to 5 attempts, 3s interval
```

> ⚠️ During the signaling phase (before P2P connection is established), messages are transmitted in plaintext. After connection, all messages are encrypted via WebRTC DTLS.

### 💾 Data Sovereignty

Your data is **primarily under your control**:

- 📱 **Local Storage** — Data stored in browser IndexedDB
- 📦 **Export Backup** — One-click encrypted JSON export (AES-256-GCM)
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
│  File Transfer · Offline Queue · NAT Detection · Monitoring  │
├─────────────────────────────────────────────────────────────┤
│                    ✦  Persistence  ✦                        │
│                                                             │
│  IndexedDB · Encrypted JSON Backup Export/Import · Cleanup   │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack Details

| Layer | Technology | Version | Description |
|---|---|---|---|
| Frontend | React | 19.2.8 | Component-based UI, Hook-driven |
| Type System | TypeScript | 6.0.2 | Compile-time type checking |
| Build Tool | Vite | 8.2.2 | Fast HMR and build |
| Communication | Trystero | 0.25.4 | Serverless WebRTC P2P |
| Signaling | BitTorrent + MQTT | — | Dual channel auto-fallback |
| Storage | idb (IndexedDB) | 8.0.3 | Browser local persistence |
| E2E Encryption | X25519 + AES-256-GCM | — | Key exchange + symmetric encryption |
| Digital Signature | Ed25519 | — | Message integrity verification |
| Styling | CSS Variables + Glassmorphism | — | Liquid glass effect |
| PWA Support | vite-plugin-pwa | 1.3.0 | Progressive Web App |
| Linting | oxlint | 1.79.0 | Fast JavaScript/TypeScript linter |
| Testing | vitest | 5.0.0 | Vite-native test framework |

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

## ✦ Security & Privacy

### Security Features

- ✅ **End-to-End Encryption** — X25519 key exchange + AES-256-GCM symmetric encryption
- ✅ **Forward Secrecy** — HKDF per-message key derivation
- ✅ **Message Signatures** — Ed25519 digital signatures for integrity verification
- ✅ **P2P Direct** — Messages do not pass through cloud servers
- ✅ **Local Storage** — Data primarily exists on user devices
- ✅ **Read-once Burn** — Messages auto-destroy after being viewed
- ✅ **Encrypted Backup** — Backup files encrypted with AES-256-GCM

### Security Considerations

- **Signaling phase** (before P2P connection) messages are transmitted in plaintext
- Read-once messages may **briefly exist in recipient's device memory**
- Browser cache may retain some data; consider periodic cleanup
- **Forgot password = permanent data loss** — remember it!
- Private browsing mode is recommended for better anonymity

### Known Limitations

- **Peer discovery relies on public signaling infrastructure** — MQTT Brokers and WebTorrent Trackers are third-party public services, not fully decentralized
- **No encryption during signaling** — Messages before P2P connection establishment are unencrypted
- **No persistent online status** — Messages cannot be received when a device is offline

---

## ✦ Design Principles

| Principle | Practice |
|---|---|
| **Privacy First** | No cloud server, no tracking, E2E encryption |
| **Data Sovereignty** | Data stored locally, encrypted backups exportable |
| **Honest & Transparent** | Accurate architecture description, no exaggerated "decentralization" claims |
| **Modular** | Communication/Logic/UI/Storage fully separated |
| **Stability** | Reconnection + dual signaling fallback |
| **Minimal Dependencies** | Only essential dependencies used |

---

## ✦ Roadmap

### Completed ✅

- [x] P2P real-time communication (WebRTC + BitTorrent)
- [x] Three read-and-burn modes
- [x] Glassmorphism UI + starfield animations
- [x] Local data storage + encrypted JSON backup
- [x] MQTT signaling fallback
- [x] Auto-reconnection
- [x] Mobile optimization
- [x] Message recall
- [x] Multi-language support (Chinese / English)
- [x] PWA support (offline capable)
- [x] Read receipts
- [x] E2E encryption (X25519 + AES-256-GCM)
- [x] Message digital signatures (Ed25519)
- [x] Forward secrecy (HKDF per-message keys)
- [x] Local password lock screen (PBKDF2 + AES-256-GCM)
- [x] Pseudonym system (per-user/per-room anonymous nicknames)
- [x] Traffic obfuscation (random noise messages, no identifiable markers)
- [x] Secure deletion (localStorage overwrite)
- [x] Encrypted backup (AES-256-GCM, .nymir files)
- [x] Accessibility (ARIA roles, focus-visible, label associations)
- [x] SEO (Open Graph, Twitter Card, noscript fallback)
- [x] UI/UX micro-interaction system + responsive adaptation
- [x] File transfer (image/file E2EE transfer, chunked transfer, progress callback)
- [x] Offline message queue (failed message caching, auto-resend when peer comes online)
- [x] NAT type detection (WebRTC ICE candidate type detection, optimized P2P connections)
- [x] Connection quality monitoring (latency, uptime, message statistics, quality rating)

### Planned 🚀
- [ ] Message search
- [ ] Voice messages
- [ ] Multi-device sync (WebRTC direct transfer)
- [ ] Custom themes (light mode / custom color schemes)
- [ ] App packaging (Capacitor / Tauri)
- [ ] Decentralized identity (eliminate signaling dependency)
- [ ] Enhanced group management (admin/kick/mute)

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
No. Nymir has no cloud server. Messages are transmitted via WebRTC P2P and stored locally in the browser. However, peer discovery (finding the other device) relies on public signaling servers.
</details>

<details>
<summary><b>Q: Is Nymir a decentralized app?</b></summary>
<br>
Partially. Data storage and message transport are decentralized (P2P direct + local storage), but peer discovery relies on public signaling servers (MQTT Broker / WebTorrent Tracker), so it is NOT fully decentralized. A more accurate description is "serverless + local-first + P2P communication."
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
Use the backup button (bottom-right) to export an encrypted JSON file. If data is lost, it can be restored via the import feature. Regular backups are recommended.
</details>

---

## ✦ License

This project is licensed under the [GNU Affero General Public License v3.0](./LICENSE).

AGPL-3.0 was chosen because Nymir focuses on privacy and local-first architecture. AGPL ensures that derivative works (including network service deployments) also remain open source.

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
| [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) | MIT | Vite PWA support plugin |
| [vitest](https://vitest.dev) | MIT | Vite-native test framework |
| [oxlint](https://oxc-project.github.io) | MIT | Fast JavaScript/TypeScript linter |

### Inspiration

| Project | Description |
|---|---|
| [Chitchatter](https://github.com/jeremyckahn/chitchatter) | P2P chat app built on Trystero |
| [n2-mesh](https://github.com/BartoszOsiej/n2-mesh) | WebRTC + MQTT zero-dependency P2P network |

### Signaling Infrastructure

| Service | Description | Decentralized? |
|---|---|---|
| BitTorrent Trackers | Global distributed signaling channel | ✅ Distributed |
| [EMQX MQTT Broker](https://www.emqx.io) | Signaling fallback channel | ❌ Public server |

---

## ✦ Contributing

Contributions are welcome! Please read the [Code of Conduct](./CODE_OF_CONDUCT.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

---

<div align="center">

<img src="https://img.shields.io/badge/Your_Data-Your_Sovereignty-7c6aef?style=for-the-badge&logo=shield&logoColor=white" alt="your data your sovereignty">

<br>

*Nymir — Let secrets stay with you*

</div>
