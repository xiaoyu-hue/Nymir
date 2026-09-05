/**
 * Nymir 安全管理器
 * 
 * 职责：
 * - 管理用户密码（内存中，不持久化）
 * - 控制锁定/解锁状态
 * - 协调加密/解密操作
 * - 自动锁屏计时
 */

import { encrypt, decrypt, verifyPassword, needsMigration } from './crypto'
import { uint8ToBase64 } from '../utils/base64'
import { clearAllData } from '../persistence/db'
import { LOCK_TIMEOUT_MS } from '../../constants'

const STORAGE_KEY_PASSWORD_HASH = 'nymir_pwd_hash'

export type LockListener = (locked: boolean) => void

class SecurityManager {
  private password: string | null = null
  private locked = true
  private lockTimer: ReturnType<typeof setTimeout> | null = null
  private lockListeners: LockListener[] = []
  private initialized = false
  private failedAttempts = 0
  private lockUntil = 0

  get isLocked(): boolean {
    return this.locked
  }

  get isSetup(): boolean {
    return localStorage.getItem(STORAGE_KEY_PASSWORD_HASH) !== null
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
    // 生成测试数据来验证密码
    const testEncrypted = await encrypt('nymir_verify', password)
    localStorage.setItem(STORAGE_KEY_PASSWORD_HASH, testEncrypted)
    
    this.password = password
    this.locked = false
    this.startLockTimer()
    this.notifyListeners(false)
  }

  /**
   * 解锁（输入密码）
   */
  async unlock(password: string): Promise<boolean> {
    // 速率限制：5次失败后锁定30秒
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
    this.password = password
    this.locked = false
    this.startLockTimer()
    this.notifyListeners(false)

    // 自动迁移：v1(100K) → v2(600K)
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
    this.password = null
    this.locked = true
    this.clearLockTimer()
    this.notifyListeners(true)
  }

  /**
   * 加密数据
   */
  async encrypt(data: string): Promise<string> {
    if (!this.password) throw new Error('Security: locked')
    return encrypt(data, this.password)
  }

  /**
   * 解密数据
   */
  async decrypt(data: string): Promise<string> {
    if (!this.password) throw new Error('Security: locked')
    return decrypt(data, this.password)
  }

  /**
   * 重置所有数据（忘记密码）
   */
  async reset(): Promise<void> {
    // 清除 IndexedDB 中的所有数据
    await clearAllData()

    // 安全清除 localStorage
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith('nymir_') || k === STORAGE_KEY_PASSWORD_HASH,
    )
    for (const key of keys) {
      // 用随机数据覆写
      const randomValue = crypto.getRandomValues(new Uint8Array(32))
      const fakeValue = uint8ToBase64(randomValue)
      localStorage.setItem(key, fakeValue)
      localStorage.removeItem(key)
    }

    this.password = null
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
