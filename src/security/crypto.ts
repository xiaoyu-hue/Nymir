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
 * - v1: 100K iterations，无版本字节（旧版）
 * - v2: 600K iterations，随机盐（当前）
 * - v3: 600K iterations，固定盐 + 会话级派生密钥缓存（当前）
 *   每条消息不再重复 600k 次 PBKDF2：同一密码只会派生一次，之后仅用随机 IV。
 *   代价：固定盐使不同安装的同一密码派生出同一密钥（防彩虹表的收益消失，
 *   密码强度与 600k 迭代的保护不变）。旧 v1/v2 数据解密走 legacy 路径。
 */

const PBKDF2_ITERATIONS_V1 = 100_000
const PBKDF2_ITERATIONS_V2 = 600_000
const SALT_LENGTH = 16
const IV_LENGTH = 12
const VERSION_BYTE_V2 = 0x02 // v2 = 600K，随机盐
const VERSION_BYTE_V3 = 0x03 // v3 = 600K，固定盐 + 会话缓存

/** v3 固定盐：公开常量，配合随机 IV 保证 GCM 安全 */
const SESSION_SALT = new Uint8Array(SALT_LENGTH)

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

// 会话级派生密钥缓存：同密码只派生一次（v3）
// 不存储原始密码字符串：仅存 SHA-256 哈希用于比对，减少明文密码在 JS 堆的驻留。
// 密钥派生仍使用原始密码，派生完成后原始密码由调用方负责清理。
let cachedKey: { passwordHash: string; key: CryptoKey } | null = null

/** 获取（或派生并缓存）v3 会话密钥 */
async function getOrDeriveSessionKey(password: string): Promise<CryptoKey> {
  const passwordHash = await hashPassword(password)
  if (cachedKey && cachedKey.passwordHash === passwordHash) return cachedKey.key
  const key = await deriveKey(password, SESSION_SALT, PBKDF2_ITERATIONS_V2)
  cachedKey = { passwordHash, key }
  return key
}

/**
 * 清除会话级派生密钥缓存（锁定/重置时调用，避免派生密钥常驻内存）
 */
export function clearCryptoCache(): void {
  cachedKey = null
}

/**
 * 加密字符串
 * 返回格式: base64(version + iv + ciphertext)   (v3，盐固定)
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

  // 合并 version + iv + ciphertext
  const combined = new Uint8Array(1 + iv.length + ciphertext.byteLength)
  combined[0] = VERSION_BYTE_V3
  combined.set(iv, 1)
  combined.set(new Uint8Array(ciphertext), 1 + iv.length)

  return uint8ToBase64(combined)
}

/**
 * 解密字符串
 * 输入格式:
 * - v3: base64(0x03 + iv + ciphertext)
 * - v2: base64(0x02 + salt + iv + ciphertext)
 * - v1: base64(salt + iv + ciphertext)
 */
export async function decrypt(ciphertext: string, password: string): Promise<string> {
  const decoder = new TextDecoder()
  const combined = base64ToUint8(ciphertext)

  // v3：固定盐 + 会话密钥（缓存命中则跳过 600k 派生）
  if (combined.length > 0 && combined[0] === VERSION_BYTE_V3) {
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
 * 检查是否需要迁移到 v3（固定盐 + 会话缓存）
 * v1/v2 均为旧格式，返回 true
 */
export function needsMigration(encryptedData: string): boolean {
  try {
    const combined = base64ToUint8(encryptedData)
    // 与 decrypt() 中的 v3 检测保持一致：长度 > 0 即可读取版本字节
    return !(combined.length > 0 && combined[0] === VERSION_BYTE_V3)
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
