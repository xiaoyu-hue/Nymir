/**
 * 自动密钥轮换（ADR-007 可验证自动策略）单元测试
 *
 * 策略（与 e2eeManager.recordMessageSent 注释一致）：
 * - 每发送 AUTO_ROTATION_INTERVAL（100）条消息触发一次 rotateKeysVerifiable()——
 *   签名衔接证明经 key-rotation 通道广播，对端验签通过才 re-pin；
 * - 仅在至少一个对端在线时触发（onlinePeerCount > 0），对端离线时跳过，
 *   计数继续累计，待下次在线发消息时补触发；
 * - 轮换后计数清零，可再次累计触发。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { clearAllSharedKeys } from '../security/e2ee'
import { AUTO_ROTATION_INTERVAL } from '../security/e2eeManager'

// mock db：身份持久化在这些单元测试里不需要真写 IndexedDB
vi.mock('../persistence/db', () => ({
  saveIdentity: vi.fn(async () => {}),
  loadIdentity: vi.fn(async () => undefined),
  clearAllData: vi.fn(async () => {}),
}))

/** 用一个全新管理器实例（单例 + resetModules 保证隔离） */
async function freshManager() {
  vi.resetModules()
  const { e2eeManager, securityManager } = await import('../security')
  await securityManager.setupPassword('test-password-123')
  await e2eeManager.init()
  await e2eeManager.loadIdentity()
  return { e2eeManager }
}

type E2eeManagerLike = Awaited<ReturnType<typeof freshManager>>['e2eeManager']

/** 让 fire-and-forget 的异步轮换完成 */
const flush = () => new Promise((resolve) => setTimeout(resolve, 30))

describe('自动密钥轮换（ADR-007 可验证自动策略）', () => {
  const memoryStore: Record<string, string> = {}
  let e2ee: E2eeManagerLike

  beforeEach(async () => {
    clearAllSharedKeys()
    Object.keys(memoryStore).forEach((k) => delete memoryStore[k])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memoryStore[key] ?? null,
      setItem: (key: string, value: string) => {
        memoryStore[key] = value
      },
      removeItem: (key: string) => {
        delete memoryStore[key]
      },
      clear: () => {
        Object.keys(memoryStore).forEach((k) => delete memoryStore[k])
      },
      key: () => null,
      length: 0,
    })
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    })
    const m = await freshManager()
    e2ee = m.e2eeManager
  })

  afterEach(() => {
    clearAllSharedKeys()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('未达阈值不触发（99 条、对端在线）', async () => {
    const before = e2ee.publicKeyString
    let triggered = false
    for (let i = 0; i < AUTO_ROTATION_INTERVAL - 1; i++) {
      if (e2ee.recordMessageSent(1)) triggered = true
    }
    expect(triggered).toBe(false)
    expect(e2ee.publicKeyString).toBe(before)
  })

  it('达到阈值且对端在线时自动轮换：换新公钥 + 广播签名衔接证明', async () => {
    const notices: Array<{ proof: unknown; signature: unknown }> = []
    e2ee.onKeyRotation((n) => {
      if (n) notices.push(n)
    })
    const before = e2ee.publicKeyString

    let triggered = false
    for (let i = 0; i < AUTO_ROTATION_INTERVAL; i++) {
      if (e2ee.recordMessageSent(1)) triggered = true
    }
    expect(triggered).toBe(true)

    await flush()
    expect(e2ee.publicKeyString).not.toBe(before)
    expect(notices).toHaveLength(1)
    expect(notices[0].proof).toEqual(expect.any(String))
    expect(notices[0].signature).toEqual(expect.any(String))
  })

  it('对端离线时达到阈值不触发，之后在线发消息补触发', async () => {
    const before = e2ee.publicKeyString
    let triggered = false
    for (let i = 0; i < AUTO_ROTATION_INTERVAL; i++) {
      if (e2ee.recordMessageSent(0)) triggered = true
    }
    expect(triggered).toBe(false)
    expect(e2ee.publicKeyString).toBe(before)

    // 计数已满且对端上线：下一次发消息补触发
    expect(e2ee.recordMessageSent(1)).toBe(true)
    await flush()
    expect(e2ee.publicKeyString).not.toBe(before)
  })

  it('轮换后计数清零，可再次累计触发', async () => {
    // 第一次轮换
    for (let i = 0; i < AUTO_ROTATION_INTERVAL; i++) e2ee.recordMessageSent(1)
    await flush()
    const afterFirst = e2ee.publicKeyString
    expect(afterFirst).toBeTruthy()

    // 再发 99 条不触发
    let triggered = false
    for (let i = 0; i < AUTO_ROTATION_INTERVAL - 1; i++) {
      if (e2ee.recordMessageSent(1)) triggered = true
    }
    expect(triggered).toBe(false)
    expect(e2ee.publicKeyString).toBe(afterFirst)

    // 第 100 条再次触发
    expect(e2ee.recordMessageSent(1)).toBe(true)
    await flush()
    expect(e2ee.publicKeyString).not.toBe(afterFirst)
  })
})
