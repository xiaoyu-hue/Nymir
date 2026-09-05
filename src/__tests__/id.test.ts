import { describe, it, expect } from 'vitest'
import { generateRoomId, isValidRoomId, generateMessageId } from '../utils/id'

describe('generateRoomId', () => {
  it('generates a 9-character ID', () => {
    const id = generateRoomId()
    expect(id.length).toBe(9)
  })

  it('uses only valid characters (uppercase + digits, no I/O/0/1)', () => {
    const validChars = /^[A-HJ-NP-Z2-9]+$/
    for (let i = 0; i < 10; i++) {
      const id = generateRoomId()
      expect(id).toMatch(validChars)
    }
  })

  it('generates unique IDs', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateRoomId())
    }
    expect(ids.size).toBe(100)
  })
})

describe('isValidRoomId', () => {
  it('validates a correctly generated ID', () => {
    const id = generateRoomId()
    expect(isValidRoomId(id)).toBe(true)
  })

  it('rejects IDs with wrong length', () => {
    expect(isValidRoomId('ABC')).toBe(false)
    expect(isValidRoomId('ABCDEFGHIJ')).toBe(false) // 10 chars
  })

  it('rejects IDs with invalid characters', () => {
    expect(isValidRoomId('ABCDEFGH0')).toBe(false) // 0 is invalid
    expect(isValidRoomId('ABCDEFGH1')).toBe(false) // 1 is invalid
    expect(isValidRoomId('ABCDEFGHI')).toBe(false) // I is invalid
    expect(isValidRoomId('ABCDEFGHO')).toBe(false) // O is invalid
  })

  it('rejects IDs with wrong checksum', () => {
    const validId = generateRoomId()
    // Tamper with last character (checksum)
    const tampered = validId.slice(0, 8) + (validId[8] === 'A' ? 'B' : 'A')
    expect(isValidRoomId(tampered)).toBe(false)
  })
})

describe('generateMessageId', () => {
  it('generates a unique ID containing timestamp', () => {
    const id = generateMessageId()
    expect(id).toContain('-')
    const [timestamp] = id.split('-')
    expect(Number(timestamp)).toBeGreaterThan(0)
  })

  it('generates unique message IDs', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 50; i++) {
      ids.add(generateMessageId())
    }
    expect(ids.size).toBe(50)
  })
})
