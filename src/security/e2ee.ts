/**
 * Nymir 端到端加密模块
 *
 * 使用 X25519 密钥交换 + AES-256-GCM + 每消息 HKDF 派生
 *
 * 流程：
 * 1. 每个 peer 持有长期静态 X25519 身份密钥对（用于身份认证 / 安全码 / TOFU）
 * 2. 每次会话额外生成一次性临时 X25519 密钥对，连接时与静态公钥一并交换
 * 3. 会话根密钥 = HKDF(静态-静态 ECDH ‖ 临时-临时 ECDH)，再由每消息 HKDF 派生独立消息密钥
 * 4. 临时私钥在会话结束时从内存丢弃 → 弱前向保密（详见 ADR-0008）
 *
 * 安全边界：
 * - 长期静态私钥泄露时，因会话根还依赖已销毁的临时私钥，已截获历史密文不可解密（弱前向保密）。
 * - 仍非「强前向保密」：无持续棘轮轮换，握手前首个往返可能退化为纯静态根；详见 THREAT_MODEL.md §4.2。
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

/**
 * 临时密钥参数（弱前向保密）。
 * 同时具备「自己的临时私钥」与「对端的临时公钥」时，会话根密钥会叠加
 * 临时-临时 ECDH 贡献；任一方缺失则退化为纯静态根（向后兼容 / 握手前场景）。
 */
export interface EphemeralParams {
  myEphemeralPrivateKey?: CryptoKey | null
  peerEphemeralPublicKey?: CryptoKey | null
}

// 缓存每个 peer 的共享密钥（带 LRU 淘汰 + 上限保护）
// 安全边界：共享密钥仅在会话活跃期间保留；peer 离开 / 策略切换 / 密钥轮换时主动清除。
// 不做时间过期：ECDH 共享密钥本身无时间属性，LRU + 主动清除已足够控制内存占用。
const MAX_SHARED_KEYS = 100
const sharedKeys = new Map<string, CryptoKey>()
const sharedKeysOrder: string[] = [] // LRU 顺序：最近访问的在末尾

// 组合会话根缓存（叠加临时-临时 ECDH 贡献，提供弱前向保密）。
// 与共享密钥缓存独立：解密失败安全回退到纯静态根时不会与组合根相互覆盖。
const sessionKeys = new Map<string, CryptoKey>()
const sessionKeysOrder: string[] = []

/** 主动淘汰最旧的共享密钥，保留最近访问的。调用方在 peer 离开/轮换后使用。 */
export function evictSharedKeysIfNeeded(): void {
  while (sharedKeysOrder.length > MAX_SHARED_KEYS) {
    const oldest = sharedKeysOrder.shift()!
    sharedKeys.delete(oldest)
  }
  while (sessionKeysOrder.length > MAX_SHARED_KEYS) {
    const oldest = sessionKeysOrder.shift()!
    sessionKeys.delete(oldest)
  }
}

function touchSharedKey(peerId: string): void {
  const idx = sharedKeysOrder.indexOf(peerId)
  if (idx !== -1) sharedKeysOrder.splice(idx, 1)
  sharedKeysOrder.push(peerId)
}

function touchSessionKey(peerId: string): void {
  const idx = sessionKeysOrder.indexOf(peerId)
  if (idx !== -1) sessionKeysOrder.splice(idx, 1)
  sessionKeysOrder.push(peerId)
}

function evictOldestSharedKey(): void {
  evictSharedKeysIfNeeded()
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
  // WebCrypto 返回 CryptoKeyPair，与 KeyPair 结构相同，安全转换
  return keyPair as unknown as KeyPair
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
 * 计算单个 X25519 ECDH 的原始共享比特（256 位，ArrayBuffer）。
 */
async function ecdhBits(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits(
    { name: KEY_TYPE, public: peerPublicKey },
    privateKey,
    256,
  )
}

/**
 * 派生「组合会话基密钥」（叠加临时-临时 ECDH 提供弱前向保密）。
 *
 * 设计（详见 docs/adr/0008-ephemeral-forward-secrecy.md）：
 * - ikm = 静态-静态 ECDH 比特（保留对端身份认证：安全码 / TOFU 语义不变）
 * - salt = 临时-临时 ECDH 比特（仅当双方临时密钥齐备时加入）
 * - 临时私钥在会话结束时从内存丢弃，故长期静态私钥泄露也无法重建会话根，
 *   已截获的历史密文不可解密 —— 即弱前向保密。
 * 任一方临时密钥缺失（握手前 / 跨版本）时 salt 为空，退化为纯静态根，向后兼容。
 */
async function deriveSessionBaseKey(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
  myEphemeralPrivateKey?: CryptoKey | null,
  peerEphemeralPublicKey?: CryptoKey | null,
): Promise<CryptoKey> {
  const staticBits = await ecdhBits(privateKey, peerPublicKey)
  const salt =
    myEphemeralPrivateKey && peerEphemeralPublicKey
      ? await ecdhBits(myEphemeralPrivateKey, peerEphemeralPublicKey)
      : new ArrayBuffer(0)
  const ikmKey = await crypto.subtle.importKey(
    'raw',
    staticBits,
    'HKDF',
    false,
    ['deriveKey', 'deriveBits'],
  )
  const sessionBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      salt,
      hash: HKDF_HASH,
      info: new TextEncoder().encode('nymir-session-base-v1'),
    },
    ikmKey,
    256,
  )
  return crypto.subtle.importKey(
    'raw',
    sessionBits,
    'HKDF',
    false,
    ['deriveKey'],
  )
}

/**
 * 获取或生成与 peer 的纯静态共享密钥（无前向保密，向后兼容路径）
 */
async function getStaticSharedKey(
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
 * 获取或生成与 peer 的组合会话根密钥（叠加临时-临时 ECDH，提供弱前向保密）。
 * 仅当双方临时密钥齐备时与纯静态根不同；否则等价于静态根（salt 为空）。
 */
async function getSessionSharedKey(
  peerId: string,
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
  myEphemeralPrivateKey?: CryptoKey | null,
  peerEphemeralPublicKey?: CryptoKey | null,
): Promise<CryptoKey> {
  let key = sessionKeys.get(peerId)
  if (key) {
    touchSessionKey(peerId)
    return key
  }
  key = await deriveSessionBaseKey(
    privateKey,
    peerPublicKey,
    myEphemeralPrivateKey,
    peerEphemeralPublicKey,
  )
  sessionKeys.set(peerId, key)
  touchSessionKey(peerId)
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
 * 加密消息。
 * 当提供完整临时密钥参数时，会话根叠加临时-临时 ECDH（弱前向保密）；
 * 否则退化为纯静态 ECDH（向后兼容 / 握手前 / 跨版本）。
 */
export async function encryptMessage(
  plaintext: string,
  peerId: string,
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
  messageId: string,
  ephemeral?: EphemeralParams,
): Promise<EncryptedPayload> {
  const useSession =
    !!ephemeral?.myEphemeralPrivateKey && !!ephemeral?.peerEphemeralPublicKey
  const sharedKey = useSession
    ? await getSessionSharedKey(
        peerId,
        privateKey,
        peerPublicKey,
        ephemeral!.myEphemeralPrivateKey,
        ephemeral!.peerEphemeralPublicKey,
      )
    : await getStaticSharedKey(peerId, privateKey, peerPublicKey)
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
 * 解密消息。
 * 与 encryptMessage 同样的密钥选择逻辑：双方临时密钥齐备时用组合根，否则静态根。
 * 注意：调用方（e2eeManager）在「组合根解密失败」时应回退到纯静态根重试，
 * 以覆盖握手前 / 临时密钥尚未交换的过渡窗口（失败安全）。
 */
export async function decryptMessage(
  payload: EncryptedPayload,
  peerId: string,
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
  messageId: string,
  ephemeral?: EphemeralParams,
): Promise<string> {
  const useSession =
    !!ephemeral?.myEphemeralPrivateKey && !!ephemeral?.peerEphemeralPublicKey
  const sharedKey = useSession
    ? await getSessionSharedKey(
        peerId,
        privateKey,
        peerPublicKey,
        ephemeral!.myEphemeralPrivateKey,
        ephemeral!.peerEphemeralPublicKey,
      )
    : await getStaticSharedKey(peerId, privateKey, peerPublicKey)
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
 * 清除与某个 peer 的共享密钥（含组合会话根）
 */
export function clearSharedKey(peerId: string): void {
  sharedKeys.delete(peerId)
  const idx = sharedKeysOrder.indexOf(peerId)
  if (idx !== -1) sharedKeysOrder.splice(idx, 1)
  sessionKeys.delete(peerId)
  const sIdx = sessionKeysOrder.indexOf(peerId)
  if (sIdx !== -1) sessionKeysOrder.splice(sIdx, 1)
}

/**
 * 清除所有共享密钥（含组合会话根）
 */
export function clearAllSharedKeys(): void {
  sharedKeys.clear()
  sharedKeysOrder.length = 0
  sessionKeys.clear()
  sessionKeysOrder.length = 0
}
