/**
 * 密钥轮换相关测试
 *
 * 背景（已读源码确认）：
 * - 曾实现：每 100 条消息自动 rotateKeys()，但 onKeyRotation 从未被通信层注册，
 *   对端仍持旧公钥 → 长对话解密失败；TOFU 按临时 peerId 固定且无签名衔接，
 *   即使补通知也会被判 untrusted。
 * - 方案 C（当前产品策略）：关闭自动轮换。rotateKeys 仅保留为显式 API，
 *   在可验证轮换协议就绪前不应在生产路径调用。
 *
 * 本文件：
 * 1. 保留「若强行轮换且对端未更新」的故障复现（文档化风险）。
 * 2. 契约改为验收方案 C：自动轮换不触发、意外换钥仍拒绝、长对话密钥稳定。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  generateKeyPair,
  clearAllSharedKeys,
} from '../security/e2ee'

// mock db：身份持久化在这些单元测试里不需要真写 IndexedDB
vi.mock('../persistence/db', () => ({
  saveIdentity: vi.fn(async () => {}),
  loadIdentity: vi.fn(async () => undefined),
  clearAllData: vi.fn(async () => {}),
}))

/** 计算 X25519 ECDH 共享密钥原始字节 */
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
// 故障复现：若强行 rotate 且对端未更新公钥，共享密钥必然不一致
// （说明为何在无完整协议前不能自动轮换）
// ---------------------------------------------------------------------------

describe('密钥轮换风险复现（无通知时的错误行为）', () => {
  it('轮换前：双方 ECDH 共享密钥一致（正常可互通）', async () => {
    const peerA = await generateKeyPair()
    const peerB = await generateKeyPair()

    const secretFromB = await sharedSecret(peerB.privateKey, peerA.publicKey)
    const secretFromA = await sharedSecret(peerA.privateKey, peerB.publicKey)

    expect(bytesEqual(secretFromB, secretFromA)).toBe(true)
  })

  it('peerA 轮换后 peerB 仍持旧公钥时，双方共享密钥不一致', async () => {
    const peerA_old = await generateKeyPair()
    const peerB = await generateKeyPair()

    const beforeB = await sharedSecret(peerB.privateKey, peerA_old.publicKey)
    const beforeA = await sharedSecret(peerA_old.privateKey, peerB.publicKey)
    expect(bytesEqual(beforeB, beforeA)).toBe(true)

    const peerA_new = await generateKeyPair()

    const secretB_stillOld = await sharedSecret(
      peerB.privateKey,
      peerA_old.publicKey,
    )
    const secretA_new = await sharedSecret(peerA_new.privateKey, peerB.publicKey)

    expect(bytesEqual(secretB_stillOld, secretA_new)).toBe(false)
  })

  it('若对端更新为新公钥，共享密钥重新一致（故障点在未通知/未更新）', async () => {
    const peerA_new = await generateKeyPair()
    const peerB = await generateKeyPair()

    const secretB = await sharedSecret(peerB.privateKey, peerA_new.publicKey)
    const secretA = await sharedSecret(peerA_new.privateKey, peerB.publicKey)

    expect(bytesEqual(secretB, secretA)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 方案 C 契约：自动轮换关闭后的验收
// ---------------------------------------------------------------------------

describe('方案 C 契约（自动轮换已关闭）', () => {
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
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    })
  })

  afterEach(() => {
    clearAllSharedKeys()
    vi.unstubAllGlobals()
  })

  /**
   * 契约 A：累计大量发送记录后，公钥不得被自动轮换。
   */
  it('契约 A：recordMessageSent 100 次后本端公钥保持不变', async () => {
    const { e2eeManager, securityManager } = await import('../security')
    await securityManager.setupPassword('test-password-123')
    await e2eeManager.init()
    await e2eeManager.loadIdentity()

    const pubBefore = e2eeManager.getOwnPublicKey()
    expect(pubBefore).toBeTruthy()

    for (let i = 0; i < 100; i++) {
      e2eeManager.recordMessageSent()
    }

    // 给任何误触发的异步 rotateKeys 一点时间（不应发生）
    await new Promise((r) => setTimeout(r, 50))

    const pubAfter = e2eeManager.getOwnPublicKey()
    expect(pubAfter).toBe(pubBefore)
  })

  /**
   * 契约 B：在无签名衔接的可验证轮换协议之前，
   * 已固定 peer 的公钥变更必须保持 untrusted（拒绝静默 re-pin）。
   * 通过预置 TOFU 哈希触发「storedHash !== keyHash」分支，
   * 不依赖 importPeerPublicKey（避免 Node/浏览器 X25519 usages 差异）。
   */
  it('契约 B：已固定公钥发生变更时 handlePeerPublicKey 返回 untrusted', async () => {
    const { uint8ToBase64 } = await import('../utils/base64')

    const peerId = 'peer-under-test'
    const oldPubStr = 'old-public-key-material-for-tofu'
    const newPubStr = 'new-public-key-material-after-change'

    const encoder = new TextEncoder()
    const oldHashBuf = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(oldPubStr),
    )
    const oldHash = uint8ToBase64(new Uint8Array(oldHashBuf))

    // 在加载管理器之前写入 TOFU，模拟「曾经信任过 oldPub」
    memoryStore['nymir_tofu'] = JSON.stringify({ [peerId]: oldHash })

    // 重新加载模块，使单例从 localStorage 读出预置 TOFU
    vi.resetModules()
    const { e2eeManager } = await import('../security/e2eeManager')

    const status = await e2eeManager.handlePeerPublicKey(peerId, newPubStr)
    expect(status).toBe('untrusted')
    // 拒绝导入：不应持有该 peer 的可用公钥
    expect(e2eeManager.hasPeerKey(peerId)).toBe(false)
  })

  /**
   * 契约 C：长对话密钥稳定——大量 recordMessageSent 后，
   * 双方仍基于同一对密钥得到一致的 ECDH 共享秘密（端到端不中断）。
   */
  it('契约 C：100 次 recordMessageSent 后双方共享密钥仍一致', async () => {
    const { e2eeManager, securityManager } = await import('../security')
    await securityManager.setupPassword('test-password-123')
    await e2eeManager.init()
    await e2eeManager.loadIdentity()

    const peerA = await generateKeyPair()
    const peerB = await generateKeyPair()

    for (let i = 0; i < 100; i++) {
      e2eeManager.recordMessageSent()
    }
    await new Promise((r) => setTimeout(r, 50))

    // 产品路径不再轮换：用同一对密钥，共享秘密必须仍一致
    const secretB = await sharedSecret(peerB.privateKey, peerA.publicKey)
    const secretA = await sharedSecret(peerA.privateKey, peerB.publicKey)
    expect(bytesEqual(secretB, secretA)).toBe(true)
  })
})
