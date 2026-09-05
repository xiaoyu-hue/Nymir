/**
 * Nymir 安全管理器
 * 
 * 职责：
 * - 管理用户密码（内存中，用 Uint8Array 存储以便清零）
 * - 控制锁定/解锁状态
 * - 协调加密/解密操作
 * - 自动锁屏计时
 */

import { encrypt, decrypt, verifyPassword, needsMigration } from './crypto'
import { uint8ToBase64 } from '../utils/base64'
import { clearAllData } from '../persistence/db'
import { LOCK_TIMEOUT_MS } from '../constants'

const STORAGE_KEY_PASSWORD_HASH = 'nymir_pwd_hash'
const STORAGE_KEY_FAILED_ATTEMPTS = 'nymir_failed_attempts'
const STORAGE_KEY_LOCK_UNTIL = 'nymir_lock_until'

export type LockListener = (locked: boolean) => void

function stringToUint8Array(str: string): Uint8Array {
  const encoder = new TextEncoder()
  return encoder.encode(str)
}

function clearUint8Array(arr: Uint8Array | null): void {
  if (arr) arr.fill(0)
}

class SecurityManager {
  private password: Uint8Array | null = null
  private locked = true
  private lockTimer: ReturnType<typeof setTimeout> | null = null
  private lockListeners: LockListener[] = []
  private initialized = false
  private _cachedPassword: string | null = null

  get failedAttempts(): number {
    return parseInt(sessionStorage.getItem(STORAGE_KEY_FAILED_ATTEMPTS) || '0', 10)
  }

  set failedAttempts(val: number) {
    if (val <= 0) {
      sessionStorage.removeItem(STORAGE_KEY_FAILED_ATTEMPTS)
    } else {
      sessionStorage.setItem(STORAGE_KEY_FAILED_ATTEMPTS, String(val))
    }
  }

  get lockUntil(): number {
    return parseInt(sessionStorage.getItem(STORAGE_KEY_LOCK_UNTIL) || '0', 10)
  }

  set lockUntil(val: number) {
    if (val <= 0) {
      sessionStorage.removeItem(STORAGE_KEY_LOCK_UNTIL)
    } else {
      sessionStorage.setItem(STORAGE_KEY_LOCK_UNTIL, String(val))
    }
  }

  get isLocked(): boolean {
    return this.locked
  }

  get isSetup(): boolean {
    return localStorage.getItem(STORAGE_KEY_PASSWORD_HASH) !== null
  }

  private setPassword(password: string): void {
    clearUint8Array(this.password)
    this.password = stringToUint8Array(password)
    this._cachedPassword = password
  }

  private clearPassword(): void {
    clearUint8Array(this.password)
    this.password = null
    this._cachedPassword = null
  }

  private getPasswordString(): string | null {
    return this._cachedPassword
  }

  /**
   * 获取缓存的密码（锁定后仍可用于加密新数据）
   * 解密旧数据仍需密码（锁定时返回 null）
   */
  getCachedPassword(): string | null {
    return this._cachedPassword
  }

  /**
   * 初始化安全模块
   */
  async init(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    // 检查是否已有密码设置
    const storedHash = localStorage.getItem(STORAGE_KEY_PASSWORD_HASH)
    if (!storedHash) {
      // 首次使用，标记为未设置
      this.locked = true
    }
  }

  /**
   * 设置新密码
   */
  async setupPassword(password: string): Promise<void> {
    const testEncrypted = await encrypt('nymir_verify', password)
    localStorage.setItem(STORAGE_KEY_PASSWORD_HASH, testEncrypted)
    
    this.setPassword(password)
    this.locked = false
    this.startLockTimer()
    this.notifyListeners(false)
  }

  /**
   * 解锁（输入密码）
   */
  async unlock(password: string): Promise<boolean> {
    if (this.failedAttempts >= 5) {
      const remaining = this.lockUntil - Date.now()
      if (remaining > 0) return false
      this.failedAttempts = 0
    }

    const storedHash = localStorage.getItem(STORAGE_KEY_PASSWORD_HASH)
    if (!storedHash) return false

    const valid = await verifyPassword(storedHash, password)
    if (!valid) {
      this.failedAttempts++
      if (this.failedAttempts >= 5) {
        this.lockUntil = Date.now() + 30_000
      }
      return false
    }

    this.failedAttempts = 0
    this.setPassword(password)
    this.locked = false
    this.startLockTimer()
    this.notifyListeners(false)

    if (needsMigration(storedHash)) {
      const reEncrypted = await encrypt('nymir_verify', password)
      localStorage.setItem(STORAGE_KEY_PASSWORD_HASH, reEncrypted)
    }

    return true
  }

  /**
   * 锁定
   */
  lock(): void {
    this.clearPassword()
    this.locked = true
    this.clearLockTimer()
    this.notifyListeners(true)
  }

  /**
   * 加密数据（锁定后仍可加密新数据）
   */
  async encrypt(data: string): Promise<string> {
    const pw = this._cachedPassword
    if (!pw) throw new Error('Security: no password set')
    return encrypt(data, pw)
  }

  /**
   * 解密数据（锁定后无法解密）
   */
  async decrypt(data: string): Promise<string> {
    const pw = this._cachedPassword
    if (!pw) throw new Error('Security: locked')
    return decrypt(data, pw)
  }

  /**
   * 重置所有数据（忘记密码）
   */
  async reset(): Promise<void> {
    await clearAllData()

    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith('nymir_') || k === STORAGE_KEY_PASSWORD_HASH,
    )
    for (const key of keys) {
      const randomValue = crypto.getRandomValues(new Uint8Array(32))
      const fakeValue = uint8ToBase64(randomValue)
      localStorage.setItem(key, fakeValue)
      localStorage.removeItem(key)
    }

    this.clearPassword()
    this.locked = true
    this.clearLockTimer()
    this.notifyListeners(true)
  }

  /**
   * 监听锁定状态变化
   */
  onLockChange(cb: LockListener): () => void {
    this.lockListeners.push(cb)
    return () => {
      this.lockListeners = this.lockListeners.filter((fn) => fn !== cb)
    }
  }

  private notifyListeners(locked: boolean): void {
    for (const cb of this.lockListeners) cb(locked)
  }

  private startLockTimer(): void {
    this.clearLockTimer()
    this.lockTimer = setTimeout(() => {
      this.lock()
    }, LOCK_TIMEOUT_MS)
  }

  private clearLockTimer(): void {
    if (this.lockTimer) {
      clearTimeout(this.lockTimer)
      this.lockTimer = null
    }
  }

  /**
   * 重置锁屏计时器（用户交互时调用）
   */
  resetLockTimer(): void {
    if (!this.locked) {
      this.startLockTimer()
    }
  }
}

export const securityManager = new SecurityManager()
