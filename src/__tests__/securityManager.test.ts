/**
 * security/manager 安全管理器测试（锁定/解锁状态机、暴力破解防护、自动锁定、重置）
 *
 * 说明：
 * - manager 是模块级单例，每个用例通过 vi.resetModules + 动态 import 取得全新实例
 * - localStorage/sessionStorage 用不可枚举方法的替身（与浏览器枚举行为一致）
 * - 加密走真实 WebCrypto（PBKDF2 较慢属预期）
 * - 时间相关用例使用假定时器（Date.now 一并被接管，与实现内 lockUntil 计算一致）
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOCK_TIMEOUT_MS } from '../constants'

vi.mock('../persistence/db', () => ({
  clearAllData: vi.fn(async () => {}),
}))

/* eslint-disable @typescript-eslint/no-explicit-any */
function installStorage(name: 'localStorage' | 'sessionStorage') {
  const store: any = {}
  const methods = {
    getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k]
    },
  }
  for (const [key, fn] of Object.entries(methods)) {
    Object.defineProperty(store, key, { value: fn, enumerable: false })
  }
  ;(globalThis as any)[name] = store
  return store
}
/* eslint-enable @typescript-eslint/no-explicit-any */

type Manager = typeof import('../security/manager').securityManager

let localStore: any
let manager: Manager

async function freshManager(): Promise<Manager> {
  vi.resetModules()
  const mod = await import('../security/manager')
  return mod.securityManager
}

beforeEach(async () => {
  vi.useFakeTimers()
  localStore = installStorage('localStorage')
  installStorage('sessionStorage')
  manager = await freshManager()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const PWD = 'correct-horse-battery'

describe('securityManager 初始状态', () => {
  it('初始为锁定且未设置密码', async () => {
    await manager.init()
    expect(manager.isLocked).toBe(true)
    expect(manager.isSetup).toBe(false)
    expect(manager.failedAttempts).toBe(0)
  })

  it('未设置密码时 unlock 返回 false', async () => {
    await manager.init()
    expect(await manager.unlock(PWD)).toBe(false)
  })
})

describe('securityManager setupPassword / lock / unlock', () => {
  it('setupPassword 后：解锁、isSetup=true、密码哈希已落盘', async () => {
    await manager.setupPassword(PWD)
    expect(manager.isLocked).toBe(false)
    expect(manager.isSetup).toBe(true)
    expect(localStore.getItem('nymir_pwd_hash')).not.toBeNull()
    expect(manager.getCachedPassword()).toBe(PWD)
  })

  it('setupPassword/lock 会通知 onLockChange 监听器', async () => {
    const events: boolean[] = []
    manager.onLockChange((locked) => events.push(locked))
    await manager.setupPassword(PWD)
    manager.lock()
    expect(events).toEqual([false, true])
  })

  it('退订后不再收到通知', async () => {
    const events: boolean[] = []
    const unsub = manager.onLockChange((locked) => events.push(locked))
    await manager.setupPassword(PWD)
    unsub()
    manager.lock()
    expect(events).toEqual([false])
  })

  it('lock 后：密码缓存清空，encrypt/decrypt 均抛错（注释已同步为此行为）', async () => {
    await manager.setupPassword(PWD)
    manager.lock()
    expect(manager.isLocked).toBe(true)
    expect(manager.getCachedPassword()).toBeNull()
    await expect(manager.encrypt('x')).rejects.toThrow('Security: no password set')
    await expect(manager.decrypt('x')).rejects.toThrow('Security: locked')
  })

  it('解锁状态下 encrypt→decrypt 往返一致', async () => {
    await manager.setupPassword(PWD)
    const cipher = await manager.encrypt('树洞秘密 🔒')
    expect(cipher).not.toContain('树洞秘密')
    expect(await manager.decrypt(cipher)).toBe('树洞秘密 🔒')
  })

  it('lock 后正确密码可重新 unlock，错误密码返回 false 并计数', async () => {
    await manager.setupPassword(PWD)
    manager.lock()
    expect(await manager.unlock('wrong-password')).toBe(false)
    expect(manager.failedAttempts).toBe(1)
    expect(await manager.unlock(PWD)).toBe(true)
    expect(manager.isLocked).toBe(false)
    expect(manager.failedAttempts).toBe(0)
  })
})

describe('securityManager 暴力破解防护', () => {
  it('连错 5 次进入 30 秒锁定期：期间正确密码也拒绝，到期后恢复', async () => {
    await manager.setupPassword(PWD)
    manager.lock()

    for (let i = 0; i < 5; i++) {
      expect(await manager.unlock('bad-' + i)).toBe(false)
    }
    expect(manager.failedAttempts).toBe(5)
    expect(manager.lockUntil).toBeGreaterThan(Date.now())

    // 锁定期内：正确密码也被拒绝
    expect(await manager.unlock(PWD)).toBe(false)

    // 30 秒后：恢复可用
    vi.advanceTimersByTime(30_001)
    expect(await manager.unlock(PWD)).toBe(true)
    expect(manager.isLocked).toBe(false)
  })
})

describe('securityManager 自动锁定', () => {
  it('无操作达到 LOCK_TIMEOUT_MS 后自动锁定', async () => {
    await manager.setupPassword(PWD)
    expect(manager.isLocked).toBe(false)
    vi.advanceTimersByTime(LOCK_TIMEOUT_MS + 100)
    expect(manager.isLocked).toBe(true)
    expect(manager.getCachedPassword()).toBeNull()
  })

  it('resetLockTimer 推迟自动锁定', async () => {
    await manager.setupPassword(PWD)
    vi.advanceTimersByTime(LOCK_TIMEOUT_MS - 10_000) // 差 10 秒锁定
    manager.resetLockTimer() // 用户交互，重新计时
    vi.advanceTimersByTime(LOCK_TIMEOUT_MS - 10_000)
    expect(manager.isLocked).toBe(false) // 仍未到新的期限
    vi.advanceTimersByTime(10_001)
    expect(manager.isLocked).toBe(true)
  })

  it('锁定状态下 resetLockTimer 不会意外解锁', async () => {
    await manager.setupPassword(PWD)
    manager.lock()
    manager.resetLockTimer()
    expect(manager.isLocked).toBe(true)
  })
})

describe('securityManager reset（忘记密码）', () => {
  it('清空数据库与全部 nymir_* 键，回到初始锁定状态', async () => {
    const { clearAllData } = await import('../persistence/db')
    await manager.setupPassword(PWD)
    localStore.setItem('nymir_rooms', '["r1"]')
    localStore.setItem('unrelated_key', 'keep-me')

    await manager.reset()

    expect(clearAllData).toHaveBeenCalled()
    expect(localStore.getItem('nymir_pwd_hash')).toBeNull()
    expect(localStore.getItem('nymir_rooms')).toBeNull()
    expect(localStore.getItem('unrelated_key')).toBe('keep-me')
    expect(manager.isLocked).toBe(true)
    expect(manager.isSetup).toBe(false)
    expect(manager.getCachedPassword()).toBeNull()
  })

  it('reset 通知监听器锁定事件', async () => {
    const events: boolean[] = []
    manager.onLockChange((locked) => events.push(locked))
    await manager.setupPassword(PWD)
    await manager.reset()
    expect(events).toEqual([false, true])
  })
})
