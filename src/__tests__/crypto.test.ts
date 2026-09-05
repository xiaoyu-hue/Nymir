import { describe, it, expect } from 'vitest'
import { encrypt, decrypt, verifyPassword, needsMigration } from '../security/crypto'

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

  it('needsMigration returns false for v2 data', async () => {
    const encrypted = await encrypt('data', password)
    expect(needsMigration(encrypted)).toBe(false)
  })

  it('encrypt produces different ciphertext each time (random salt/iv)', async () => {
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
})
