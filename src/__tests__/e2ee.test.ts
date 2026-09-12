/**
 * E2EE 模块测试
 *
 * 覆盖威胁模型中的关键不变量：
 * - 消息内容机密性（双端往返）
 * - 每消息 HKDF 密钥派生（不同 messageId → 不同密文）
 * - 错误密钥 / 错误 peer 解密失败
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateKeyPair,
  exportPublicKey,
  importPeerPublicKey,
  encryptMessage,
  decryptMessage,
  clearSharedKey,
  clearAllSharedKeys,
  type KeyPair,
} from '../security/e2ee'

describe('e2ee — 密钥生成与导出', () => {
  it('generateKeyPair: 公私钥均可导出（用于加密持久化）', async () => {
    const keyPair = await generateKeyPair()
    expect(keyPair.publicKey).toBeDefined()
    expect(keyPair.privateKey).toBeDefined()
    expect(keyPair.publicKey.extractable).toBe(true)
    // v4 起私钥可导出，用于加密后持久化到 IndexedDB
    expect(keyPair.privateKey.extractable).toBe(true)
  })

  it('exportPublicKey 返回稳定的 base64 字符串', async () => {
    const keyPair = await generateKeyPair()
    const a = await exportPublicKey(keyPair)
    const b = await exportPublicKey(keyPair)
    expect(typeof a).toBe('string')
    expect(a.length).toBeGreaterThan(30)
    expect(a).toBe(b)
  })

  it('不同密钥对产生不同公钥', async () => {
    const a = await generateKeyPair()
    const b = await generateKeyPair()
    const pubA = await exportPublicKey(a)
    const pubB = await exportPublicKey(b)
    expect(pubA).not.toBe(pubB)
  })

  it('importPeerPublicKey 能导入导出的公钥', async () => {
    const kp = await generateKeyPair()
    const exported = await exportPublicKey(kp)
    const imported = await importPeerPublicKey(exported)
    expect(imported).toBeDefined()
    expect(imported.type).toBe('public')
  })

  it('clearSharedKey / clearAllSharedKeys 不抛错', () => {
    expect(() => clearSharedKey('nonexistent')).not.toThrow()
    expect(() => clearAllSharedKeys()).not.toThrow()
  })
})

describe('e2ee — 消息加解密往返（机密性）', () => {
  beforeEach(() => {
    clearAllSharedKeys()
  })

  it('Alice→Bob：加密后 Bob 能正确解密', async () => {
    const alice = await generateKeyPair()
    const bob = await generateKeyPair()
    const bobPub = await importPeerPublicKey(await exportPublicKey(bob))
    const alicePub = await importPeerPublicKey(await exportPublicKey(alice))

    const plaintext = '你好，这是机密消息'
    const messageId = 'msg-001'
    const peerIdForAlice = 'bob-peer'
    const peerIdForBob = 'alice-peer'

    const encrypted = await encryptMessage(
      plaintext,
      peerIdForAlice,
      alice.privateKey,
      bobPub,
      messageId,
    )
    expect(encrypted.iv).toBeTruthy()
    expect(encrypted.data).toBeTruthy()
    expect(encrypted.data).not.toContain(plaintext)

    const decrypted = await decryptMessage(
      encrypted,
      peerIdForBob,
      bob.privateKey,
      alicePub,
      messageId,
    )
    expect(decrypted).toBe(plaintext)
  })

  it('空字符串与 unicode 往返正确', async () => {
    const alice = await generateKeyPair()
    const bob = await generateKeyPair()
    const bobPub = await importPeerPublicKey(await exportPublicKey(bob))
    const alicePub = await importPeerPublicKey(await exportPublicKey(alice))

    for (const text of ['', 'hello', '🌍 中文 émojis', 'a'.repeat(1000)]) {
      const enc = await encryptMessage(text, 'bob', alice.privateKey, bobPub, `id-${text.length}`)
      const dec = await decryptMessage(enc, 'alice', bob.privateKey, alicePub, `id-${text.length}`)
      expect(dec).toBe(text)
    }
  })

  it('错误私钥无法解密', async () => {
    const alice = await generateKeyPair()
    const bob = await generateKeyPair()
    const attacker = await generateKeyPair()
    const bobPub = await importPeerPublicKey(await exportPublicKey(bob))
    const alicePub = await importPeerPublicKey(await exportPublicKey(alice))

    const enc = await encryptMessage('secret', 'bob', alice.privateKey, bobPub, 'msg-x')

    await expect(
      decryptMessage(enc, 'alice', attacker.privateKey, alicePub, 'msg-x'),
    ).rejects.toThrow()
  })

  it('篡改密文后解密失败', async () => {
    const alice = await generateKeyPair()
    const bob = await generateKeyPair()
    const bobPub = await importPeerPublicKey(await exportPublicKey(bob))
    const alicePub = await importPeerPublicKey(await exportPublicKey(alice))

    const enc = await encryptMessage('secret', 'bob', alice.privateKey, bobPub, 'msg-y')
    const tampered = { ...enc, data: enc.data.slice(0, -4) + 'AAAA' }

    await expect(
      decryptMessage(tampered, 'alice', bob.privateKey, alicePub, 'msg-y'),
    ).rejects.toThrow()
  })
})

describe('e2ee — 每消息 HKDF 密钥派生', () => {
  beforeEach(() => {
    clearAllSharedKeys()
  })

  it('相同明文、不同 messageId → 密文不同', async () => {
    const alice = await generateKeyPair()
    const bob = await generateKeyPair()
    const bobPub = await importPeerPublicKey(await exportPublicKey(bob))

    const plaintext = 'same content'
    const a = await encryptMessage(plaintext, 'bob', alice.privateKey, bobPub, 'msg-1')
    const b = await encryptMessage(plaintext, 'bob', alice.privateKey, bobPub, 'msg-2')

    expect(a.data).not.toBe(b.data)
  })

  it('用错误的 messageId 解密失败', async () => {
    const alice = await generateKeyPair()
    const bob = await generateKeyPair()
    const bobPub = await importPeerPublicKey(await exportPublicKey(bob))
    const alicePub = await importPeerPublicKey(await exportPublicKey(alice))

    const enc = await encryptMessage('secret', 'bob', alice.privateKey, bobPub, 'correct-id')

    await expect(
      decryptMessage(enc, 'alice', bob.privateKey, alicePub, 'wrong-id'),
    ).rejects.toThrow()
  })

  it('相同 messageId 可重复解密（共享密钥缓存一致）', async () => {
    const alice = await generateKeyPair()
    const bob = await generateKeyPair()
    const bobPub = await importPeerPublicKey(await exportPublicKey(bob))
    const alicePub = await importPeerPublicKey(await exportPublicKey(alice))

    const enc = await encryptMessage('cached', 'bob', alice.privateKey, bobPub, 'same-id')
    const d1 = await decryptMessage(enc, 'alice', bob.privateKey, alicePub, 'same-id')
    const d2 = await decryptMessage(enc, 'alice', bob.privateKey, alicePub, 'same-id')
    expect(d1).toBe('cached')
    expect(d2).toBe('cached')
  })
})

describe('e2ee — 共享密钥 LRU 缓存上限', () => {
  beforeEach(() => {
    clearAllSharedKeys()
  })

  it('超过 100 个 peer 时淘汰最旧共享密钥（上限恰为 100，非 101）', async () => {
    // deriveSharedKey 每次缓存未命中都会调用 deriveBits：
    // 用它计数可观察缓存是否命中（无需暴露内部 Map）
    const self = await generateKeyPair()
    const peers: KeyPair[] = []
    for (let i = 0; i < 101; i++) {
      peers.push(await generateKeyPair())
    }

    const spy = vi.spyOn(crypto.subtle, 'deriveBits')
    try {
      for (let i = 0; i < 101; i++) {
        await encryptMessage('x', 'peer-' + i, self.privateKey, peers[i].publicKey, 'msg-' + i)
      }
      const callsAfterInsert = spy.mock.calls.length

      // 最旧的 peer-0 若已被淘汰，本次会重新派生（deriveBits +1）
      await encryptMessage('y', 'peer-0', self.privateKey, peers[0].publicKey, 'msg-again')

      expect(spy.mock.calls.length).toBe(callsAfterInsert + 1)
    } finally {
      spy.mockRestore()
      clearAllSharedKeys()
    }
  })

  it('未超上限时最近使用的 peer 共享密钥仍命中缓存', async () => {
    const self = await generateKeyPair()
    const peer = await generateKeyPair()

    const spy = vi.spyOn(crypto.subtle, 'deriveBits')
    try {
      await encryptMessage('a', 'peer-keep', self.privateKey, peer.publicKey, 'm1')
      const callsAfterFirst = spy.mock.calls.length

      await encryptMessage('b', 'peer-keep', self.privateKey, peer.publicKey, 'm2')

      expect(spy.mock.calls.length).toBe(callsAfterFirst)
    } finally {
      spy.mockRestore()
      clearAllSharedKeys()
    }
  })
})

