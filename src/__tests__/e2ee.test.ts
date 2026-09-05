import { describe, it, expect } from 'vitest'
import {
  generateKeyPair,
  exportPublicKey,
  clearSharedKey,
  clearAllSharedKeys,
} from '../security/e2ee'

describe('e2ee', () => {
  it('generateKeyPair returns key pair with extractable keys', async () => {
    const keyPair = await generateKeyPair()
    expect(keyPair.publicKey).toBeDefined()
    expect(keyPair.privateKey).toBeDefined()
    expect(keyPair.publicKey.extractable).toBe(true)
    expect(keyPair.privateKey.extractable).toBe(true)
  })

  it('exportPublicKey returns base64 string of correct length', async () => {
    const keyPair = await generateKeyPair()
    const exported = await exportPublicKey(keyPair)
    expect(typeof exported).toBe('string')
    // X25519 public key is 32 bytes, base64 encoded is ~44 chars
    expect(exported.length).toBeGreaterThan(30)
  })

  it('export produces consistent results for same key', async () => {
    const keyPair = await generateKeyPair()
    const a = await exportPublicKey(keyPair)
    const b = await exportPublicKey(keyPair)
    expect(a).toBe(b)
  })

  it('clearSharedKey and clearAllSharedKeys do not throw', () => {
    expect(() => clearSharedKey('nonexistent')).not.toThrow()
    expect(() => clearAllSharedKeys()).not.toThrow()
  })

  it('different key pairs produce different public keys', async () => {
    const a = await generateKeyPair()
    const b = await generateKeyPair()
    const pubA = await exportPublicKey(a)
    const pubB = await exportPublicKey(b)
    expect(pubA).not.toBe(pubB)
  })
})
