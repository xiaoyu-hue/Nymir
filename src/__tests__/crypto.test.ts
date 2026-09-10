import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  encrypt,
  decrypt,
  verifyPassword,
  needsMigration,
  clearCryptoCache,
} from '../security/crypto'
import { uint8ToBase64 } from '../utils/base64'

const PBKDF2_ITERATIONS_V1 = 100_000
const PBKDF2_ITERATIONS_V2 = 600_000
const SALT_LENGTH = 16
const IV_LENGTH = 12

async function deriveLegacyKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * 手工构造 v1 旧格式密文（100k 迭代、无版本字节、随机盐）。
 * salt[0] 固定为 0x01，避免与 v2/v3 版本字节（0x02/0x03）随机撞上造成误判。
 */
async function makeLegacyV1(plaintext: string, password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  salt[0] = 0x01
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await deriveLegacyKey(password, salt, PBKDF2_ITERATIONS_V1)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext),
  )
  const combined = new Uint8Array(SALT_LENGTH + IV_LENGTH + ciphertext.byteLength)
  combined.set(salt, 0)
  combined.set(iv, SALT_LENGTH)
  combined.set(new Uint8Array(ciphertext), SALT_LENGTH + IV_LENGTH)
  return uint8ToBase64(combined)
}

/** 手工构造 v2 旧格式密文（600k 迭代、0x02 版本字节、随机盐） */
async function makeLegacyV2(plaintext: string, password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await deriveLegacyKey(password, salt, PBKDF2_ITERATIONS_V2)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext),
  )
  const combined = new Uint8Array(1 + SALT_LENGTH + IV_LENGTH + ciphertext.byteLength)
  combined[0] = 0x02
  combined.set(salt, 1)
  combined.set(iv, 1 + SALT_LENGTH)
  combined.set(new Uint8Array(ciphertext), 1 + SALT_LENGTH + IV_LENGTH)
  return uint8ToBase64(combined)
}

afterEach(() => {
  clearCryptoCache()
})

describe('crypto', () => {
  const password = 'test-password-123'

  it('encrypt and decrypt roundtrip', async () => {
    const plaintext = 'hello nymir'
    const encrypted = await encrypt(plaintext, password)
    expect(encrypted).toBeTruthy()
    expect(typeof encrypted).toBe('string')

    const decrypted = await decrypt(encrypted, password)
    expect(decrypted).toBe(plaintext)
  })

  it('different passwords fail decryption', async () => {
    const encrypted = await encrypt('secret', password)
    await expect(decrypt(encrypted, 'wrong-password')).rejects.toThrow()
  })

  it('verifyPassword returns true for correct password', async () => {
    const encrypted = await encrypt('data', password)
    expect(await verifyPassword(encrypted, password)).toBe(true)
  })

  it('verifyPassword returns false for wrong password', async () => {
    const encrypted = await encrypt('data', password)
    expect(await verifyPassword(encrypted, 'wrong')).toBe(false)
  })

  it('needsMigration returns false for v3 data (fresh encrypt)', async () => {
    const encrypted = await encrypt('data', password)
    expect(needsMigration(encrypted)).toBe(false)
  })

  it('encrypt produces different ciphertext each time (random iv)', async () => {
    const a = await encrypt('same', password)
    const b = await encrypt('same', password)
    expect(a).not.toBe(b)
  })

  it('handles empty string', async () => {
    const encrypted = await encrypt('', password)
    const decrypted = await decrypt(encrypted, password)
    expect(decrypted).toBe('')
  })

  it('handles unicode', async () => {
    const text = '你好世界 🌍 émojis'
    const encrypted = await encrypt(text, password)
    const decrypted = await decrypt(encrypted, password)
    expect(decrypted).toBe(text)
  })

  it('v1 旧格式（100k 随机盐）仍可解密，且 needsMigration 为 true', async () => {
    const legacy = await makeLegacyV1('legacy-v1', password)
    expect(await decrypt(legacy, password)).toBe('legacy-v1')
    expect(needsMigration(legacy)).toBe(true)
  })

  it('v2 旧格式（600k 随机盐）仍可解密，且 needsMigration 为 true', async () => {
    const legacy = await makeLegacyV2('legacy-v2', password)
    expect(await decrypt(legacy, password)).toBe('legacy-v2')
    expect(needsMigration(legacy)).toBe(true)
  })

  it('同密码多次 encrypt 只派生一次密钥（会话缓存生效）', async () => {
    clearCryptoCache()
    const spy = vi.spyOn(crypto.subtle, 'deriveKey')
    try {
      await encrypt('a', password)
      await encrypt('b', password)
      expect(spy.mock.calls.length).toBe(1)
    } finally {
      spy.mockRestore()
    }
  })

  it('切换密码时重新派生密钥（缓存按密码区分）', async () => {
    clearCryptoCache()
    const spy = vi.spyOn(crypto.subtle, 'deriveKey')
    try {
      await encrypt('a', password)
      await encrypt('b', 'another-password')
      expect(spy.mock.calls.length).toBe(2)
    } finally {
      spy.mockRestore()
    }
  })

  it('clearCryptoCache 后重新派生密钥', async () => {
    clearCryptoCache()
    await encrypt('warm', password)
    clearCryptoCache()
    const spy = vi.spyOn(crypto.subtle, 'deriveKey')
    try {
      await encrypt('cold', password)
      expect(spy.mock.calls.length).toBe(1)
    } finally {
      spy.mockRestore()
    }
  })
})
