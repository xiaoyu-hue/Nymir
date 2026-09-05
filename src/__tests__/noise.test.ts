import { describe, it, expect } from 'vitest'
import { isNoiseMessage } from '../security/noise'

describe('isNoiseMessage', () => {
  it('returns false when sender field is present', () => {
    const data = { sender: 'peer1', content: 'hello world test', encrypted: false, burnMode: 'read_once' }
    expect(isNoiseMessage(data)).toBe(false)
  })

  it('returns false when encrypted is not false', () => {
    const data = { content: 'hello world test', encrypted: true, burnMode: 'read_once' }
    expect(isNoiseMessage(data)).toBe(false)
  })

  it('returns false when signature is present', () => {
    const data = { content: 'hello world test', encrypted: false, signature: 'abc', burnMode: 'read_once' }
    expect(isNoiseMessage(data)).toBe(false)
  })

  it('returns false when burnMode is not read_once', () => {
    const data = { content: 'hello world test', encrypted: false, burnMode: 'persist' }
    expect(isNoiseMessage(data)).toBe(false)
  })

  it('returns false when content is not a string', () => {
    const data = { content: 123, encrypted: false, burnMode: 'read_once' }
    expect(isNoiseMessage(data)).toBe(false)
  })

  it('returns false when content is too short (<=10 chars)', () => {
    const data = { content: 'short', encrypted: false, burnMode: 'read_once' }
    expect(isNoiseMessage(data)).toBe(false)
  })

  it('returns true for a valid noise message', () => {
    const data = {
      id: 'fakeid12345678901234',
      content: 'This is a noise message with enough length',
      timestamp: Date.now(),
      encrypted: false,
      burnMode: 'read_once',
      readBy: [],
      destroyed: false,
    }
    expect(isNoiseMessage(data)).toBe(true)
  })

  it('returns false for empty object', () => {
    expect(isNoiseMessage({})).toBe(false)
  })

  it('returns false for random object with sender', () => {
    expect(isNoiseMessage({ sender: 'real-peer', random: 'data' })).toBe(false)
  })
})
