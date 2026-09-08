/**
 * secureDelete 行为测试（不改实现，只锁定真实行为契约）
 *
 * 注意：clearLocalStorage 使用 Object.keys(localStorage) 枚举键，
 * 因此测试替身必须把数据键作为对象自有属性存放。
 * 已知局限（README 已披露）：removeItem 无覆写，浏览器不保证物理擦除。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { clearLocalStorage } from '../security/secureDelete'

/* eslint-disable @typescript-eslint/no-explicit-any */
function installLocalStorage() {
  const store: any = {}
  // 方法定义为不可枚举，与浏览器真实 localStorage 行为一致
  //（真实 localStorage 的数据键是自有可枚举属性，方法在原型链上）
  const methods = {
    getItem(k: string) {
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null
    },
    setItem(k: string, v: string) {
      store[k] = v
    },
    removeItem(k: string) {
      delete store[k]
    },
    clear() {
      for (const k of Object.keys(store)) delete store[k]
    },
  }
  for (const [name, fn] of Object.entries(methods)) {
    Object.defineProperty(store, name, { value: fn, enumerable: false })
  }
  ;(globalThis as any).localStorage = store
  return store
}
/* eslint-enable @typescript-eslint/no-explicit-any */

let store: ReturnType<typeof installLocalStorage>

beforeEach(() => {
  store = installLocalStorage()
})

describe('secureDelete.clearLocalStorage', () => {
  it('清除所有匹配前缀的键', () => {
    store.setItem('nymir_a', '1')
    store.setItem('nymir_b', '2')
    store.setItem('nymir_c_d', '3')
    clearLocalStorage('nymir_')
    expect(store.getItem('nymir_a')).toBeNull()
    expect(store.getItem('nymir_b')).toBeNull()
    expect(store.getItem('nymir_c_d')).toBeNull()
  })

  it('不误删其他前缀的键', () => {
    store.setItem('nymir_secret', 'x')
    store.setItem('other_key', 'keep-me')
    store.setItem('theme', 'dark')
    clearLocalStorage('nymir_')
    expect(store.getItem('other_key')).toBe('keep-me')
    expect(store.getItem('theme')).toBe('dark')
  })

  it('前缀是 startsWith 语义：前面多字符不匹配', () => {
    store.setItem('xnymir_notmine', 'keep-me')
    clearLocalStorage('nymir_')
    expect(store.getItem('xnymir_notmine')).toBe('keep-me')
  })

  it('键名与前缀完全相等时也会被清除', () => {
    store.setItem('nymir_', 'exact')
    clearLocalStorage('nymir_')
    expect(store.getItem('nymir_')).toBeNull()
  })

  it('空 storage 调用不报错', () => {
    expect(() => clearLocalStorage('nymir_')).not.toThrow()
  })

  it('幂等：连续调用两次结果一致', () => {
    store.setItem('nymir_k', 'v')
    clearLocalStorage('nymir_')
    expect(() => clearLocalStorage('nymir_')).not.toThrow()
    expect(store.getItem('nymir_k')).toBeNull()
  })

  it('空前缀会清除全部键（startsWith("") 恒真——记录该行为）', () => {
    store.setItem('a', '1')
    store.setItem('b', '2')
    clearLocalStorage('')
    expect(store.getItem('a')).toBeNull()
    expect(store.getItem('b')).toBeNull()
  })
})
