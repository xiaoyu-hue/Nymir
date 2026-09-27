# Security Policy

> ⚠️ **Important premise**: Nymir is AI-assisted and authored by a non-programmer individual developer; the code has **not undergone a professional security audit**. It is positioned as a privacy-first personal tool and is **not recommended for genuinely sensitive scenarios** (high-risk communications, long-term storage of important data, etc.). If you find a security vulnerability, please report it per the process below — your feedback is essential to improvement.

## 1. Project Security Posture

Nymir is a **pure front-end, P2P (peer-to-peer) anonymous messaging tool**. Core characteristics:

- **No application server, no accounts**: messages are never stored on any self-hosted cloud; users need no registration.
- **End-to-end encryption (E2EE)**: session messages are encrypted in the browser and transmitted directly between devices over WebRTC.
- **Local-first**: messages and identity data live only in your own browser (IndexedDB).

> Precisely, Nymir is **not fully decentralized**: peer discovery relies on public signaling services (MQTT broker / Nostr relay / WebTorrent tracker), but **message content never passes through them** — they can only observe connection metadata. See the README "Security & Privacy" section.

## 2. Supported Versions

| Version | Receives security updates? |
|---------|----------------------------|
| Latest stable (currently `1.6.4`) | ✅ Yes |
| Older versions | ❌ No (please upgrade) |

Security fixes are merged into the latest mainline only; no backports for historical versions. Keep updated.

## 3. Reporting a Vulnerability

### How to report (either, first preferred)

1. **GitHub Private Vulnerability Reporting**: repo `Security` tab → `Report a vulnerability`. This is a **private channel** visible only to maintainers.
2. **GitHub Issues**: open an issue and note it's security-related; if sensitive, request private handling and maintainers can convert it.

> No dedicated security email is configured. Do not post PoCs or plaintext sensitive data in public comments.

### Please include

- **Affected version** (e.g. `1.6.4` or `master@<commit>`)
- **Vulnerability type** (XSS, key-handling flaw, info leak, dependency vuln, etc.)
- **Steps to reproduce** (minimal path)
- **Expected vs actual behavior**
- **Impact assessment** (attacker preconditions, what they can obtain)
- If a PoC is provided, submit it privately; **do not include real message plaintext, private keys, or passwords**

### Response expectations (honest)

Nymir is a **personally maintained project, not a 24/7 security operation**. Maintainers respond as soon as possible but **cannot promise a fixed SLA**. Typical flow:

1. Acknowledge receipt (within days when possible)
2. Reproduce and assess impact
3. Fix (tests added in `src/security` etc. before implementation — see AGENTS.md security red lines)
4. Ship fix with a release; credit reporter in Release Notes (if willing)
5. Request a CVE if applicable

## 4. Security Model Summary

> Summary only. The authoritative, complete description is the README "Security & Privacy" section; every claim there has a corresponding implementation in `src/security/*` (repo hard rule: docs must not exceed implementation).

- **Session encryption**: X25519 key agreement + AES-256-GCM; per-message independent keys via HKDF; Ed25519 signs ciphertext (encrypt-then-sign); failed verification is not displayed.
- **Identity & keys**: persistent identity keys stored locally; verifiable key rotation supported (old signing key signs new public key; peer re-pins only after verification — see `docs/adr/0007-verifiable-key-rotation.md`).
- **Out-of-band safety number**: chat shield shows a shared 15-digit number (+7 emoji aid); verify via another channel to detect MITM; pinned after verification; public-key change triggers a red warning.
- **Local storage encryption**: IndexedDB field-level encryption (AES-256-GCM, PBKDF2 600k iterations, per-install random salt); lock password derives the key, minimum 10 characters.
- **Burn after reading**: messages can be set to auto-destruct after view.
- **Secure deletion**: sensitive keys removed via `removeItem`; no overwrite reliance (browsers don't guarantee physical erasure).
- **Traffic obfuscation**: ~48 bytes of fixed noise every ~30s — mitigates but **cannot** defeat serious traffic analysis.

## 5. Known Limitations & Out-of-Scope Uses

Honestly, Nymir is **not** a universal privacy tool:

- **TOFU risk**: on first key exchange a MITM may inject a fake public key first; the protocol cannot detect this alone — **you must actively verify the safety number**.
- **Signaling metadata**: public signaling can observe connection metadata (who connects to whom, when).
- **Signaling/connection setup is not an E2EE channel**.
- **No server-side offline inbox**.
- **Limited traffic obfuscation**: fixed interval/length may be identifiable by traffic analysis; not against nation-state adversaries.
- **Heartbeat (ping/pong) in plaintext**: timestamp only, over P2P; leaks online metadata, not content.
- **Forgetting the lock password** may make local encrypted data **permanently unrecoverable** (backup needs the same password).
- **Burn-after-reading cannot stop screenshots/copying**.

**Not suitable for**: high-risk communications (journalists/activists/whistleblowers, etc.), long-term retention of important records, real-time multi-device sync, public/shared devices.

## 6. Data Collection

- **No application server, no account collection, no cloud message storage, no telemetry implemented.**
- The only external contact is **public P2P signaling services** (MQTT/Nostr/WebTorrent broker/relay/tracker), operated by third parties; they **can observe connection metadata but not message plaintext**.
- The static site is deployed on GitHub Pages / Cloudflare Pages; their access logs are managed by the platforms, outside this project's control.

## 7. Dependencies & Supply Chain

- Runtime dependencies are mature open-source libraries (React, Trystero P2P signaling, idb, qrcode, etc.); no bespoke crypto primitives — all crypto calls the browser-built-in WebCrypto API.
- CI enforces security gates: **GitHub CodeQL, Semgrep (SAST), OSV-Scanner (dependency vulns), Socket (supply chain), Dependabot**.
- Report dependency vulnerabilities through the same channels above.

## 8. Responsible Disclosure

Please **do not** release working exploits in public. Give us reasonable time to fix before any public disclosure. We commit to crediting good-faith reporters.
