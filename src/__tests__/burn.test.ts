import { describe, it, expect } from 'vitest'
import { shouldDestroy, getRemainingMs } from '../core/burn'
import { BurnMode } from '../core/types'
import type { Message } from '../core/types'

function makeMsg(overrides: Partial<Message> = {}): Message {
  return {
    id: 'test-msg',
    content: 'hello',
    sender: 'peer1',
    timestamp: Date.now(),
    burnMode: BurnMode.PERSIST,
    readBy: [],
    destroyed: false,
    ...overrides,
  }
}

describe('shouldDestroy', () => {
  it('returns true if already destroyed', () => {
    const msg = makeMsg({ destroyed: true })
    expect(shouldDestroy(msg)).toBe(true)
  })

  it('returns false for persist mode', () => {
    const msg = makeMsg({ burnMode: BurnMode.PERSIST })
    expect(shouldDestroy(msg)).toBe(false)
  })

  describe('read_once mode', () => {
    it('returns false when not read', () => {
      const msg = makeMsg({ burnMode: BurnMode.READ_ONCE, readBy: [] })
      expect(shouldDestroy(msg)).toBe(false)
    })

    it('returns true when read by someone', () => {
      const msg = makeMsg({ burnMode: BurnMode.READ_ONCE, readBy: ['peer1'] })
      expect(shouldDestroy(msg)).toBe(true)
    })
  })

  describe('timed mode', () => {
    it('returns false when time not elapsed', () => {
      const msg = makeMsg({
        burnMode: BurnMode.TIMED,
        burnAfter: 60,
        timestamp: Date.now(),
      })
      expect(shouldDestroy(msg)).toBe(false)
    })

    it('returns true when time elapsed', () => {
      const msg = makeMsg({
        burnMode: BurnMode.TIMED,
        burnAfter: 1,
        timestamp: Date.now() - 2000,
      })
      expect(shouldDestroy(msg)).toBe(true)
    })
  })

  describe('scheduled mode', () => {
    it('returns false when burn time not reached', () => {
      const msg = makeMsg({
        burnMode: BurnMode.SCHEDULED,
        burnAt: Date.now() + 60000,
      })
      expect(shouldDestroy(msg)).toBe(false)
    })

    it('returns true when burn time reached', () => {
      const msg = makeMsg({
        burnMode: BurnMode.SCHEDULED,
        burnAt: Date.now() - 1000,
      })
      expect(shouldDestroy(msg)).toBe(true)
    })
  })
})

describe('getRemainingMs', () => {
  it('returns Infinity for persist mode', () => {
    const msg = makeMsg({ burnMode: BurnMode.PERSIST })
    expect(getRemainingMs(msg)).toBe(Infinity)
  })

  describe('read_once mode', () => {
    it('returns Infinity when not read', () => {
      const msg = makeMsg({ burnMode: BurnMode.READ_ONCE, readBy: [] })
      expect(getRemainingMs(msg)).toBe(Infinity)
    })

    it('returns 0 when read', () => {
      const msg = makeMsg({ burnMode: BurnMode.READ_ONCE, readBy: ['peer1'] })
      expect(getRemainingMs(msg)).toBe(0)
    })
  })

  describe('timed mode', () => {
    it('returns positive value when time remains', () => {
      const msg = makeMsg({
        burnMode: BurnMode.TIMED,
        burnAfter: 60,
        timestamp: Date.now(),
      })
      const remaining = getRemainingMs(msg)
      expect(remaining).toBeGreaterThan(0)
      expect(remaining).toBeLessThanOrEqual(60000)
    })

    it('returns 0 when time elapsed', () => {
      const msg = makeMsg({
        burnMode: BurnMode.TIMED,
        burnAfter: 1,
        timestamp: Date.now() - 2000,
      })
      expect(getRemainingMs(msg)).toBe(0)
    })
  })

  describe('scheduled mode', () => {
    it('returns positive value when time remains', () => {
      const burnAt = Date.now() + 30000
      const msg = makeMsg({ burnMode: BurnMode.SCHEDULED, burnAt })
      const remaining = getRemainingMs(msg)
      expect(remaining).toBeGreaterThan(0)
      expect(remaining).toBeLessThanOrEqual(30000)
    })

    it('returns 0 when time reached', () => {
      const msg = makeMsg({
        burnMode: BurnMode.SCHEDULED,
        burnAt: Date.now() - 1000,
      })
      expect(getRemainingMs(msg)).toBe(0)
    })
  })
})
