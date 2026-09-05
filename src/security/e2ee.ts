/**
 * Nymir 端到端加密模块
 * 
 * 使用 X25519 密钥交换 + AES-256-GCM + HKDF 前向保密
 * 
 * 流程：
 * 1. 每个 peer 生成临时 X25519 密钥对
 * 2. 连接时交换公钥
 * 3. ECDH 计算共享密钥
 * 4. 使用 HKDF 为每条消息派生独立密钥
 * 5. 用消息密钥加密消息
 */

const KEY_TYPE = 'X25519'
const AES_ALGO = 'AES-GCM'
const AES_KEY_LENGTH = 256
const IV_LENGTH = 12
const HKDF_HASH = 'SHA-256'

import { uint8ToBase64, base64ToUint8 } from '../utils/base64'

export interface KeyPair {
  publicKey: CryptoKey
  privateKey: CryptoKey
}

export interface EncryptedPayload {
  iv: string // base64
  data: string // base64
}

// 缓存每个 peer 的共享密钥（带 LRU 淘汰）
const MAX_SHARED_KEYS = 100
const sharedKeys = new Map<string, CryptoKey>()
const sharedKeysOrder: string[] = [] // LRU 顺序：最近访问的在末尾

function touchSharedKey(peerId: string): void {
  const idx = sharedKeysOrder.indexOf(peerId)
  if (idx !== -1) sharedKeysOrder.splice(idx, 1)
  sharedKeysOrder.push(peerId)
}

function evictOldestSharedKey(): void {
  if (sharedKeysOrder.length <= MAX_SHARED_KEYS) return
  const oldest = sharedKeysOrder.shift()!
  sharedKeys.delete(oldest)
}

/**
 * 生成临时密钥对
 */
export async function generateKeyPair(): Promise<KeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: KEY_TYPE },
    true, // extractable for export
    ['deriveKey', 'deriveBits'],
  )
  return keyPair as KeyPair
}

/**
 * 导出公钥为 base64
 */
export async function exportPublicKey(keyPair: KeyPair): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', keyPair.publicKey)
  return uint8ToBase64(new Uint8Array(raw))
}

/**
 * 导入对端公钥
 */
export async function importPeerPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const raw = base64ToUint8(publicKeyBase64)
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: KEY_TYPE },
    false,
    ['deriveKey'],
  )
}

/**
 * 从共享密钥派生 AES 密钥
 */
async function deriveSharedKey(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: KEY_TYPE, public: peerPublicKey },
    privateKey,
    { name: AES_ALGO, length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * 获取或生成与 peer 的共享密钥
 */
async function getSharedKey(
  peerId: string,
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
): Promise<CryptoKey> {
  let key = sharedKeys.get(peerId)
  if (key) {
    touchSharedKey(peerId)
    return key
  }
  key = await deriveSharedKey(privateKey, peerPublicKey)
  evictOldestSharedKey()
  sharedKeys.set(peerId, key)
  touchSharedKey(peerId)
  return key
}

/**
 * 为特定消息派生密钥（前向保密）
 */
async function deriveMessageKey(
  sharedKey: CryptoKey,
  messageId: string,
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const salt = encoder.encode(messageId)

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      salt,
      hash: HKDF_HASH,
      info: encoder.encode('nymir-message-key'),
    },
    sharedKey,
    { name: AES_ALGO, length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * 加密消息（带前向保密）
 */
export async function encryptMessage(
  plaintext: string,
  peerId: string,
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
  messageId: string,
): Promise<EncryptedPayload> {
  const sharedKey = await getSharedKey(peerId, privateKey, peerPublicKey)
  const messageKey = await deriveMessageKey(sharedKey, messageId)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoder = new TextEncoder()

  const ciphertext = await crypto.subtle.encrypt(
    { name: AES_ALGO, iv },
    messageKey,
    encoder.encode(plaintext),
  )

  return {
    iv: uint8ToBase64(iv),
    data: uint8ToBase64(new Uint8Array(ciphertext)),
  }
}

/**
 * 解密消息（带前向保密）
 */
export async function decryptMessage(
  payload: EncryptedPayload,
  peerId: string,
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
  messageId: string,
): Promise<string> {
  const sharedKey = await getSharedKey(peerId, privateKey, peerPublicKey)
  const messageKey = await deriveMessageKey(sharedKey, messageId)
  const iv = base64ToUint8(payload.iv)
  const data = base64ToUint8(payload.data)
  const decoder = new TextDecoder()

  const plaintext = await crypto.subtle.decrypt(
    { name: AES_ALGO, iv },
    messageKey,
    data,
  )

  return decoder.decode(plaintext)
}

/**
 * 清除与某个 peer 的共享密钥
 */
export function clearSharedKey(peerId: string): void {
  sharedKeys.delete(peerId)
  const idx = sharedKeysOrder.indexOf(peerId)
  if (idx !== -1) sharedKeysOrder.splice(idx, 1)
}

/**
 * 清除所有共享密钥
 */
export function clearAllSharedKeys(): void {
  sharedKeys.clear()
  sharedKeysOrder.length = 0
}

/**
 * 为文件加密派生包装密钥（使用共享密钥 + HKDF）
 */
async function deriveFileWrapKey(sharedKey: CryptoKey): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      salt: encoder.encode('nymir-file-wrap'),
      hash: HKDF_HASH,
      info: encoder.encode('nymir-file-key'),
    },
    sharedKey,
    { name: AES_ALGO, length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * 加密文件（使用 AES-256-GCM + E2EE 共享密钥保护文件密钥）
 *
 * 输出格式: [encryptedKeyLen:4][encryptedKey][iv:12][ciphertext]
 * AES 密钥由 E2EE 共享密钥加密，只有持有对应私钥的 peer 可以解密
 */
export async function encryptFile(
  data: ArrayBuffer,
  peerId: string,
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
): Promise<ArrayBuffer | null> {
  try {
    // 1. 生成随机 AES 文件密钥
    const fileKey = await crypto.subtle.generateKey(
      { name: AES_ALGO, length: AES_KEY_LENGTH },
      true,
      ['encrypt', 'decrypt'],
    )
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

    // 2. 用 AES 密钥加密文件内容
    const ciphertext = await crypto.subtle.encrypt(
      { name: AES_ALGO, iv },
      fileKey,
      data,
    )

    // 3. 用 E2EE 共享密钥加密 AES 文件密钥
    const sharedKey = await getSharedKey(peerId, privateKey, peerPublicKey)
    const wrapKey = await deriveFileWrapKey(sharedKey)
    const rawFileKey = await crypto.subtle.exportKey('raw', fileKey)
    const encryptedKeyIv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const encryptedKey = await crypto.subtle.encrypt(
      { name: AES_ALGO, iv: encryptedKeyIv },
      wrapKey,
      rawFileKey,
    )

    // 4. 组合: [encryptedKeyLen:4][encryptedKeyIv:12][encryptedKey][fileIv:12][ciphertext]
    const encKeyLen = encryptedKey.byteLength
    const combined = new Uint8Array(
      4 + IV_LENGTH + encKeyLen + IV_LENGTH + ciphertext.byteLength,
    )
    const view = new DataView(combined.buffer)
    view.setUint32(0, encKeyLen, false) // big-endian
    combined.set(encryptedKeyIv, 4)
    combined.set(new Uint8Array(encryptedKey), 4 + IV_LENGTH)
    combined.set(iv, 4 + IV_LENGTH + encKeyLen)
    combined.set(new Uint8Array(ciphertext), 4 + IV_LENGTH + encKeyLen + IV_LENGTH)

    return combined.buffer
  } catch {
    return null
  }
}

/**
 * 解密文件（使用 E2EE 共享密钥解密文件密钥）
 */
export async function decryptFile(
  data: ArrayBuffer,
  peerId: string,
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
): Promise<ArrayBuffer | null> {
  try {
    const combined = new Uint8Array(data)
    const view = new DataView(combined.buffer)

    // 1. 读取加密密钥长度和加密密钥
    const encKeyLen = view.getUint32(0, false)
    const encryptedKeyIv = combined.slice(4, 4 + IV_LENGTH)
    const encryptedKey = combined.slice(4 + IV_LENGTH, 4 + IV_LENGTH + encKeyLen)
    const fileIv = combined.slice(4 + IV_LENGTH + encKeyLen, 4 + IV_LENGTH + encKeyLen + IV_LENGTH)
    const ciphertext = combined.slice(4 + IV_LENGTH + encKeyLen + IV_LENGTH)

    // 2. 用 E2EE 共享密钥解密 AES 文件密钥
    const sharedKey = await getSharedKey(peerId, privateKey, peerPublicKey)
    const wrapKey = await deriveFileWrapKey(sharedKey)
    const rawFileKey = await crypto.subtle.decrypt(
      { name: AES_ALGO, iv: encryptedKeyIv },
      wrapKey,
      encryptedKey,
    )

    // 3. 导入 AES 文件密钥并解密内容
    const fileKey = await crypto.subtle.importKey(
      'raw',
      rawFileKey,
      { name: AES_ALGO, length: AES_KEY_LENGTH },
      false,
      ['decrypt'],
    )

    return crypto.subtle.decrypt(
      { name: AES_ALGO, iv: fileIv },
      fileKey,
      ciphertext,
    )
  } catch {
    return null
  }
}
