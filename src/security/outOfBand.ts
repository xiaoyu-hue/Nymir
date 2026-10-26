/**
 * 带外（Out-of-Band）身份交换模块
 *
 * 用途：
 *   把"自己的两个长期身份公钥"打包成一个可复制 / 可扫码的字符串，
 *   让用户通过**信令通道之外的独立渠道**（面对面、另一款加密 App、短信）
 *   发给对方；对方粘贴 / 扫描后，双方各自本地算出共同安全码并比对。
 *
 * 为什么需要它（解决什么问题）：
 *   原 TOFU 安全码核对依赖"已经连上信令、交换了公钥"这一前提——
 *   如果信令服务器本身被中间人控制，它可以在首次交换时分别给 A、B 注入
 *   假公钥，使 A、B 各自算出"看似一致"的假安全码（MITM）。
 *   带外交换让"核对身份"这一步完全不依赖信令：你把自己的公钥离线发给
 *   对方，对方用这份离线收到的公钥算指纹——中间人无法在同一份离线材料上
 *   做手脚（除非它也控制了你用来发公钥的那条带外渠道）。
 *
 * 格式（稳定、可跨版本）：
 *   `nymir1:<base64url(JSON)>`  JSON = {"e": encPub, "s": signPub}
 *   前缀便于识别与版本演进；base64url 无换行/无 = 填充，适合复制与二维码。
 *
 * 安全边界：
 *   - 本模块只负责格式与指纹计算，**不提升密码学强度**；它把"信任锚点"
 *     从不可信的信令服务器转移到了用户自选的带外渠道。
 *   - 若带外渠道也被中间人控制，仍可被绕过；此时只能面对面核对。
 */

import { buildFingerprint, type Fingerprint, type IdentityKeys } from './fingerprint'

export type { IdentityKeys, Fingerprint }

const PREFIX = 'nymir1'

function toBase64Url(input: string): string {
  // btoa 输出标准 base64，转成 url-safe 并去掉填充
  const b64 = btoa(unescape(encodeURIComponent(input)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  return decodeURIComponent(escape(atob(padded)))
}

function isBase64Like(s: string): boolean {
  return /^[A-Za-z0-9+/=_-]+$/.test(s) && s.length > 0
}

/** 把自己的身份公钥序列化为可复制 / 可扫码的字符串 */
export function serializeIdentity(keys: IdentityKeys): string {
  const json = JSON.stringify({ e: keys.encPub, s: keys.signPub })
  return `${PREFIX}:${toBase64Url(json)}`
}

/** 从字符串解析对方身份公钥；格式非法 / 缺字段返回 null（不抛错） */
export function parseIdentity(text: string): IdentityKeys | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith(`${PREFIX}:`)) return null
  const payload = trimmed.slice(PREFIX.length + 1)
  if (!payload) return null
  try {
    const json = fromBase64Url(payload)
    const obj = JSON.parse(json) as Record<string, unknown>
    const e = obj.e
    const s = obj.s
    if (typeof e !== 'string' || typeof s !== 'string') return null
    if (!isBase64Like(e) || !isBase64Like(s)) return null
    return { encPub: e, signPub: s }
  } catch {
    return null
  }
}

/**
 * 用"自己身份 + 对方身份"算出共同安全码指纹。
 * 与在线安全码核对使用同一算法（buildFingerprint），保证一致。
 */
export function computeFingerprintOutOfBand(
  own: IdentityKeys,
  peer: IdentityKeys,
): Promise<Fingerprint> {
  return buildFingerprint(own, peer)
}
