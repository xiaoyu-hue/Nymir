<div align="center">

<img src="https://img.shields.io/badge/version-1.0.0-7c6aef?style=for-the-badge" alt="version">
<img src="https://img.shields.io/badge/license-AGPL--3.0-22c55e?style=for-the-badge" alt="license">

**English · [中文](./README.md)**

# ✦ Nymir

> ⚠️ **Important Notice**: This project is developed with AI assistance, by an individual author with zero programming background. The code has NOT undergone a professional security audit. **It is NOT recommended for real sensitive scenarios** (such as high-risk communication, important data storage, etc.). If you need to use it for such scenarios, please conduct a professional security assessment first.

**P2P anonymous chat · Read-and-burn · Local-first**

> *Your data stays on your device. Privacy first, local storage.*

<br>

**[🔗 Live demo](https://nymir.xyyovo520.workers.dev/) · [GitHub Pages](https://xiaoyu-hue.github.io/Nymir/)**

</div>

---

## ✦ What is Nymir?

Nymir is a **P2P anonymous messenger**. Messages travel **end-to-end encrypted over WebRTC** between devices and live primarily in browser storage. No application cloud database, no accounts.

### Is it fully decentralized?

**No.** Storage and chat transport are local/P2P; **peer discovery depends on public MQTT / WebTorrent signaling**.

More accurate: **serverless + local-first + P2P messaging**.

### A message's journey

On send: plaintext → AES-256-GCM encrypt → Ed25519 sign → send over P2P channel.
On receive: verify signature → decrypt → encrypt fields, then write to local IndexedDB.
Encryption and signing happen entirely in your browser. Intermediate nodes (including public signaling) only see ciphertext and signatures, never plaintext.

---

## ✦ Security & Privacy

### Security Features

- ✅ **Session message E2EE** — X25519 key agreement + AES-256-GCM (signaling/setup phase excluded, see Known Limitations)
- ✅ **Per-message keys** — HKDF derived per message, different keys for different messages
- ✅ **Encrypt-then-sign** — Ed25519 over ciphertext; verification failure means no display
- ✅ **Visible signature failures** — shown on the bubble, never silent
- ✅ **P2P Direct** — no app-server message store
- ✅ **Encrypted local storage** — IndexedDB field-level encryption (AES-256-GCM, password-derived key)
- ✅ **Read-once / timed burn**
- ✅ **Encrypted Backup** — AES-256-GCM

### Security Considerations

- **TOFU**: a MITM on **first** key exchange cannot be detected by the protocol alone
- Read-and-burn does not stop screenshots or copy-paste
- **Forgot lock-screen password** may mean permanent loss of locally encrypted data

### Known Limitations

- **Peer discovery depends on public signaling** — metadata may be visible to signaling parties
- **Signaling / setup is not an E2EE channel**
- **No server-side offline inbox**
- **Automatic key rotation is currently disabled** — per-message HKDF remains; verifiable rotation is on the roadmap
- **Pseudonyms are device-local**
- **Realtime depends on browser and NAT**
- **Public-key exchange over public signaling, no out-of-band fingerprint check** — TOFU pins the first key; a MITM who injects a fake key **on first contact** cannot be detected by the protocol alone; no safety-number / QR verification
- **Traffic obfuscation is weak** — noise about every 30 seconds with a fixed ~48-byte payload; regular interval and size can themselves be a fingerprint; **does not** resist serious traffic analysis

### When Nymir is NOT a good fit

To be honest, Nymir is not a universal privacy tool. Please think twice or choose more specialized software in these scenarios:

- **High-risk communication** (journalists, activists, whistleblowers facing state-level adversaries) — weak traffic obfuscation, TOFU vulnerability, no offline inbox; not suitable against serious traffic analysis
- **Long-term retention of important records** — read-and-burn actively destroys messages; if you forget the lock-screen password, locally encrypted data is **permanently unrecoverable**
- **Multi-device / cross-device sync** — no multi-device sync currently; messages only live in the current browser
- **Public or shared devices** — local data lives in the browser profile; anyone using the same browser can access it (unless a lock-screen password is set)

---

## ✦ Roadmap

### Completed

- [x] P2P realtime, read-and-burn, local storage, encrypted backup
- [x] E2EE, encrypt-then-sign, per-message HKDF, visible verify failures
- [x] localStorage key removal (**`removeItem` only**; no overwrite; browsers do not guarantee physical erase)
- [x] CI test gate (typecheck + lint + test)

### Planned

- [ ] Verifiable key rotation with TOFU re-pin
- [ ] Search, voice, multi-device sync
- [ ] Reduce reliance on public signaling

---

## ✦ Quick start

```bash
git clone https://github.com/xiaoyu-hue/Nymir.git
cd Nymir && npm install && npm run dev
```

---

## ✦ License

[AGPL-3.0](./LICENSE)

## ✦ Acknowledgments & Dependencies

Nymir stands on the shoulders of these open-source projects. Without them, a zero-programming-background author could not have built this.

### Runtime dependencies

| Project | License | Notes |
|---------|---------|-------|
| [React](https://react.dev) | MIT | UI framework |
| [React DOM](https://react.dev) | MIT | DOM rendering |
| [@trystero-p2p/mqtt](https://www.npmjs.com/package/@trystero-p2p/mqtt) | MIT | P2P signaling (MQTT channel) |
| [@trystero-p2p/torrent](https://www.npmjs.com/package/@trystero-p2p/torrent) | MIT | P2P signaling (WebTorrent channel) |
| [idb](https://github.com/jakearchibald/idb) | ISC | IndexedDB wrapper |

### Development & tooling

| Project | License | Notes |
|---------|---------|-------|
| [TypeScript](https://www.typescriptlang.org) | Apache-2.0 | Type system |
| [Vite](https://vite.dev) | MIT | Build tool |
| [Vitest](https://vitest.dev) | MIT | Test framework (179 tests) |
| [Oxlint](https://oxc.rs) | MIT | Linter (CI gate) |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app) | MIT | PWA support (installable, offline-capable) |
| [jsdom](https://github.com/jsdom/jsdom) | MIT | DOM test environment |
| [@testing-library/react](https://testing-library.com) | MIT | React component testing |

### Special thanks

- **WebCrypto API** (W3C standard, built into browsers) — X25519 key agreement, AES-256-GCM encryption, HKDF key derivation, and Ed25519 signing all rely on it. Nymir does not implement any cryptographic primitives itself; it only calls the browser's audited built-in implementation.
- **Everyone who contributes code, documentation, and time to the open-source community.**

## ✦ Contributing

See [Code of Conduct](./CODE_OF_CONDUCT.md) and [AGENTS.md](./AGENTS.md).

About the author: [AUTHOR.en.md](./docs/AUTHOR.en.md). All project docs: [docs/](./docs/README.md).

---

*Nymir — keep secrets yours*
