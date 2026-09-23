# Changelog

All notable changes to Nymir will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

> ⚠️ Reminder: This project is AI-assisted, written by an author with zero programming experience, has not undergone professional security audit, and is not recommended for real sensitive scenarios.

---

## 1.6.0 - 2026-09-23 (QR offline pairing)

> New feature: QR code-based room pairing — generate QR after creating a room, scan with camera to join instantly without typing room codes. No breaking changes.

### ✨ New Features
- **QR offline pairing**: Generate QR code after creating a room; peers scan with camera to join directly, no need to manually enter room codes
  - New `src/utils/qr.ts`: QR code generation (qrcode lib) and camera scanning (jsqr lib) utility functions
  - New `src/ui/components/QRCodeComponent.tsx`: QR modal display component, brand-color SVG output
  - New `src/ui/components/QRScanner.tsx`: Camera QR scanner component, auto-detects and joins rooms
  - New `src/ui/styles/qr.css`: QR-related styles (modal overlay, scan frame, buttons)
  - RoomPanel now uses real room ID, automatically shows QR modal after room creation
  - Join tab adds "Scan QR Code" button for camera-based quick join
  - Added bilingual i18n strings (scan, share, camera permission, etc.)

### 🧪 Tests
- Added `src/__tests__/qr.test.ts` (6 cases): covers QR generation, empty fallback, dimensions, colors, and basic scan logic
- All 293 unit tests pass green

### 🔒 Dependencies
- Added runtime deps: `qrcode ^1.5.4` (SVG generation), `jsqr ^1.4.0` (camera frame recognition)
- Added dev dep: `@types/qrcode`

---

## 1.5.0 - 2026-09-22 (Signaling redundancy: multi-broker + Nostr fallback chain)

> New feature: Signaling reliability upgrade — MQTT main channel enables all 5 public brokers, new Nostr fallback strategy with chain mqtt → nostr → torrent. No breaking changes.

### ✨ New Features
- **Signaling redundancy config**: MQTT main channel explicitly enables all 5 public brokers (trystero's default list had 5 but only 4 were active, hivemq was never used), redundancy=5; WebTorrent fallback channel enables all 5 public trackers (previously only 3). Multiple server failures still leave available channels.
- **Nostr fallback strategy**: Adds `@trystero-p2p/nostr` as the second fallback tier (mqtt primary → nostr → torrent). Nostr public relays outnumber MQTT brokers significantly, higher decentralization. Explicitly configures 8 well-known public relays while maintaining 5 simultaneous connections.

### ⚙️ Engineering/CI
- Dual-device integration and Nostr-specific validation passed (two independent browser contexts connected via public relay and delivered messages); 287 unit tests all green.

---

## 1.4.0 - 2026-09-15 (Automatic key rotation + E2E three-end + CSP fix)

> New feature: Automatic key rotation strategy; Engineering/CI: Playwright E2E three-end + CSP fix. No breaking changes.

- **Automatic key rotation strategy (ADR-007 protocol ready)**: Triggers a verifiable rotation every 100 messages sent (`rotateKeysVerifiable`, signature-chaining proof broadcast via key-rotation channel, peer re-pins after signature verification); only triggers when at least one peer is online, count accumulates while offline and resumes when they reconnect; counter resets after rotation. The earlier flaw of "auto-rotate every 100 messages without notification/signature causing decryption failures" is now resolved by the protocol.
- **E2E three-end tests (Playwright)**: Adds `e2e/` (smoke + responsive), `playwright.config.js`, `test:e2e` script and CI job (Chromium desktop + WebKit mobile/tablet). Smoke covers: zero-error load / CSP zero violations / first password setup / create room and enter chat; responsive covers three-end rendering.
- **CSP fix (security issue discovered by E2E)**: ①Removed invalid `stun:` source from `connect-src` (WebRTC is not subject to CSP at the underlying level, previously only produced browser warnings); ②Removed invalid `<meta>` `frame-ancestors` (meta is ineffective), replaced by `X-Frame-Options: DENY` in `public/_headers` to take effect on Pages deployment; ③Added missing trystero fallback MQTT broker whitelist (`test.mosquitto.org`, `public.cloud.shiftr.io`) — previously blocked by CSP, fault tolerance fallback failed.
- **Decision review system**: AGENTS.md adds "Decision Collaboration Specification" chapter — irreversible / spending / publishing / architecture-impacting operations require AI to answer "three decision questions" (disadvantages/costs, consequences of not doing, conditions for regret) before execution; companion `docs/DECISION_REVIEW.md` (pre-decision checklist + approval record template).
- **Doc & version sync specification**: AGENTS.md adds "Document & Version Sync (pre-release checklist)" chapter; companion `docs/DOC_SYNC.md` (single source of truth: version number from package.json, numbers from test output, descriptions from code; sync checklist + SemVer decision table + pre-release verification + sync check template). Includes zh/en bilingual consistency and dependency ↔ README acknowledgment table items.
- **Deployment consolidation**: Removed Cloudflare Workers online address (`*.workers.dev` unavailable); **GitHub Pages (https://xiaoyu-hue.github.io/Nymir/) as primary site, Cloudflare Pages (https://nymir.pages.dev/) as backup** (two sites are independent entry points with domain-isolated identities, primary-backup relationship marked in zh/en README). The `Workers Builds: nymir` known issue from 1.3.0 is no longer applicable with Workers deployment removed.

---

## 1.3.0 - 2026-09-14 (Key rotation UI + security infrastructure consolidation)

> New feature: Key rotation UI entry; Engineering/CI: branch protection + scan pipeline consolidation. No breaking changes.

### ✨ New Features
- **Key rotation UI**: ChatView toolbar adds 🔑 rotate key button (shown when a peer is present). Click triggers a confirmation dialog for second confirmation, then calls `messageManager.rotateKeys()` (verifiable rotation protocol, see ADR-007). Success/failure banner feedback (auto-dismisses after 4 seconds). After rotation, safety code automatically changes to "changed", prompting both sides to re-verify. zh/en i18n. Adds 4 component test cases.

### ⚙️ Engineering/CI
- **Enable master branch protection**: Requires PR merge + all checks green (CodeQL `Analyze (javascript-typescript)` / Semgrep `security-audit + owasp-top-ten` / Test Gate `audit · typecheck · lint · test · build`) + branch must be up-to-date (strict) + admins cannot bypass (enforce_admins) + force-push/delete branch prohibited + linear history. Direct push to master rejected, all changes go through PR.
- **Disable Dependabot regular version upgrades** (delete dependabot.yml): No longer auto-opens upgrade PRs (avoid branch/PR clutter); retains Dependabot alerts (vulnerability alerts) + security updates (high-severity vulnerability auto-fix PRs) — controlled by repo settings, unaffected.
- **Remove redundant socket.yml**: Socket Security GitHub App is installed and handles supply chain scanning (produces `Socket Security: Project Report` check), self-built workflow deleted.
- **Known issue**: Cloudflare Workers build check (`Workers Builds: nymir`) occasionally fails in 0 seconds — a Cloudflare-side configuration/authentication issue, not in branch protection required checks, does not affect merge; awaits login to Cloudflare dashboard to investigate.

---

## 1.2.0 - 2026-09-14 (verifiable key rotation)

> Security enhancement: verifiable key rotation (signature-chaining protocol, ADR-007). No breaking changes.

### 🛡️ Security

- **feat(security): verifiable key rotation protocol (ADR-007)**
  - `rotateKeysVerifiable()`: signs the new public-key material with the old signing private key, persists the new identity, and auto-broadcasts the proof — peers can verify "old and new identities are the same entity"; MITM cannot forge.
  - `handleKeyRotation()`: peer re-pins + updates keys + migrates verified record (state becomes `changed`, prompting re-verification) only after signature verification; failures/source mismatch always rejected; duplicate broadcast ignored idempotently.
  - `message.ts`: new `key-rotation` control channel and `rotateKeys()` explicit entry (replaces legacy `rotateKeys` in production path, fixing its "no persistence + no notification" flaws).
- **Tests**: +15 cases (9 protocol + 6 channel), **279 passing** (29 files).

### 📚 Docs

- README (zh/en): known limitations updated ("automatic strategy not enabled, verifiable rotation supported"); roadmap updated.
- THREAT_MODEL §8: verifiable key rotation marked done.
- ARCHITECTURE: test count corrected 270+ → 279 (29 files).
- New ADR-007 + index row.

### ⏳ Pending

- Version aligned to 1.2.0 (package.json + lock fixed from stale 1.0.0)
- Key rotation UI entry and automatic rotation strategy (roadmap)

---

## 1.1.0 - 2026-09-14

> Version alignment: documentation system completed (PRD / ARCHITECTURE / ADR / English versions). No breaking code changes.

### 📚 Docs

- **docs: add PRD.md** — product requirements: goals, core concepts, feature spec, security boundary, 10 checkable acceptance criteria.
- **docs: add ARCHITECTURE.md** — one-page current architecture: layers, message journey, file responsibilities, data model, 6 red lines.
- **docs: add adr/ decision records** (6 + index) — Trystero choice, AGPL-3.0, public signaling positioning, local encryption v4, safety code design, TOFU + out-of-band verification.
- **docs: add PRD.en.md / ARCHITECTURE.en.md** — English versions for international readers.
- **docs: update documentation index** — docs/README.md entries for PRD / ARCHITECTURE / ADR / English versions.

### 🔧 Version

- package.json / README badges / PRD / ARCHITECTURE aligned to **1.1.0**.

### 🧪 Test note (honest record)

- `npm test` currently **264 passing** (27 files).
- One flaky failure (1/264) observed once, green on re-run; classified as **test flake** (suspected shared storage state across parallel workers), not a deterministic bug; will investigate separately if it recurs.

---

## Rounds 4-6 Review Fixes - 2026-09-13

> After the first three rounds of security audit, continued reviewing across four dimensions: code security, code quality, test coverage, and UI/UX. 264 tests passing.

### 🛡️ Security

- **fix(security): recall/read channels use real peerId from transport**
  > Previously the payload carried a self-reported peerId field, allowing a malicious peer to forge recall or read receipts for others. Now uses the real peerId from the trystero transport layer.

- **fix(security): verifiedStore key changed from temp peerId to public key SHA-256 hash**
  > Previously stored verification state by trystero temp peerId, so switching transport (mqtt→torrent) or refreshing lost verified status. Now keyed by peer public key hash, stable across sessions and transports.

- **refactor: Remove dead encryptFile/decryptFile/deriveFileWrapKey (~200 lines)**
  > File encryption functions were never called and used inconsistent key derivation.

- **fix: unverifyPeer changed from fire-and-forget to async/await**

### 🧹 Code Cleanup

- **refactor: Remove dead peerManager.reconnectTimer field**
- **refactor: offlineQueue payload type tightened to Record<string, never>**
- **refactor: Inline styles moved to CSS (ChatView safety button + banner)**

### 🎨 UI/UX

- **fix(a11y): Remove role=button/tabIndex from MessageBubble wrapper**
  > Screen readers no longer announce every message as a button when non-self messages are not interactive.

- **feat(i18n): Loading/identity error strings now localized**
- **feat(ux): Show red error toast when create/join room fails**

### ✅ Tests

- **test(noise): Add start/stop noise generation tests (5 cases)**
  > Interval sending, stop, duplicate start guard, noise feature verification, restart after stop. Coverage improved from 21%.

---

## Three Rounds of Security Audit Fixes - 2026-09-11

> Includes code defect fixes discovered during the first, second, and third rounds of security audit. Each fix is committed separately, with full test suite run before commit (179 test cases all passing).

### 🛡️ Security

#### Round 1 First Security Audit Fixes

- **fix(persistence): encryptField prohibits silent plaintext downgrade**
  > Throw error on encryption failure (including locked state without key), never silently downgrade to plaintext on disk. Once plaintext is written to IndexedDB, there will be no opportunity to re-encrypt.

- **fix(core): block encrypt-then-sign plaintext bypass on receive path**
  > When `encrypted: false` and signature verification passes, no longer accept content as plaintext—always treat as signature verification failure. Blocks the dictionary attack path of the old sign-then-encrypt approach. Also adds field validation (burnMode/timestamp enum and type checking), offline queue no longer carries plaintext.

- **feat(security): PBKDF2 derived key cache (v3 encryption format)**
  > Same password only derives 600k PBKDF2 once, afterwards only uses random IV. Fixed salt means same password on different installations derives the same key (rainbow table protection is lost, but password strength and 600k iteration protection remain). Old v1/v2 data decryption goes through legacy path.

- **fix(security): remove _cachedPassword string copy**
  > Storing password in Uint8Array with fill(0) zeroing, while also saving an immutable JS string copy, makes the zeroing operation completely meaningless. Remove string copy, password is only decoded on demand when used and discarded after call.

- **fix(security): fix shared key LRU off-by-one**
  > evictOldestSharedKey() was called before sharedKeys.set(), making the actual limit 101. Changed to set first then evict, limit is exactly 100.

#### Round 2 Second Security Audit Fixes

- **fix(security): crypto cachedKey no longer stores raw password string, uses SHA-256 hash for comparison only**
  > The v3 cache `cachedKey = { password, key }` stored another password string, contradicting the original intent of removing _cachedPassword. Changed to store password SHA-256 hash (for comparison only, not for key derivation), reducing plaintext password residency in JS heap.

- **fix(persistence): decryptField throws error when locked instead of returning original value**
  > Original logic `if (isLocked) return value`, if value is old plaintext data then returns plaintext when locked. Changed to throw Error when locked, caller must handle, no silent return of possible plaintext.

### 🛠️ Fixes

#### Round 1 First Security Audit Fixes

- **feat(communication): offlineQueue adds clearRoom(roomId)**
  > Clear offline queue entries by room, avoid payload residue for that room when leaving.

- **fix(core): room.leaveRoom() clears offline queue for that room**
  > Calls offlineQueue.clearRoom() when leaving room, contract gap closed.

- **fix(communication): Channel.onMessage returns unsubscribe function**
  > monitor.setChannel/stop cleans up old handlers, prevents duplicate registration leaks.

- **fix(core): MessageManager.bindChannels/destroy uses onMessage unsubscribe**
  > Room rebuild no longer leaves old handlers.

#### Round 2 Second Security Audit Fixes

- **fix(security): needsMigration length check changed from >1 to >0**
  > Consistent with v3 detection logic in decrypt().

- **fix(security): setPassword calls clearCryptoCache**
  > Defensive cleanup: clear derived key cache when setting new password, avoid old password derived key residue in memory.

- **fix(communication): offlineQueue.clearRoom emits expired event after removing messages**
  > Notify UI to sync state, avoid UI still showing cleaned offline messages.

- **fix(communication): offlineQueue.markDelivered removes redundant saveToStorage call**
  > No need to save once before removing message, avoids redundant writes.

- **fix(communication): offlineQueue.loadFromStorage calls saveToStorage after pruning expired messages**
  > Prevents expired messages from remaining in localStorage.

### 🧹 Code Cleanup

#### Round 1 First Security Audit Fixes

- **chore(communication): remove dead code—nat.ts entire module and peerManager.reconnect()**
  > nat.ts entire module defined but never called; reconnect() 0 references.

- **chore(security): remove unused clearTOFU/isTOFUPinned/getNoiseStats**
  > All 0-reference dead code.

#### Round 2 Second Security Audit Fixes

- **cleanup(communication): monitor removes unused pendingPings dead code field**
  > Defined but never referenced, removed along with clear() call in stop().

- **cleanup(core): room.secureReset marked as deprecated dead code**
  > This method is never called, and cleanup logic is incomplete (only leaveRoom + clearLocalStorage, does not clean IndexedDB). For full reset use securityManager.reset().

### 📝 Documentation & Comments

#### Round 2 Second Security Audit Fixes

- **docs(security): e2ee deriveMessageKey comment removes "forward secrecy" wording**
  > Changed to per-message key derivation, and explains this approach is session-level static ECDH + per-message HKDF, does not provide strong forward secrecy. Consistent with e2eeManager.ts file header comment and THREAT_MODEL.md.

#### Round 3 Third Security Audit Fixes

- **chore: remove fileTransfer.ts dead code (315 lines)**
  > Zero references across the project, init() never called, no file transfer UI in ChatView, entire module never initialized. Even calling sendFile would throw due to null channel. Removed to reduce maintenance burden and confusion.

### 🛠️ Fixes

#### Round 3 Third Security Audit Fixes

- **fix(ui): RoomPanel room name input adds maxLength={50}**
  > Consistent input limit with room code maxLength={9}, prevents users from entering excessively long room names.

### 🛡️ Security

#### Round 4 Fourth Security Audit Fixes (sign/pseudonym/noise/backup/burn modules)

- **fix(security): noise module comment honestly downgrades capability boundary**
  > Original comment claimed "noise message format identical to real messages (no identifiable markers)", but actual noise has identifiable features: fixed interval, burnMode always read_once, no sender, no signature. Updated comment to honestly state "current noise is basic version, goal is to increase analysis cost, not make completely indistinguishable", consistent with project principle of "documentation must not exceed implementation".

### 🛠️ Fixes

#### Round 4 Fourth Security Audit Fixes

- **fix(security): pseudonym ADJECTIVES array removes duplicate element**
  > '温柔的' appeared twice, comment claimed 40 adjectives but only 39 unique values. Replaced second '温柔的' with '从容的', ensuring 40 unique adjectives.

- **fix(security): noise resets noiseCount on startNoiseGeneration**
  > noiseCount continued accumulating after stop/start, causing inaccurate log statistics. Reset to 0 on each start.

- **fix(security): noise uses unified secureRandomInt from utils/random, eliminates duplicate implementation**
  > noise.ts implemented its own secureRandomInt (modulo operation with modulo bias), duplicating utils/random.ts. Changed to import unified implementation, eliminates duplicate code.

- **fix(persistence): backup importBackup skips existing entries on import, avoids overwriting local new data**
  > Original logic directly called saveRoom/saveMessage, same-ID entries would be overwritten by old backup, causing local newly generated messages to be lost. Changed to check getRoom/getMessage before import, skip if exists, return actual import count.

- **fix(persistence): backup downloadBackup delays blob URL revocation**
  > URL.revokeObjectURL executed immediately after a.click(), but click triggers download asynchronously, immediate revocation may cause download to fail before starting. Changed to setTimeout delay 1 second revocation.

- **feat(persistence): db adds getMessage(id) function**
  > Used by backup import to check if message already exists, avoids overwriting local new data.

### 📝 Tests

#### Round 4 Fourth Security Audit Fixes

- **test: backup tests sync with new behavior**
  > db mock adds getRoom/getMessage; "import into library with existing data" test changed from "same-id overwrite" to "same-id skip, protects local new data", expects actual import count 0.

### 🛠️ Fixes

#### Round 5 Fifth Code Review (i18n/utils/App/ChatView/UI components)

- **fix(ui): 4 async operations add error handling, remove scheduled dead code**
  > App.tsx handleCreateRoom/handleJoinRoom, ChatView.tsx handleSend, MessageBubble.tsx handleRecall, LockScreen.tsx handleReset all add try/catch to prevent unhandled Promise rejections. ChatView.tsx removes scheduled mode dead code in BurnConfig that is not supported by UI.

### 📋 Review Notes

#### Round 5 Fifth Code Review

- **Scope**: i18n (3 files), utils (5 files), App.tsx main component, ChatView.tsx chat view, UI components (13 files)
- **Result**: No serious security vulnerabilities or functional bugs found. UI components are overall secure (no dangerouslySetInnerHTML/innerHTML/eval, no XSS risk).
- **Issues found**: 8 low-priority issues (4 async operations without error handling, 1 dead code, 1 imprecise regex, 2 minor issues), fixed 4 error handling and 1 dead code.

---

## Earlier Changes

> Documentation updates: bilingual README revision, top warning notice, English CODE_OF_CONDUCT.en.md, bilingual CONTRIBUTING.md, THREAT_MODEL.md synced with v3 encryption format, AGENTS.md rule updates.
