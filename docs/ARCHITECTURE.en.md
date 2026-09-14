# Nymir Technical Architecture (Current · v1.4.0)

> This document describes the **real current structure** and stays in sync with the code. Security trust boundaries are defined in [THREAT_MODEL.md](./THREAT_MODEL.md); "why we did it this way" lives in [adr/](./adr/README.md).
> Maintenance rule: any file added/moved/changed in responsibility must be reflected here.

---

## 1. Layer Overview

```
┌───────────────────────────────────────────────────────────┐
│ UI Layer (React 19 + TS)                                   │
│   ChatView / RoomPanel / MessageBubble / LockScreen /      │
│   SafetyCheckDialog / BurnTimer / BackupPanel / Starfield  │
│   + hooks / i18n (zh/en)                                   │
└──────────────────────────────┬────────────────────────────┘
                               ↓ calls singleton managers; never touches browser low-level APIs directly
┌──────────────────────────────┴────────────────────────────┐
│ Core Business Layer (src/core/ singletons)                  │
│   MessageManager (send/receive/state/signature check)       │
│   RoomManager (rooms/connection state/events)               │
│   burn.ts (shouldDestroy/getRemainingMs)                    │
│   types.ts (Message/RoomInfo/BurnConfig models)             │
└──────────────────────────────┬────────────────────────────┘
                               ↓
┌──────────────────────────────┴────────────────────────────┐
│ Security Layer (src/security/, all WebCrypto-based;        │
│                 implements no crypto primitives)           │
│   crypto.ts (local encryption PBKDF2-600k + AES-256-GCM, v4)│
│   e2ee.ts (X25519 agreement + per-message HKDF + AES-256-GCM)│
│   sign.ts (Ed25519 ciphertext signing, encrypt-then-sign)  │
│   fingerprint.ts (15 digits + 7 emoji safety code)          │
│   noise.ts (traffic noise: ~30s fixed ~48B padding)         │
│   pseudonym.ts (anonymous id / in-room display name)        │
│   manager.ts (SecurityManager lock/unlock/auto-lock)        │
│   secureDelete.ts (localStorage sensitive-key cleanup)      │
└──────────────────────────────┬────────────────────────────┘
                               ↓
┌──────────────────────────────┴────────────────────────────┐
│ Communication Layer (src/communication/, Trystero-based)    │
│   peer.ts (PeerManager: WebRTC channels, torrent/mqtt)      │
│   offlineQueue.ts (offline queue pending→sent→delivered)    │
│   monitor.ts (connection quality, ping/pong heartbeat)      │
└──────────────────────────────┬────────────────────────────┘
                               ↓
┌──────────────────────────────┴────────────────────────────┐
│ Persistence Layer (src/persistence/)                        │
│   db.ts (IndexedDB field-level encrypted, idb wrapper)      │
│   backup.ts (encrypted backup export/import, AES-256-GCM    │
│              + self-contained random salt)                  │
└──────────────────────────────┬────────────────────────────┘
                               ↓
┌──────────────────────────────┴────────────────────────────┐
│ Browser Base                                                 │
│   WebCrypto (X25519/AES-GCM/HKDF/Ed25519/PBKDF2)             │
│   IndexedDB (local encrypted storage) · localStorage (non-   │
│   sensitive metadata)                                        │
│   WebRTC (P2P data channel) · Public signaling (MQTT/        │
│   WebTorrent)                                                │
└───────────────────────────────────────────────────────────┘
```

## 2. A Message's Journey (real path)

```
Sender: UI input → MessageManager
  → e2ee.encrypt (X25519 session key + per-message HKDF → AES-256-GCM)
  → sign.signMessage (Ed25519 signs ciphertext, encrypt-then-sign)
  → peer.send (WebRTC data channel; offline peer → offlineQueue)
  → monitor.recordMessageSent
Receiver: peer callback → MessageManager
  → verify signature (sign.ts; failure → verified=false, marked in UI)
  → e2ee.decrypt (failure → decryptFailed=true, content placeholder)
  → db.saveMessage (field-level encrypted write to IndexedDB)
  → if read_once: burn on read (both sides)
```

## 3. File Responsibilities

| File | Responsibility |
| --- | --- |
| `src/main.tsx` / `App.tsx` | React entry and top-level orchestration |
| `src/core/types.ts` | Models: `Message` (with verified/decryptFailed/destroyed), `RoomInfo`, `BurnConfig`, `BurnMode` (read_once/timed/scheduled/persist) |
| `src/core/message.ts` | `MessageManager` singleton: encrypted send/receive/state machine/signature check/destruction (MESSAGE_SIG_VERSION=2) |
| `src/core/room.ts` | `RoomManager` singleton: room lifecycle, connection state (connected/reconnecting/disconnected), events |
| `src/core/burn.ts` | Burn-after-reading pure functions: `shouldDestroy(msg)` / `getRemainingMs(msg)` |
| `src/security/crypto.ts` | Local data encryption: PBKDF2(600k)+AES-256-GCM, v4 per-install salt, v1/v2/v3 migration (`needsMigration`/`verifyPassword`/`encryptWithSalt`) |
| `src/security/e2ee.ts` | Session E2EE: X25519 keypair generation/import-export (private key extractable:false), per-message encryption |
| `src/security/sign.ts` | Ed25519 signing keypair + ciphertext sign/verify |
| `src/security/fingerprint.ts` | Safety code: both public keys → 15 digits + 7 emoji (EMOJI_TABLE of 64, independent implementation) |
| `src/security/noise.ts` | Traffic noise: periodic padding + `isNoiseMessage` detection |
| `src/security/pseudonym.ts` | Pseudonym: `getAnonymousId` / in-room display name / reset |
| `src/security/manager.ts` | `SecurityManager` lock singleton: lock/unlock/auto-lock/password-material cleanup |
| `src/security/secureDelete.ts` | localStorage sensitive-key cleanup (`clearLocalStorage`, removeItem only) |
| `src/communication/peer.ts` | `PeerManager`: Trystero channel wrapper, Strategy='torrent'|'mqtt', peer join/leave callbacks |
| `src/communication/offlineQueue.ts` | Offline message queue: pending→sent→delivered/expired/failed state machine |
| `src/communication/monitor.ts` | Connection quality: quality levels, stats, ping/pong heartbeat (plaintext, known limitation) |
| `src/persistence/db.ts` | IndexedDB read/write: saveRoom/getRoom/…/saveMessage/getMessagesByRoom/destroyMessage |
| `src/persistence/backup.ts` | Encrypted backup: `exportBackup(password)` → JSON + `downloadBackup` |
| `src/ui/components/` | Components: ChatView/RoomPanel/MessageBubble/LockScreen/SafetyCheckDialog/BurnTimer/BackupPanel/Starfield/GlassCard/ConfirmDialog/ErrorBoundary/InstallPrompt |
| `src/ui/hooks/` | React hooks (confirm, timers, etc.) |
| `src/i18n/` | zh.ts / en.ts resources + index.tsx provider |
| `src/utils/` | base64 / id / logger / random / time utilities |

## 4. Data Model (src/core/types.ts)

```ts
BurnMode = 'read_once' | 'timed' | 'scheduled' | 'persist'

Message = {
  id, content, sender, timestamp,
  burnMode, burnAfter?, burnAt?,
  readBy: string[], destroyed: boolean,
  decryptFailed?: boolean,   // decryption-failure placeholder
  verified?: boolean,        // signature check: true pass / false fail / undefined unverified
}

RoomInfo = { id, name, createdAt, peers: string[] }
BurnConfig = { mode, burnAfter?, burnAt? }
```

## 5. Key Flows

### 5.1 Send (with offline retry)
1. UI → MessageManager → e2ee encrypt → sign → PeerManager send.
2. Peer online: delivered in real time → `markDelivered`.
3. Peer offline: `offlineQueue.enqueue` (pending) → on reconnect `markSent` → delivered `markDelivered`; timeout → `expired`/`failed`.

### 5.2 Burn determination (src/core/burn.ts, pure functions)
- `shouldDestroy(msg)`: `read_once` and already read → true; `timed`/`scheduled` past burnAfter/burnAt → true; otherwise false.
- The UI countdown and destruction are driven by the `BurnTimer` component.

### 5.3 Safety code verification (fingerprint)
1. Both sides exchange public keys (TOFU acceptance).
2. `buildFingerprint` derives 15 digits + 7 emoji (EMOJI_TABLE of 64) from both public keys.
3. User verifies out-of-band → pin fingerprint; key change → red warning.

## 6. Dependencies & External Services

| Dependency | Purpose | Trust level |
| --- | --- | --- |
| `@trystero-p2p/mqtt` / `@trystero-p2p/torrent` | Peer discovery & handshake signaling | Untrusted (threat model §4.1) |
| WebRTC (browser) | P2P data channel | Message content protected by E2EE |
| idb | IndexedDB wrapper | Browser isolation trusted |
| React 19 / Vite / Vitest / Oxlint | UI / build / test / lint | Dev & runtime dependencies |

## 7. Testing

- **Entry**: `npm test` (Vitest), 283 cases, 30 test files (`src/__tests__/`), covering: crypto/e2ee/fingerprint/keyRotation/burn/db/backup/base64/id/noise, and UI components (BurnTimer/ConfirmDialog/ErrorBoundary/GlassCard), etc.
- **Gates**: `npm run typecheck` (tsc) + `npm run lint` (oxlint), CI (GitHub Actions).
- Security invariants are preferably locked in as tests (threat model §9: before changing security code, consult the threat model).

## 8. Red Lines (do not touch without first updating the threat model)

1. **E2EE pipeline**: messages must be encrypt-then-sign; verification failure must never be silently shown.
2. **Private-key extractability**: generation must set `extractable: false`.
3. **Local encryption format**: v4 per-install salt + PBKDF2-600k; legacy-version decryption must keep working.
4. **Lock semantics**: forgotten passphrase = permanently undecryptable (no "password recovery").
5. **Noise & monitoring**: monitor ping/pong plaintext is a known limitation; changes must re-evaluate metadata exposure.
6. **Documentation boundary**: README/PRD/marketing must not claim capabilities beyond THREAT_MODEL.
