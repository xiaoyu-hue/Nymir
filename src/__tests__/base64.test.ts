import { describe, it, expect } from 'vitest'
import { uint8ToBase64, base64ToUint8 } from '../utils/base64'

describe('uint8ToBase64', () => {
  it('encodes empty array', () => {
    expect(uint8ToBase64(new Uint8Array(0))).toBe('')
  })

  it('encodes simple ASCII', () => {
    const input = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
    expect(uint8ToBase64(input)).toBe('SGVsbG8=')
  })

  it('encodes binary data', () => {
    const input = new Uint8Array([0, 1, 127, 128, 255])
    const result = uint8ToBase64(input)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('encodes large data without stack overflow', () => {
    // 100KB - previously caused stack overflow with spread operator
    const input = new Uint8Array(100 * 1024)
    for (let i = 0; i < input.length; i++) {
      input[i] = i % 256
    }
    const result = uint8ToBase64(input)
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('base64ToUint8', () => {
  it('decodes empty string', () => {
    const result = base64ToUint8('')
    expect(result.length).toBe(0)
  })

  it('decodes simple ASCII', () => {
    const result = base64ToUint8('SGVsbG8=')
    expect(Array.from(result)).toEqual([72, 101, 108, 108, 111])
  })

  it('decodes binary data', () => {
    const encoded = uint8ToBase64(new Uint8Array([0, 1, 127, 128, 255]))
    const result = base64ToUint8(encoded)
    expect(Array.from(result)).toEqual([0, 1, 127, 128, 255])
  })

  it('decodes large data', () => {
    const input = new Uint8Array(100 * 1024)
    for (let i = 0; i < input.length; i++) {
      input[i] = i % 256
    }
    const encoded = uint8ToBase64(input)
    const result = base64ToUint8(encoded)
    expect(result.length).toBe(input.length)
  })
})

describe('roundtrip', () => {
  it('encodes and decodes back to original', () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252, 253, 254, 255])
    const encoded = uint8ToBase64(original)
    const decoded = base64ToUint8(encoded)
    expect(Array.from(decoded)).toEqual(Array.from(original))
  })

  it('roundtrips 1MB of data', () => {
    const input = new Uint8Array(1024 * 1024)
    for (let i = 0; i < input.length; i++) {
      input[i] = i % 256
    }
    const encoded = uint8ToBase64(input)
    const decoded = base64ToUint8(encoded)
    expect(decoded.length).toBe(input.length)
    // Spot check
    expect(decoded[0]).toBe(0)
    expect(decoded[255]).toBe(255)
    expect(decoded[256]).toBe(0)
  })
})
