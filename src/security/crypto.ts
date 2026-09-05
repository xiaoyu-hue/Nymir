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
 * - v1: 100K iterations (旧版)
 * - v2: 600K iterations (当前)
 * - 解密时自动检测版本，成功后用新版本重新加密
 */

const PBKDF2_ITERATIONS_V1 = 100_000
const PBKDF2_ITERATIONS_V2 = 600_000
const SALT_LENGTH = 16
const IV_LENGTH = 12
const VERSION_BYTE = 0x02 // v2 = 600K

import { uint8ToBase64, base64ToUint8 } from '../utils/base64'

function getIterations(data: Uint8Array): number {
  return data[0] === 0x01 ? PBKDF2_ITERATIONS_V1 : PBKDF2_ITERATIONS_V2
}

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

/**
 * 加密字符串
 * 返回格式: base64(version + salt + iv + ciphertext)
 */
export async function encrypt(plaintext: string, password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS_V2)

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext),
  )

  // 合并 version + salt + iv + ciphertext
  const combined = new Uint8Array(1 + salt.length + iv.length + ciphertext.byteLength)
  combined[0] = VERSION_BYTE
  combined.set(salt, 1)
  combined.set(iv, 1 + salt.length)
  combined.set(new Uint8Array(ciphertext), 1 + salt.length + iv.length)

  return uint8ToBase64(combined)
}

/**
 * 解密字符串
 * 输入格式: base64(version + salt + iv + ciphertext) 或 base64(salt + iv + ciphertext) (v1)
 */
export async function decrypt(ciphertext: string, password: string): Promise<string> {
  const decoder = new TextDecoder()
  const combined = base64ToUint8(ciphertext)

  // 检测版本：v1 无版本字节，v2 首字节为 0x02
  const isV2 = combined.length > 1 && combined[0] === VERSION_BYTE
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
 * 检查是否需要迁移到 v2（600K iterations）
 */
export function needsMigration(encryptedData: string): boolean {
  try {
    const combined = base64ToUint8(encryptedData)
    return !(combined.length > 1 && combined[0] === VERSION_BYTE)
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
