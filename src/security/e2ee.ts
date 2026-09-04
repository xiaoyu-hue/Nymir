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

export interface KeyPair {
  publicKey: CryptoKey
  privateKey: CryptoKey
}

export interface EncryptedPayload {
  iv: string // base64
  data: string // base64
}

// 缓存每个 peer 的共享密钥
const sharedKeys = new Map<string, CryptoKey>()

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
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
}

/**
 * 导入对端公钥
 */
export async function importPeerPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(publicKeyBase64), (c) => c.charCodeAt(0))
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
  const cacheKey = `${peerId}`
  let key = sharedKeys.get(cacheKey)
  if (!key) {
    key = await deriveSharedKey(privateKey, peerPublicKey)
    sharedKeys.set(cacheKey, key)
  }
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
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
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
  const iv = Uint8Array.from(atob(payload.iv), (c) => c.charCodeAt(0))
  const data = Uint8Array.from(atob(payload.data), (c) => c.charCodeAt(0))
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
}

/**
 * 清除所有共享密钥
 */
export function clearAllSharedKeys(): void {
  sharedKeys.clear()
}
