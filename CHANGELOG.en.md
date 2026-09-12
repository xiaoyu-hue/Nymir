# Changelog

All notable changes to Nymir will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

> ⚠️ Reminder: This project is AI-assisted, written by an author with zero programming experience, has not undergone professional security audit, and is not recommended for real sensitive scenarios.

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
