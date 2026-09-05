/**
 * Nymir 加密模块
 * 
 * 使用 Web Crypto API 实现：
 * - PBKDF2 密钥派生 (100k rounds, SHA-256)
 * - AES-256-GCM 加密/解密
 * 
 * 安全策略：
 * - 忘记密码 = 永久丢失数据
 * - 不存储密码或密钥
 * - 每次加密使用随机 IV
 * 
 * 注意：PBKDF2 迭代次数为 100K。NIST 推荐 600K+，但提升迭代次数
 * 会导致已有数据无法解密（密钥派生结果不同），需要数据迁移逻辑。
 * 当前版本保持 100K 以兼容已有数据。
 */

const PBKDF2_ITERATIONS = 100_000
const SALT_LENGTH = 16
const IV_LENGTH = 12

import { uint8ToBase64, base64ToUint8 } from '../utils/base64'

/**
 * 从密码派生 AES-256 密钥
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
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
      iterations: PBKDF2_ITERATIONS,
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
 * 返回格式: base64(salt + iv + ciphertext)
 */
export async function encrypt(plaintext: string, password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await deriveKey(password, salt)

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext),
  )

  // 合并 salt + iv + ciphertext
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length)

  return uint8ToBase64(combined)
}

/**
 * 解密字符串
 * 输入格式: base64(salt + iv + ciphertext)
 */
export async function decrypt(ciphertext: string, password: string): Promise<string> {
  const decoder = new TextDecoder()
  const combined = base64ToUint8(ciphertext)

  const salt = combined.slice(0, SALT_LENGTH)
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const data = combined.slice(SALT_LENGTH + IV_LENGTH)

  const key = await deriveKey(password, salt)

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  )

  return decoder.decode(plaintext)
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

/**
 * 生成随机盐值（用于新密码设置）
 */
export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  return uint8ToBase64(salt)
}
