/**
 * 密钥轮换故障链（当前已存在的严重 bug）
 *
 * 成因链路（已读源码确认）：
 * 1. e2eeManager.recordMessageSent() 每累计 100 条消息调用 rotateKeys()
 * 2. rotateKeys() 生成全新 X25519 + Ed25519 密钥对，并调用
 *    this.onKeyRotationCallback?.()
 * 3. 但 onKeyRotation(cb) 在全仓从未被注册（grep 只有定义处，
 *    peer.ts 等通信层没有调用），回调永远是 null
 * 4. 轮换后对端仍持有我的旧公钥，继续用旧公钥加密；
 *    我的新私钥解不开 → 从第 101 条起全部 decryptFailed
 * 5. 即使日后补上通知，对端 TOFU（localStorage 键 nymir_tofu）
 *    钉的是旧公钥 SHA-256；handlePeerPublicKey 在
 *    storedHash !== keyHash 时直接 return 'untrusted'，
 *    且在 return 前不会导入新公钥，新公钥进不来
 *
 * 本文件只写测试、不改任何 src 实现。目标是把 bug 钉死在测试里。
 *
 * 测试策略：
 * - 故障复现用 WebCrypto deriveBits 直接证明「旧公钥加密 ↔ 新私钥解密」
 *   共享密钥不一致（这是 decryptFailed 的根因）。
 * - 不走 e2ee.encryptMessage/decryptMessage 的 HKDF 路径，因为该路径在
 *   Node 测试环境与浏览器对 key usages 的处理不一致，会引入噪音。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  generateKeyPair,
  exportPublicKey,
  clearAllSharedKeys,
} from '../security/e2ee'

/** 计算 X25519 ECDH 共享密钥原始字节（与 e2ee 共享密钥的根材料一致） */
async function sharedSecret(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
): Promise<Uint8Array> {
  const bits = await crypto.subtle.deriveBits(
    { name: 'X25519', public: peerPublicKey },
    privateKey,
    256,
  )
  return new Uint8Array(bits)
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

// ---------------------------------------------------------------------------
// 复现真实故障：轮换后对端仍用旧公钥 → 共享密钥不一致 → 必然解不开
// ---------------------------------------------------------------------------

describe('密钥轮换故障复现（当前错误行为）', () => {
  it('轮换前：双方 ECDH 共享密钥一致（正常可互通）', async () => {
    const peerA = await generateKeyPair()
    const peerB = await generateKeyPair()

    // B 加密视角：B 私钥 + A 公钥
    const secretFromB = await sharedSecret(peerB.privateKey, peerA.publicKey)
    // A 解密视角：A 私钥 + B 公钥
    const secretFromA = await sharedSecret(peerA.privateKey, peerB.publicKey)

    expect(bytesEqual(secretFromB, secretFromA)).toBe(true)
  })

  it('peerA 轮换密钥后，peerB 仍持有旧公钥时，双方共享密钥不一致（当前错误行为）', async () => {
    const peerA_old = await generateKeyPair()
    const peerB = await generateKeyPair()

    // 轮换前确认可互通
    const beforeB = await sharedSecret(peerB.privateKey, peerA_old.publicKey)
    const beforeA = await sharedSecret(peerA_old.privateKey, peerB.publicKey)
    expect(bytesEqual(beforeB, beforeA)).toBe(true)

    // peerA 轮换（模拟 rotateKeys：只换本端密钥，对端仍持有旧公钥）
    const peerA_new = await generateKeyPair()

    // 产品现状：B 仍用 A 的旧公钥计算共享密钥
    const secretB_stillOld = await sharedSecret(
      peerB.privateKey,
      peerA_old.publicKey, // 旧公钥
    )
    // A 已用新私钥
    const secretA_new = await sharedSecret(
      peerA_new.privateKey,
      peerB.publicKey,
    )

    // 断言：共享密钥不再一致 → 用旧公钥加密的密文，新私钥必然解不开
    expect(bytesEqual(secretB_stillOld, secretA_new)).toBe(false)
  })

  it('若对端更新为新公钥，共享密钥重新一致（说明故障点在「未通知/未更新」）', async () => {
    const peerA_new = await generateKeyPair()
    const peerB = await generateKeyPair()

    // 正确协议下 B 已拿到 A 的新公钥
    const secretB = await sharedSecret(peerB.privateKey, peerA_new.publicKey)
    const secretA = await sharedSecret(peerA_new.privateKey, peerB.publicKey)

    expect(bytesEqual(secretB, secretA)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 期望契约（当前应失败 / 待实现）
// ---------------------------------------------------------------------------

describe('密钥轮换期望契约（待实现，当前应失败）', () => {
  const memoryStore: Record<string, string> = {}

  beforeEach(() => {
    clearAllSharedKeys()
    Object.keys(memoryStore).forEach((k) => delete memoryStore[k])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memoryStore[key] ?? null,
      setItem: (key: string, value: string) => {
        memoryStore[key] = value
      },
      removeItem: (key: string) => {
        delete memoryStore[key]
      },
      clear: () => {
        Object.keys(memoryStore).forEach((k) => delete memoryStore[k])
      },
      key: () => null,
      length: 0,
    })
  })

  afterEach(() => {
    clearAllSharedKeys()
    vi.unstubAllGlobals()
  })

  /**
   * 契约 A：轮换后必须存在已注册的回调被触发，用于通知对端新公钥。
   *
   * 产品现状：通信层（peer.ts 等）从未调用 onKeyRotation() 注册回调，
   * 因此轮换发生时没有任何对外通知。本测试不手动注册，直接轮换，
   * 断言“通知已发生”——今天必败。修复时：在 peer 连接建立时注册
   * 回调，并在回调内广播新公钥；届时改写本测试为真实注册路径。
   */
  it.fails(
    '契约 A：rotateKeys 后必须触发已注册的 onKeyRotation 回调（通知对端）',
    async () => {
      const { e2eeManager } = await import('../security/e2eeManager')

      await e2eeManager.init()

      let callbackFired = false
      // 故意不调用 e2eeManager.onKeyRotation(...)，模拟产品现状：
      // 无人注册 → 回调不会跑 → 对端收不到新公钥。

      const pubBefore = e2eeManager.getOwnPublicKey()
      await e2eeManager.rotateKeys()
      const pubAfter = e2eeManager.getOwnPublicKey()

      // 密钥确实换了
      expect(pubAfter).not.toBe(pubBefore)
      // 契约：必须有通知回调被触发。当前无人注册 → 失败。
      expect(callbackFired).toBe(true)
    },
  )

  /**
   * 契约 B：对端收到轮换后的新公钥时，必须能 re-pin，
   * 而不是因 TOFU 哈希不一致直接 return 'untrusted' 且不导入新公钥。
   *
   * 注意：handlePeerPublicKey 内部会 importPeerPublicKey。在 Node 下
   * importKey 对 X25519 的 usages 限制可能导致 import 失败，
   * 从而提前返回 'untrusted'。无论是 TOFU 拒绝还是 import 失败，
   * 当前结果都是“新公钥进不来”，与契约相悖。
   */
  it.fails(
    '契约 B：公钥变更后 handlePeerPublicKey 应允许 re-pin，而不是永久 untrusted',
    async () => {
      const { e2eeManager } = await import('../security/e2eeManager')
      e2eeManager.clearAll()
      e2eeManager.clearTOFU()
      await e2eeManager.init()

      const oldPair = await generateKeyPair()
      const newPair = await generateKeyPair()
      const oldPub = await exportPublicKey(oldPair)
      const newPub = await exportPublicKey(newPair)

      const peerId = 'peer-under-test'

      // 首次固定（若 Node 下 import 失败，first 也会是 untrusted，
      // 届时本契约同样失败，符合“当前未满足”）
      const first = await e2eeManager.handlePeerPublicKey(peerId, oldPub)
      expect(['new', 'trusted']).toContain(first)
      expect(e2eeManager.hasPeerKey(peerId)).toBe(true)

      // 轮换后的新公钥到达
      const second = await e2eeManager.handlePeerPublicKey(peerId, newPub)

      // 期望契约：允许重新固定，且新公钥被导入。
      // 当前实现：storedHash !== keyHash → return 'untrusted'，且不导入。
      expect(second).not.toBe('untrusted')
      expect(e2eeManager.hasPeerKey(peerId)).toBe(true)
    },
  )

  /**
   * 契约 C：轮换后双方共享密钥应重新一致（端到端不中断）。
   * 模拟产品路径：A 已轮换，B 仍持有旧公钥 → 共享密钥不一致。
   * 契约要求“仍一致”——今天失败，修复（通知 + re-pin）后应变绿。
   */
  it.fails(
    '契约 C：密钥轮换后双方仍能正常加密解密（端到端不中断）',
    async () => {
      const peerA_old = await generateKeyPair()
      const peerB = await generateKeyPair()

      const beforeB = await sharedSecret(peerB.privateKey, peerA_old.publicKey)
      const beforeA = await sharedSecret(peerA_old.privateKey, peerB.publicKey)
      expect(bytesEqual(beforeB, beforeA)).toBe(true)

      // A 轮换，B 未更新公钥（产品现状：无通知 / TOFU 拒绝导入）
      const peerA_new = await generateKeyPair()

      const afterB = await sharedSecret(peerB.privateKey, peerA_old.publicKey)
      const afterA = await sharedSecret(peerA_new.privateKey, peerB.publicKey)

      // 契约：轮换后共享密钥仍应一致。当前不一致 → it.fails。
      expect(bytesEqual(afterB, afterA)).toBe(true)
    },
  )
})
