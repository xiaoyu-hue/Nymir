/**
 * Nymir 加密模块
 *
 * 使用 Web Crypto API 实现：
 * - PBKDF2 密钥派生 (600k rounds, SHA-256, NIST推荐)
 * - AES-256-GCM 加密/解密
 *
 * 安全策略：
 * - 忘记密码 = 永久丢失数据
 * - 不存储密码或密钥
 * - 每次加密使用随机 IV
 *
 * 版本迁移：
 * - v1: 100K iterations，无版本字节（最旧）
 * - v2: 600K iterations，随机内嵌盐
 * - v3: 600K iterations，全零固定盐 + 会话级派生密钥缓存
 *   代价：不同安装的同一密码派生出同一密钥，失去 per-install 盐防护
 * - v4: 600K iterations，per-install 随机盐（存 localStorage）+ 会话缓存
 *   第一次设密码时生成随机盐，所有安装的盐各不相同，
 *   恢复 per-install 盐对彩虹表/批量破解的防护。
 *   旧 v1/v2/v3 数据解锁后自动迁移到 v4。
 */

const PBKDF2_ITERATIONS_V1 = 100_000
const PBKDF2_ITERATIONS_V2 = 600_000
const SALT_LENGTH = 16
const IV_LENGTH = 12
const VERSION_BYTE_V2 = 0x02 // v2 = 600K，随机内嵌盐
const VERSION_BYTE_V3 = 0x03 // v3 = 600K，全零固定盐 + 会话缓存
const VERSION_BYTE_V4 = 0x04 // v4 = 600K，per-install 随机盐 + 会话缓存

/** v3 legacy 固定盐（全零）：仅用于解密旧 v3 数据 */
const V3_LEGACY_SALT = new Uint8Array(SALT_LENGTH)

/** v4 per-install 盐的 localStorage key */
const SALT_STORAGE_KEY = 'nymir_install_salt'

import { uint8ToBase64, base64ToUint8 } from '../utils/base64'

/**
 * 从密码派生 AES-256 密钥
 */
async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** 计算密码的 SHA-256 哈希（仅用于缓存比对，不用于密钥派生） */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(password))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 获取（或首次生成）per-install 随机盐。
 * 盐不是秘密——它只用于让不同安装的相同密码派生出不同密钥，
 * 防止彩虹表/批量破解。存 localStorage 即可。
 */
function getInstallSalt(): Uint8Array {
  try {
    const stored = localStorage.getItem(SALT_STORAGE_KEY)
    if (stored) {
      const parsed = base64ToUint8(stored)
      if (parsed.length === SALT_LENGTH) return parsed
    }
  } catch {
    // localStorage 不可用或数据损坏，fall through 到新生成
  }
  const newSalt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  try {
    localStorage.setItem(SALT_STORAGE_KEY, uint8ToBase64(newSalt))
  } catch {
    // localStorage 写不进去（隐私模式/配额满）：本次会话用内存盐即可
  }
  return newSalt
}

// 会话级派生密钥缓存：同密码只派生一次（v4）
// 不存储原始密码字符串：仅存 SHA-256 哈希用于比对，减少明文密码在 JS 堆的驻留。
let cachedKey: { passwordHash: string; key: CryptoKey } | null = null

/** 获取（或派生并缓存）v4 会话密钥（per-install 盐） */
async function getOrDeriveSessionKey(password: string): Promise<CryptoKey> {
  const passwordHash = await hashPassword(password)
  if (cachedKey && cachedKey.passwordHash === passwordHash) return cachedKey.key
  const salt = getInstallSalt()
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS_V2)
  cachedKey = { passwordHash, key }
  return key
}

/**
 * 清除会话级派生密钥缓存（锁定/重置/迁移时调用）
 */
export function clearCryptoCache(): void {
  cachedKey = null
}

/**
 * 加密字符串
 * 返回格式: base64(0x04 + iv + ciphertext)   (v4，per-install 盐)
 */
export async function encrypt(plaintext: string, password: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await getOrDeriveSessionKey(password)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext),
  )

  const combined = new Uint8Array(1 + iv.length + ciphertext.byteLength)
  combined[0] = VERSION_BYTE_V4
  combined.set(iv, 1)
  combined.set(new Uint8Array(ciphertext), 1 + iv.length)

  return uint8ToBase64(combined)
}

/**
 * 解密字符串
 * 输入格式:
 * - v4: base64(0x04 + iv + ciphertext)（per-install 盐，从 localStorage 读）
 * - v3: base64(0x03 + iv + ciphertext)（全零固定盐，legacy）
 * - v2: base64(0x02 + salt + iv + ciphertext)
 * - v1: base64(salt + iv + ciphertext)
 */
export async function decrypt(ciphertext: string, password: string): Promise<string> {
  const decoder = new TextDecoder()
  const combined = base64ToUint8(ciphertext)

  // v4：per-install 盐 + 会话密钥缓存
  if (combined.length > 0 && combined[0] === VERSION_BYTE_V4) {
    const key = await getOrDeriveSessionKey(password)
    const iv = combined.slice(1, 1 + IV_LENGTH)
    const data = combined.slice(1 + IV_LENGTH)
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data,
    )
    return decoder.decode(plaintext)
  }

  // v3 legacy：全零固定盐，不走 v4 缓存（盐不同）
  if (combined.length > 0 && combined[0] === VERSION_BYTE_V3) {
    const key = await deriveKey(password, V3_LEGACY_SALT, PBKDF2_ITERATIONS_V2)
    const iv = combined.slice(1, 1 + IV_LENGTH)
    const data = combined.slice(1 + IV_LENGTH)
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data,
    )
    return decoder.decode(plaintext)
  }

  // v1/v2 legacy：检测版本，用内嵌盐派生
  const isV2 = combined.length > 1 && combined[0] === VERSION_BYTE_V2
  const offset = isV2 ? 1 : 0
  const iterations = isV2 ? PBKDF2_ITERATIONS_V2 : PBKDF2_ITERATIONS_V1

  const salt = combined.slice(offset, offset + SALT_LENGTH)
  const iv = combined.slice(offset + SALT_LENGTH, offset + SALT_LENGTH + IV_LENGTH)
  const data = combined.slice(offset + SALT_LENGTH + IV_LENGTH)

  const key = await deriveKey(password, salt, iterations)

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  )

  return decoder.decode(plaintext)
}

/**
 * 检查是否需要迁移到 v4（per-install 盐）
 * v1/v2/v3 均为旧格式，返回 true
 */
export function needsMigration(encryptedData: string): boolean {
  try {
    const combined = base64ToUint8(encryptedData)
    return !(combined.length > 0 && combined[0] === VERSION_BYTE_V4)
  } catch {
    return false
  }
}

/**
 * 验证密码是否正确（用于解密测试）
 */
export async function verifyPassword(encryptedData: string, password: string): Promise<boolean> {
  try {
    await decrypt(encryptedData, password)
    return true
  } catch {
    return false
  }
}

// ─── 备份专用：内嵌盐加解密（跨设备可恢复） ──────────────────────────
//
// 日常加密（encrypt/decrypt）用 per-install 盐，盐存在 localStorage。
// 备份文件必须自带盐——否则换设备后盐不同，解不开。
// 这两个函数用调用方传入的盐，不读 localStorage。

const VERSION_BYTE_V5 = 0x05 // 备份专用：自带盐，与 v4 同迭代数

/**
 * 用指定盐加密（备份专用）。返回 base64(0x05 + iv + ciphertext)。
 * 盐由调用方生成并随密文一起存储。
 */
export async function encryptWithSalt(
  plaintext: string,
  password: string,
  salt: Uint8Array,
): Promise<string> {
  const encoder = new TextEncoder()
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS_V2)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext),
  )
  const combined = new Uint8Array(1 + iv.length + ciphertext.byteLength)
  combined[0] = VERSION_BYTE_V5
  combined.set(iv, 1)
  combined.set(new Uint8Array(ciphertext), 1 + iv.length)
  return uint8ToBase64(combined)
}

/**
 * 用指定盐解密（备份专用）。输入须为 encryptWithSalt 的输出。
 */
export async function decryptWithSalt(
  ciphertext: string,
  password: string,
  salt: Uint8Array,
): Promise<string> {
  const decoder = new TextDecoder()
  const combined = base64ToUint8(ciphertext)
  if (combined.length === 0 || combined[0] !== VERSION_BYTE_V5) {
    throw new Error('Not a salt-embedded ciphertext (v5)')
  }
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS_V2)
  const iv = combined.slice(1, 1 + IV_LENGTH)
  const data = combined.slice(1 + IV_LENGTH)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  )
  return decoder.decode(plaintext)
}
