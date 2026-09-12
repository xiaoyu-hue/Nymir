/**
 * Nymir 消息签名模块
 * 
 * 使用 Ed25519 签名验证消息来源
 * 
 * 流程：
 * 1. 每个 peer 生成 Ed25519 密钥对
 * 2. 发送消息时用私钥签名
 * 3. 接收消息时用公钥验证签名
 */

const SIGN_ALGO = 'Ed25519'

import { uint8ToBase64, base64ToUint8 } from '../utils/base64'

export interface SignKeyPair {
  publicKey: CryptoKey
  privateKey: CryptoKey
}

/**
 * 生成签名密钥对
 * extractable: true — 允许导出，与 X25519 密钥对一起加密持久化
 */
export async function generateSignKeyPair(): Promise<SignKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: SIGN_ALGO },
    true,
    ['sign', 'verify'],
  )
  return keyPair as SignKeyPair
}

/** 持久化签名密钥对：导出公私钥 */
export interface PersistedSignKeyPair {
  privateKey: string // pkcs8
  publicKey: string // raw
}

export async function exportSignKeyPair(keyPair: SignKeyPair): Promise<PersistedSignKeyPair> {
  const privRaw = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
  const pubRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey)
  return {
    privateKey: uint8ToBase64(new Uint8Array(privRaw)),
    publicKey: uint8ToBase64(new Uint8Array(pubRaw)),
  }
}

export async function importSignKeyPair(persisted: PersistedSignKeyPair): Promise<SignKeyPair> {
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    base64ToUint8(persisted.privateKey),
    { name: SIGN_ALGO },
    true,
    ['sign', 'verify'],
  )
  const publicKey = await crypto.subtle.importKey(
    'raw',
    base64ToUint8(persisted.publicKey),
    { name: SIGN_ALGO },
    true,
    ['verify'],
  )
  return { publicKey, privateKey }
}

/**
 * 导出签名公钥为 base64
 */
export async function exportSignPublicKey(keyPair: SignKeyPair): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', keyPair.publicKey)
  return uint8ToBase64(new Uint8Array(raw))
}

/**
 * 导入对端签名公钥
 */
export async function importPeerSignPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const raw = base64ToUint8(publicKeyBase64)
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: SIGN_ALGO },
    false,
    ['verify'],
  )
}

/**
 * 签名消息
 */
export async function signMessage(
  message: string,
  privateKey: CryptoKey,
): Promise<string> {
  const encoder = new TextEncoder()
  const signature = await crypto.subtle.sign(
    { name: SIGN_ALGO },
    privateKey,
    encoder.encode(message),
  )
  return uint8ToBase64(new Uint8Array(signature))
}

/**
 * 验证消息签名
 */
export async function verifySignature(
  message: string,
  signature: string,
  publicKey: CryptoKey,
): Promise<boolean> {
  const encoder = new TextEncoder()
  const sigBytes = base64ToUint8(signature)
  return crypto.subtle.verify(
    { name: SIGN_ALGO },
    publicKey,
    sigBytes,
    encoder.encode(message),
  )
}
