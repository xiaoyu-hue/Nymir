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

export interface SignKeyPair {
  publicKey: CryptoKey
  privateKey: CryptoKey
}

/**
 * 生成签名密钥对
 */
export async function generateSignKeyPair(): Promise<SignKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: SIGN_ALGO },
    true,
    ['sign', 'verify'],
  )
  return keyPair as SignKeyPair
}

/**
 * 导出签名公钥为 base64
 */
export async function exportSignPublicKey(keyPair: SignKeyPair): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', keyPair.publicKey)
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
}

/**
 * 导入对端签名公钥
 */
export async function importPeerSignPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(publicKeyBase64), (c) => c.charCodeAt(0))
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
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
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
  const sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0))
  return crypto.subtle.verify(
    { name: SIGN_ALGO },
    publicKey,
    sigBytes,
    encoder.encode(message),
  )
}
