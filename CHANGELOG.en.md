# Changelog

All notable changes to Nymir will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

> ⚠️ Reminder: This project is AI-assisted, written by an author with zero programming experience, has not undergone professional security audit, and is not recommended for real sensitive scenarios.

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

---

## Earlier Changes

> Documentation updates: bilingual README revision, top warning notice, English CODE_OF_CONDUCT.en.md, bilingual CONTRIBUTING.md, THREAT_MODEL.md synced with v3 encryption format, AGENTS.md rule updates.
