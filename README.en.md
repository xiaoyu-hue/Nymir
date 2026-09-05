<div align="center">

<img src="https://img.shields.io/badge/version-1.0.0-7c6aef?style=for-the-badge" alt="version">
<img src="https://img.shields.io/badge/license-AGPL--3.0-22c55e?style=for-the-badge" alt="license">

**English · [中文](./README.md)**

# ✦ Nymir

**P2P anonymous chat · Read-and-burn · Local-first**

> *Your data stays on your device. Privacy first, local storage.*

<br>

**[🔗 Live demo](https://nymir.xyyovo520.workers.dev/) · [GitHub Pages](https://xiaoyu-hue.github.io/Nymir/)**

[![React](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=white&style=flat-square)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript_6-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite_8-646CFF?logo=vite&logoColor=white&style=flat-square)](https://vite.dev)
[![Trystero](https://img.shields.io/badge/Trystero-P2P-FF6B35?style=flat-square)](https://github.com/dmotz/trystero)
[![WebRTC](https://img.shields.io/badge/WebRTC-E2EE-0F9D58&style=flat-square)](https://webrtc.org)

</div>

---

## ✦ What is Nymir?

In an age of pervasive data collection, **privacy** is increasingly scarce.

Nymir is a **P2P anonymous messenger**. Messages travel **end-to-end encrypted over WebRTC** between devices and live primarily in your browser storage. No application cloud database, no accounts, no registration.

Messages can be set to **read-and-burn** — optionally destroy after viewing to reduce retention.

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   ┌─────────┐        P2P encrypted path      ┌─────────┐   │
│   │         │ ◄────────────────────────────► │         │   │
│   │ User A  │   WebRTC · E2EE                │ User B  │   │
│   │         │   No app-server message store  │         │   │
│   └─────────┘                                └─────────┘   │
│                                                              │
│   · Messages go device-to-device, not through a chat server │
│   · E2EE (keys stay on device; app servers never see plaintext) │
│   · Data is primarily on your device                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### ⚠️ Accurate description: is Nymir "decentralized"?

Nymir is **not fully decentralized**. Reality by layer:

| Layer | Decentralized? | Notes |
|------|----------------|-------|
| **Data storage** | Yes | IndexedDB local, no app cloud DB |
| **Message transport** | Yes | P2P after connection |
| **E2EE** | Yes | X25519 + AES-256-GCM; keys stay on device |
| **Peer discovery / signaling** | No | Public MQTT brokers & WebTorrent trackers |
| **Identity** | Semi-anonymous | Local pseudonyms; signaling still required to meet |

**Critical dependency**: discovering and establishing peers relies on public signaling. If those services are all down, new devices cannot meet. After a connection exists, chat content is P2P and E2EE.

More accurate label: **serverless + local-first + P2P messaging**.

---

## ✦ Why Nymir?

| Dimension | Typical IM | Nymir |
|-----------|------------|-------|
| Storage | Cloud server | Your device |
| Path | Via server | P2P between devices |
| Accounts | Phone / email | None |
| Encryption | Product-dependent | E2EE by default |
| Destruction | Server policy | Client read-and-burn |

---

## ✦ Core features

### Anonymous & private

- No registration
- Per-room local pseudonyms
- End-to-end encryption
- Data stays mostly on-device

### Read-and-burn

- Persist / read-once / timed destroy

### P2P architecture

- WebRTC + BitTorrent / MQTT signaling fallback
- Reconnect and limited offline retry

### Data sovereignty

- IndexedDB + encrypted JSON backup import/export

### UI

- Dark glass UI, mobile-friendly, PWA

---

## ✦ Architecture

Four layers: `src/ui` · `src/core` · `src/communication` · `src/security` · `src/persistence`.

Stack: React 19, TypeScript, Vite, Trystero/WebRTC, WebCrypto (X25519, Ed25519, AES-GCM, HKDF, PBKDF2), IndexedDB.

---

## ✦ Quick start

Node 20+. Modern browser with WebRTC / WebCrypto.

```bash
git clone https://github.com/xiaoyu-hue/Nymir.git
cd Nymir
npm install
npm run dev
```

Production: `npm run build` → deploy `dist/` to any static host.

---

## ✦ Security & Privacy

### Security Features

- ✅ **End-to-End Encryption** — X25519 key exchange + AES-256-GCM symmetric encryption
- ✅ **Per-message keys** — HKDF derives a key per message to limit blast radius of a single key leak
- ✅ **Encrypt-then-sign** — Ed25519 signatures over ciphertext (not plaintext), blocking offline guess-and-verify on short messages
- ✅ **Visible signature failures** — Failed verification is shown on the bubble; messages are not silently treated as trusted
- ✅ **P2P Direct** — Chat payloads are not stored on an application cloud server
- ✅ **Local Storage** — Data primarily lives in the browser (IndexedDB)
- ✅ **Read-once / timed burn** — Configurable destruction after read or after a timer
- ✅ **Encrypted Backup** — Backup files encrypted with AES-256-GCM

### Security Considerations

- **Trust on first use (TOFU)**: on the first public-key exchange, a MITM who injects a fake key cannot be detected by the protocol alone; later unexpected key changes in the same room are treated more strictly
- Read-once messages may **briefly exist in the recipient's device memory**; nothing stops screenshots or copy-paste on the other device
- Browser cache / OS backups may leave residual traces; evaluate the device environment for high-sensitivity use
- **Forgot lock-screen password may mean permanent loss of locally encrypted data** — remember it
- Prefer private browsing and avoid untrusted networks for sensitive chats

### Known Limitations

- **Peer discovery depends on public signaling** — MQTT brokers and WebTorrent trackers are third-party infrastructure; if they go down, new peers are hard to find. After a connection exists, chat content is P2P and E2EE, but signaling parties may still observe connection metadata
- **Signaling / session setup is not an E2EE channel** — WebRTC setup needs signaling; application chat ciphertext cannot be delivered before key exchange completes
- **No server-side offline inbox** — if the peer is offline, messages are not held on a server; local queue/retry is limited and is not a substitute for always-online centralized IM
- **Automatic key rotation is currently disabled** — to avoid long chats breaking when rotation was not fully notified to peers. Per-message HKDF remains; verifiable rotation and stronger forward secrecy are still on the roadmap
- **Pseudonyms are device-local** — clearing site data or switching devices drops local identity and TOFU pins
- **Realtime depends on browser and NAT** — strict NAT or backgrounded mobile tabs can delay or drop delivery briefly; that is an environment limit, not "the cloud already stored it"

---

## ✦ Design principles

| Principle | Practice |
|---|---|
| Privacy first | No app chat cloud, no tracking, E2EE |
| Data sovereignty | Local storage, encrypted export |
| Honest claims | No exaggerated "fully decentralized" marketing |
| Modular | Layered communication / core / UI / storage |
| Stability | Reconnect + dual signaling |

---

## ✦ Roadmap

### Completed

- [x] P2P realtime (WebRTC + BitTorrent)
- [x] Read-and-burn modes
- [x] Local storage + encrypted backup
- [x] MQTT fallback, reconnect, mobile, PWA
- [x] E2EE, Ed25519 signatures, per-message HKDF
- [x] Lock screen, pseudonyms, noise, secure delete
- [x] File transfer, offline queue, connection quality
- [x] Encrypt-then-sign + signature version field
- [x] Visible UI for signature verification failures
- [x] CI test gate (typecheck + lint + test)

### Planned

- [ ] Verifiable key rotation with TOFU re-pin
- [ ] Message search, voice, multi-device sync
- [ ] Themes, app packaging
- [ ] Decentralized identity (less public-signaling dependence)
- [ ] Stronger group admin tools

---

## ✦ FAQ

**Do messages go through your servers?**  
Not as plaintext in an app database. Chat is P2P + E2EE after peers meet. Discovery still uses public signaling.

**Is read-and-burn perfect?**  
No. It reduces retention in the UI; it cannot stop screenshots or a brief time in memory.

**Forgot password?**  
No recovery. Export backups and remember the password.

---

## ✦ License

[AGPL-3.0](./LICENSE).

Collaboration rules for AI/humans: [AGENTS.md](./AGENTS.md).

---

<div align="center">

*Nymir — keep secrets yours*

</div>
