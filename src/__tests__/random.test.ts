import { describe, it, expect } from 'vitest'
import { secureRandomInt } from '../utils/random'

describe('random', () => {
  it('secureRandomInt returns value in range [0, max)', () => {
    for (let i = 0; i < 100; i++) {
      const val = secureRandomInt(10)
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(10)
    }
  })

  it('secureRandomInt with max=1 always returns 0', () => {
    expect(secureRandomInt(1)).toBe(0)
  })

  it('secureRandomInt produces varied output', () => {
    const results = new Set<number>()
    for (let i = 0; i < 200; i++) {
      results.add(secureRandomInt(50))
    }
    // With 200 rolls of [0,50), expect at least 10 distinct values
    expect(results.size).toBeGreaterThanOrEqual(10)
  })
})
