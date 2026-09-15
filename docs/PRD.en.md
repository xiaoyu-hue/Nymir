# Nymir Product Requirements Document (PRD)

> Version: v1.5.0
> Status: v1.5.0 is the current development version (see [CHANGELOG.md](../CHANGELOG.md))
> Document principle: this document describes the **current implementation's** product behavior and security boundary and stays in sync with the code. The security capability boundary is defined by [THREAT_MODEL.md](./THREAT_MODEL.md) — never claim capabilities beyond the implementation.

---

## 1. Product Goal & Use Cases

### Product Goal

Nymir (树洞 / "Tree Hollow") is a **P2P anonymous instant messaging tool**: messages travel directly between users' devices over WebRTC with end-to-end encryption, and data is stored only in your own browser's IndexedDB. No account system, no business server, no sign-up. Its honest positioning is **"no business server + local-first + P2P communication"** (it is **not** fully decentralized — peer discovery relies on public MQTT / WebTorrent signaling).

### Use Cases

- Chat anonymously with someone — no business server in the middle, no account required.
- Burn after reading: messages can be configured as "destroy after one read / destroy after a timer / keep forever".
- Migrate across devices: export/import an encrypted backup to restore chats and identity.
- Avoid message content and metadata collection by mainstream chat tools.

### Core Principles

1. **Local-first**: message plaintext and key material exist only on the user's device; refreshing/restarting does not lose them (persistent identity).
2. **End-to-end encryption**: session messages travel as ciphertext; intermediate nodes (including public signaling) see only ciphertext and signatures.
3. **Honest boundaries**: "decentralization" and "anonymity" are described truthfully — TOFU, public signaling, and weak traffic obfuscation are disclosed in README and the threat model.
4. **No-code author + AI-assisted development**: security-critical code must be auditable, tested, and documented.

---

## 2. Core Concepts

| Concept | Description |
| --- | --- |
| **Room** | A chat session with id, name, creation time, and peer list (`RoomInfo`). |
| **Message** | A chat message: id, content, sender, timestamp, burn config, read list, destroyed state; includes `verified` (signature verification result) and `decryptFailed` flags. |
| **Burn** | Four modes (`BurnMode`): `read_once` destroy after read / `timed` destroy after N seconds (burnAfter) / `scheduled` destroy at a time (burnAt) / `persist` keep forever. |
| **E2EE** | X25519 key agreement + per-message HKDF-derived keys + AES-256-GCM; encrypt-then-sign (Ed25519 signs the ciphertext). |
| **Safety Code (Fingerprint)** | A human-comparable fingerprint derived from both public keys: 15 digits + 7 emoji, verified over an out-of-band channel to detect man-in-the-middle (TOFU mitigation). |
| **Lock Screen** | Access passphrase for local encrypted data: PBKDF2 (600k iterations) derived key + AES-256-GCM field-level encryption of IndexedDB. |
| **Pseudonym** | In-session identity, loosely bound to the device. |

---

## 3. Feature Specification

### 3.1 Chat

- Create/join a room and establish a WebRTC P2P data channel with peers.
- Send text messages over the E2EE channel; signature/decryption failures are explicitly marked in the UI (never silently shown).
- Real-time bidirectional messaging; when a peer is offline, messages enter the **offline queue** (`communication/offlineQueue.ts`) and are re-sent on reconnect.
- Connection quality monitoring (`communication/monitor.ts`) via ping/pong heartbeat (timestamps only, unencrypted — a known limitation).

### 3.2 Burn After Reading

- Choose one of four modes before sending; `read_once` destroys automatically after the peer reads it (both views); `timed`/`scheduled` destroy on schedule; `persist` keeps forever.
- Destruction runs locally in IndexedDB and on the peer's device (protocol best-effort — screenshots/copies cannot be prevented).

### 3.3 Safety Code Verification

- The shield icon in the chat header shows the shared fingerprint (15 digits + 7 emoji).
- Users verify it over an out-of-band channel; after verification the fingerprint is **pinned**, and public-key changes trigger a red warning.
- Unverified first exchange remains subject to the TOFU weakness (threat model §4.2).

### 3.4 Lock Screen & Local Encryption

- Set a lock passphrase on first use (recommended ≥ 10 characters); unlock to use the session; auto-lock after timeout clears password material (`security/manager.ts`).
- IndexedDB is field-level encrypted (v4 format: per-install random salt + session-level derived-key cache), with v1/v2/v3 legacy decryption compatibility.
- Forgetting the passphrase = local data permanently undecryptable (by design).

### 3.5 Backup & Restore

- `persistence/backup.ts`: encrypted backup (AES-256-GCM, backup file carries its own random salt), exported as JSON; import restores with the same lock passphrase.
- Enables chat and identity migration across devices.

### 3.6 i18n

- Chinese (default) / English bilingual UI (`src/i18n/`, zh.ts / en.ts).

### 3.7 Other

- PWA: installable, offline-capable (vite-plugin-pwa).
- Install prompt (InstallPrompt), error boundary (ErrorBoundary) and degraded UI.
- Starfield background and glass-card visual style.

---

## 4. Data & Storage

- **Primary store**: IndexedDB (`persistence/db.ts`, idb wrapper), field-level encrypted.
- **Sensitive keys**: localStorage sensitive keys are removed with `removeItem` only (no overwrite; browsers do not guarantee physical erasure — see threat model §5.2).
- **Data model**: `RoomInfo` / `Message` / `BurnConfig` (see `src/core/types.ts`); messages carry `verified` / `decryptFailed` / `destroyed` state flags.

---

## 5. Security Boundary (aligned with the threat model)

**Committed** (backed by implementation and tests):
- Session-message E2EE (X25519 + per-message HKDF + AES-256-GCM)
- Ciphertext signing (encrypt-then-sign) and visible verification failure
- Field-level local encryption (PBKDF2-600k + AES-256-GCM, v4 per-install salt)
- Non-extractable private keys (`extractable: false`)
- Out-of-band safety code verification (15 digits + 7 emoji, pinned with re-key warning)

**Not committed / known limitations** (must not be claimed in docs or marketing):
- Resistance against state-level traffic analysis and long-term metadata correlation
- Preventing the peer from screenshots/copies/secondary forwarding
- Fully decentralized peer discovery (depends on public signaling; signaling/handshake phase is not an E2EE channel)
- Physical anti-forensic erasure
- Automatic key rotation (currently off; per-message HKDF still applies)

The full threat boundary is in [THREAT_MODEL.md](./THREAT_MODEL.md).

---

## 6. Explicitly Out of Scope / Later

- Server-side offline inbox (no cloud storage).
- Real-time multi-device sync (currently backup export/import migration only).
- Account system, registration, username search.
- Message search (roadmap), voice messages (roadmap), verifiable key rotation (roadmap).
- Reducing reliance on public signaling (roadmap).
- No "fully anonymous / fully decentralized" marketing claims.

---

## 7. Acceptance Criteria (actually checkable)

1. Two browsers (possibly different devices) join the same room, exchange messages in real time; identity and history survive a refresh.
2. A `read_once` message is destroyed on both views after being read; `timed`/`scheduled` destroy on schedule; `persist` never destroys.
3. The chat shield shows 15 digits + 7 emoji; verification pins the fingerprint; peer public-key change triggers a red warning.
4. Setting a lock passphrase requires it after refresh; wrong passphrases are rejected; forgotten passphrases are unrecoverable (clearly indicated).
5. Export encrypted backup → import on another browser/device → chat history and identity restored (same lock passphrase required).
6. Tampered/forged messages (test-injected) cause visible signature-verification failure, never silent display.
7. Messages sent while offline enter the queue and are re-sent after reconnect.
8. Chinese/English switching works without missing translations.
9. Engineering gates pass: `npm run typecheck`, `npm run lint`, `npm test` (283 tests).
10. Security-related changes must not break the trust boundary declared in [THREAT_MODEL.md](./THREAT_MODEL.md).

---

## 8. Related Documents

- Architecture & file responsibilities: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Threat model & security boundary: [THREAT_MODEL.md](./THREAT_MODEL.md)
- Architecture decision records: [adr/README.md](./adr/README.md)
- Version history & evolution: [Nymir-项目版本史与架构演化.md](./Nymir-项目版本史与架构演化.md)
- Changelog: [CHANGELOG.md](../CHANGELOG.md)

*Nymir — let secrets stay yours. Capability has boundaries; honesty is the baseline.*
