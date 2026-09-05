import { describe, it, expect } from 'vitest'
import { isNoiseMessage } from '../security/noise'

describe('isNoiseMessage', () => {
  it('returns false when sender field is present', () => {
    const data = { sender: 'peer1', content: 'hello world test', encrypted: true, burnMode: 'read_once' }
    expect(isNoiseMessage(data)).toBe(false)
  })

  it('returns false when encrypted is not true', () => {
    const data = { content: 'hello world test', encrypted: false, burnMode: 'read_once' }
    expect(isNoiseMessage(data)).toBe(false)
  })

  it('returns false when signature is present', () => {
    const data = { content: 'hello world test', encrypted: true, signature: 'abc', burnMode: 'read_once' }
    expect(isNoiseMessage(data)).toBe(false)
  })

  it('returns false when burnMode is not read_once', () => {
    const data = { content: 'hello world test', encrypted: true, burnMode: 'persist' }
    expect(isNoiseMessage(data)).toBe(false)
  })

  it('returns false when content is not a string', () => {
    const data = { content: 123, encrypted: true, burnMode: 'read_once' }
    expect(isNoiseMessage(data)).toBe(false)
  })

  it('returns false when content is too short (<=10 chars)', () => {
    const data = { content: 'short', encrypted: true, burnMode: 'read_once' }
    expect(isNoiseMessage(data)).toBe(false)
  })

  it('returns true for a valid noise message', () => {
    const data = {
      id: 'fakeid12345678901234',
      content: 'This is a noise message with enough length',
      timestamp: Date.now(),
      encrypted: true,
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

describe('isNoiseMessage — 真实消息与恶意构造', () => {
  it('不得把带 sender 的真实消息形态误判为噪声（含完整聊天字段）', () => {
    const real = {
      id: 'realMsgIdABCDEFGH12',
      content: 'ciphertext-looking-base64-payload-xxxxxx',
      sender: 'peer-abc',
      timestamp: Date.now(),
      burnMode: 'persist' as const,
      encrypted: true,
      signature: 'sig-bytes',
      sig: 2,
    }
    expect(isNoiseMessage(real)).toBe(false)
  })

  it('不带 sender、encrypted+read_once+无签名 的合法外观载荷会被判为噪声', () => {
    const lookalike = {
      id: 'fakeid12345678901234',
      content: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      timestamp: Date.now(),
      burnMode: 'read_once',
      encrypted: true,
      readBy: [],
      destroyed: false,
    }
    expect(isNoiseMessage(lookalike)).toBe(true)
  })

  it('不带 sender 但带 signature 的载荷不会被当成噪声（可能进入验签路径）', () => {
    const malicious = {
      id: 'evilMsgId1234567890',
      content: 'plaintext-or-cipher-with-enough-len',
      timestamp: Date.now(),
      burnMode: 'persist',
      encrypted: false,
      signature: 'forged-or-any',
      sig: 2,
    }
    expect(isNoiseMessage(malicious)).toBe(false)
  })
})
