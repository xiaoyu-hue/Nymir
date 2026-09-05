import { describe, it, expect } from 'vitest'
import { formatTime, formatCountdown } from '../utils/time'

describe('formatTime', () => {
  it('returns a string containing hour and minute', () => {
    const date = new Date(2024, 0, 15, 14, 30, 0)
    const result = formatTime(date.getTime())
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })

  it('handles midnight', () => {
    const date = new Date(2024, 0, 15, 0, 0, 0)
    const result = formatTime(date.getTime())
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })

  it('handles end of day', () => {
    const date = new Date(2024, 0, 15, 23, 59, 59)
    const result = formatTime(date.getTime())
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })
})

describe('formatCountdown', () => {
  it('returns "0s" for zero', () => {
    expect(formatCountdown(0)).toBe('0s')
  })

  it('returns "0s" for negative values', () => {
    expect(formatCountdown(-1000)).toBe('0s')
  })

  it('formats seconds only when < 60s', () => {
    expect(formatCountdown(1000)).toBe('1s')
    expect(formatCountdown(15000)).toBe('15s')
    expect(formatCountdown(59000)).toBe('59s')
  })

  it('formats minutes and seconds when >= 60s', () => {
    expect(formatCountdown(60000)).toBe('1m 0s')
    expect(formatCountdown(65000)).toBe('1m 5s')
    expect(formatCountdown(120000)).toBe('2m 0s')
  })
})
