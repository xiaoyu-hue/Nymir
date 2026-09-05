import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getAnonymousId, getRoomDisplayName, resetAnonymousId } from '../security/pseudonym'

// Mock localStorage
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]) }),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k])
  vi.clearAllMocks()
})

describe('getAnonymousId', () => {
  it('generates and stores a new ID on first call', () => {
    const id = getAnonymousId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(localStorageMock.setItem).toHaveBeenCalled()
  })

  it('returns the same ID on subsequent calls', () => {
    const id1 = getAnonymousId()
    const id2 = getAnonymousId()
    expect(id1).toBe(id2)
  })
})

describe('getRoomDisplayName', () => {
  it('returns anonymous ID for self', () => {
    const selfId = getAnonymousId()
    const result = getRoomDisplayName('room1', 'my-peer-id', true)
    expect(result).toBe(selfId)
  })

  it('generates a name for other peers', () => {
    const result = getRoomDisplayName('room1', 'peer-x', false)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns consistent name for same room + peer', () => {
    const r1 = getRoomDisplayName('room1', 'peer-x', false)
    const r2 = getRoomDisplayName('room1', 'peer-x', false)
    expect(r1).toBe(r2)
  })

  it('returns different names for different peers', () => {
    const r1 = getRoomDisplayName('room1', 'peer-a', false)
    const r2 = getRoomDisplayName('room1', 'peer-b', false)
    expect(r1).not.toBe(r2)
  })
})

describe('resetAnonymousId', () => {
  it('returns a new ID different from the previous one', () => {
    const oldId = getAnonymousId()
    const newId = resetAnonymousId()
    expect(newId).not.toBe(oldId)
    expect(typeof newId).toBe('string')
  })
})
