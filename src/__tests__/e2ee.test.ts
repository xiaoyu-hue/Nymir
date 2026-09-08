/**
 * E2EE 模块测试
 *
 * 覆盖威胁模型中的关键不变量：
 * - 消息内容机密性（双端往返）
 * - 每消息 HKDF 前向保密（不同 messageId → 不同密文）
 * - 错误密钥 / 错误 peer 解密失败
 * - 私钥不可导出
 * - 文件加解密往返
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateKeyPair,
  exportPublicKey,
  importPeerPublicKey,
  encryptMessage,
  decryptMessage,
  clearSharedKey,
  clearAllSharedKeys,
  encryptFile,
  decryptFile,
} from '../security/e2ee'

describe('e2ee — 密钥生成与导出', () => {
  it('generateKeyPair: 公钥可导出，私钥不可导出', async () => {
    const keyPair = await generateKeyPair()
    expect(keyPair.publicKey).toBeDefined()
    expect(keyPair.privateKey).toBeDefined()
    expect(keyPair.publicKey.extractable).toBe(true)
    expect(keyPair.privateKey.extractable).toBe(false)
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

describe('e2ee — 每消息 HKDF 前向保密', () => {
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

describe('e2ee — 文件加解密', () => {
  beforeEach(() => {
    clearAllSharedKeys()
  })

  it('小文件往返正确', async () => {
    const alice = await generateKeyPair()
    const bob = await generateKeyPair()
    const bobPub = await importPeerPublicKey(await exportPublicKey(bob))
    const alicePub = await importPeerPublicKey(await exportPublicKey(alice))

    const original = new TextEncoder().encode('file content bytes').buffer
    const encrypted = await encryptFile(original, 'bob', alice.privateKey, bobPub)
    expect(encrypted).not.toBeNull()
    expect(encrypted!.byteLength).toBeGreaterThan(original.byteLength)

    const decrypted = await decryptFile(encrypted!, 'alice', bob.privateKey, alicePub)
    expect(decrypted).not.toBeNull()
    expect(new TextDecoder().decode(decrypted!)).toBe('file content bytes')
  })

  it('空文件往返正确', async () => {
    const alice = await generateKeyPair()
    const bob = await generateKeyPair()
    const bobPub = await importPeerPublicKey(await exportPublicKey(bob))
    const alicePub = await importPeerPublicKey(await exportPublicKey(alice))

    const original = new ArrayBuffer(0)
    const encrypted = await encryptFile(original, 'bob', alice.privateKey, bobPub)
    expect(encrypted).not.toBeNull()

    const decrypted = await decryptFile(encrypted!, 'alice', bob.privateKey, alicePub)
    expect(decrypted).not.toBeNull()
    expect(decrypted!.byteLength).toBe(0)
  })

  it('错误密钥解密文件返回 null', async () => {
    const alice = await generateKeyPair()
    const bob = await generateKeyPair()
    const attacker = await generateKeyPair()
    const bobPub = await importPeerPublicKey(await exportPublicKey(bob))
    const alicePub = await importPeerPublicKey(await exportPublicKey(alice))

    const original = new TextEncoder().encode('secret-file').buffer
    const encrypted = await encryptFile(original, 'bob', alice.privateKey, bobPub)
    expect(encrypted).not.toBeNull()

    const result = await decryptFile(encrypted!, 'alice', attacker.privateKey, alicePub)
    expect(result).toBeNull()
  })
})
