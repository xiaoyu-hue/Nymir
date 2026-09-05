<div align="center">

<img src="https://img.shields.io/badge/version-1.0.0-7c6aef?style=for-the-badge" alt="version">
<img src="https://img.shields.io/badge/license-AGPL--3.0-22c55e?style=for-the-badge" alt="license">

**English · [中文](./README.md)**

# ✦ Nymir

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

---

## ✦ Security & Privacy

### Security Features

- ✅ **End-to-End Encryption** — X25519 + AES-256-GCM
- ✅ **Per-message keys** — HKDF
- ✅ **Encrypt-then-sign** — Ed25519 over ciphertext
- ✅ **Visible signature failures** — shown on the bubble
- ✅ **P2P Direct** — no app-server message store
- ✅ **Local Storage** — IndexedDB
- ✅ **Read-once / timed burn**
- ✅ **Encrypted Backup**

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

### Core dependencies

| Project | License | Notes |
|---------|---------|-------|
| [React](https://react.dev) | MIT | UI |
| [Vite](https://vite.dev) | MIT | Build |
| [Trystero](https://github.com/dmotz/trystero) | MIT | P2P |
| [TypeScript](https://www.typescriptlang.org) | Apache-2.0 | Types |
| [idb](https://github.com/jakearchibald/idb) | ISC | IndexedDB wrapper |

## ✦ Contributing

See [Code of Conduct](./CODE_OF_CONDUCT.md) and [AGENTS.md](./AGENTS.md).

---

*Nymir — keep secrets yours*
