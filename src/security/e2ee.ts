/**
 * Nymir 端到端加密模块
 *
 * 使用 X25519 密钥交换 + AES-256-GCM + 每消息 HKDF 派生
 *
 * 流程：
 * 1. 每个 peer 生成临时 X25519 密钥对
 * 2. 连接时交换公钥
 * 3. ECDH 计算共享密钥
 * 4. 使用 HKDF 为每条消息派生独立密钥
 * 5. 用消息密钥加密消息
 *
 * 安全边界：本方案是会话级静态 ECDH + 每消息 HKDF，
 * 私钥泄露可影响本场已截获密文，不提供强前向保密（forward secrecy）。
 * 详见 e2eeManager.ts 文件头注释与 docs/THREAT_MODEL.md。
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
 * 生成 X25519 密钥对
 *
 * extractable: true — 允许导出原始私钥材料，用于加密持久化到 IndexedDB。
 * 权衡：之前 false 时私钥永远不离开 WebCrypto；改为 true 后，解锁状态下
 * XSS 可通过已加载的 CryptoKey 对象做 ECDH（与之前等价），但额外获得了
 * "导出加密后的私钥副本"能力。换来的是跨刷新持久身份（TOFU 长期有效）。
 */
export async function generateKeyPair(): Promise<KeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: KEY_TYPE },
    true, // 可导出，用于加密持久化
    ['deriveKey', 'deriveBits'],
  )
  return keyPair as KeyPair
}

/** 持久化身份：同时导出公私钥（base64） */
export interface PersistedKeyPair {
  privateKey: string // pkcs8
  publicKey: string // raw
}

/** 导出密钥对供加密持久化 */
export async function exportKeyPair(keyPair: KeyPair): Promise<PersistedKeyPair> {
  const privRaw = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
  const pubRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey)
  return {
    privateKey: uint8ToBase64(new Uint8Array(privRaw)),
    publicKey: uint8ToBase64(new Uint8Array(pubRaw)),
  }
}

/** 从持久化数据导入密钥对 */
export async function importKeyPair(persisted: PersistedKeyPair): Promise<KeyPair> {
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    base64ToUint8(persisted.privateKey),
    { name: KEY_TYPE },
    true,
    ['deriveKey', 'deriveBits'],
  )
  const publicKey = await crypto.subtle.importKey(
    'raw',
    base64ToUint8(persisted.publicKey),
    { name: KEY_TYPE },
    true,
    [],
  )
  return { publicKey, privateKey }
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
  // X25519 公钥仅作为 ECDH 对端参数，keyUsages 必须为空数组
  // （WebCrypto：公钥不能声明 deriveKey/deriveBits usage）
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: KEY_TYPE },
    false,
    [],
  )
}

/**
 * 从 X25519 ECDH 派生 HKDF 基密钥（非 AES 密钥）
 *
 * 必须先 deriveBits 再 import 为 HKDF，才能继续用每消息 HKDF 派生 AES 密钥。
 * 直接 deriveKey → AES-GCM 会导致 baseKey 无 deriveKey usage，无法做消息级前向保密。
 */
async function deriveSharedKey(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
): Promise<CryptoKey> {
  const bits = await crypto.subtle.deriveBits(
    { name: KEY_TYPE, public: peerPublicKey },
    privateKey,
    256,
  )
  return crypto.subtle.importKey(
    'raw',
    bits,
    'HKDF',
    false,
    ['deriveKey'],
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
  sharedKeys.set(peerId, key)
  touchSharedKey(peerId)
  // 先 set 再淘汰：否则上限实际为 MAX_SHARED_KEYS+1
  evictOldestSharedKey()
  return key
}

/**
 * 为特定消息派生独立密钥（每消息密钥派生）。
 * 注意：本方案是会话级静态 ECDH + 每消息 HKDF，
 * 私钥泄露可影响本场已截获密文，不提供强前向保密（forward secrecy）。
 * 详见 e2eeManager.ts 文件头注释与 docs/THREAT_MODEL.md。
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
 * 加密消息（会话级静态 ECDH + 每消息 HKDF，非强前向保密）
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
 * 解密消息（会话级静态 ECDH + 每消息 HKDF，非强前向保密）
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
