/**
 * Nymir 安全码指纹模块
 *
 * 用途：
 *   把"双方长期身份公钥"压缩成用户可口头/屏幕比对的短码，
 *   用于带外（out-of-band）核对，识别首次建链时的中间人攻击。
 *
 * 算法：
 *   1. 收集四段 base64 公钥：双方各自持有自己和对方的
 *      X25519 加密公钥 + Ed25519 签名公钥。
 *   2. 四段按字典序排序后用换行拼接 → SHA-256。
 *      排序保证：A 侧和 B 侧虽然"自己/对方"角色相反，
 *      但排序后输入字节串完全一致，两侧算出的指纹必然相同。
 *   3. 前 6 字节（48 bit，大端）→ 15 位十进制数字（3 组×5），主验证手段。
 *   4. 接下来 7 字节 → 7 组×6 bit → 固定 64 emoji 表，视觉辅助。
 *
 * 安全边界：
 *   - 这是静态公钥指纹，不是 Matrix/Signal 那种交互式 SAS 握手。
 *     它能识别"中间人替换了任一方公钥"——中间人看不到明文四段公钥，
 *     无法让 A/B 两侧对同一段输入算出同一指纹。
 *   - 它本身不构成安全：指纹显示在本地屏幕上，必须由用户通过
 *     另一条独立渠道（电话/微信/当面）把这串数字念给对方比对。
 *   - 若中间人同时控制了"你们核对数字用的那条渠道"，仍可绕过；
 *     此时只能面对面核对。详见 docs/THREAT_MODEL.md。
 *
 * 互操作性：
 *   本表与派生参数仅 Nymir 内部使用，不兼容 Signal/Matrix/Session 的指纹格式。
 */

export interface IdentityKeys {
  /** X25519 加密公钥（base64） */
  encPub: string
  /** Ed25519 签名公钥（base64） */
  signPub: string
}

export interface Fingerprint {
  /** 15 位十进制数字，分 3 组显示，如 "48291 73506 19483" */
  decimal: string
  /** 7 个 emoji，视觉辅助 */
  emojis: string[]
}

/**
 * 固定 64 个 emoji。
 * 选用跨平台渲染相对稳定、辨识度高的水果/动物/自然/物品，
 * 不含肤色变体与旗帜。仅作视觉辅助，主验证手段为 decimal。
 * 导出仅用于测试与未来 UI 复用，请勿在业务代码中随意增删。
 */
export const EMOJI_TABLE: readonly string[] = [
  '🍎', '🍊', '🍋', '🍉', '🍇', '🍓', '🍒', '🍑',
  '🍍', '🥝', '🍅', '🥑', '🌽', '🥕', '🌶', '🍄',
  '🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐨',
  '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧',
  '🐦', '🦆', '🐟', '🐙', '🦋', '🐢', '🐝', '🐞',
  '🌲', '🌳', '🌴', '🌵', '🌸', '🌺', '🌻', '🌷',
  '🍀', '🌈', '⛅', '⭐', '🌙', '☀️', '⛰️', '🔥',
  '💧', '❄️', '⚡', '🌊', '🎁', '🎈', '🎀', '🔔',
]

/**
 * 把 6 字节大端无符号整数转成 15 位十进制，分 3 组×5。
 * 48 bit 最大值 2^48-1 ≈ 2.8e14，是 15 位数，恰好补零对齐。
 */
function bytesToDecimalGroups(bytes: Uint8Array): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const hi = view.getUint32(0, false) // big-endian，高 32 位
  const lo = view.getUint16(4, false) // big-endian，低 16 位
  const value = hi * 0x100000000 + lo
  const padded = value.toString().padStart(15, '0')
  return `${padded.slice(0, 5)} ${padded.slice(5, 10)} ${padded.slice(10, 15)}`
}

/**
 * 从 7 字节里读 7 组×6 bit，每组选一个 emoji。
 * 位流从 bit 0 起读，跨字节用相邻两字节拼成 16 位后右移对齐。
 */
function bytesToEmojis(bytes: Uint8Array): string[] {
  const out: string[] = []
  for (let i = 0; i < 7; i++) {
    const bitOffset = i * 6
    const byteIdx = Math.floor(bitOffset / 8)
    const bitInByte = bitOffset % 8
    const pair = (bytes[byteIdx] << 8) | bytes[byteIdx + 1]
    const idx = (pair >>> (10 - bitInByte)) & 0x3f
    out.push(EMOJI_TABLE[idx])
  }
  return out
}

/**
 * 计算双方共同的安全码指纹。
 *
 * @param own  自己的两个公钥
 * @param peer 对方的两个公钥
 * @returns    15 位十进制 + 7 个 emoji
 */
export async function buildFingerprint(
  own: IdentityKeys,
  peer: IdentityKeys,
): Promise<Fingerprint> {
  const parts = [own.encPub, own.signPub, peer.encPub, peer.signPub]
  // 排序：保证双方即使角色互换，输入字节串也完全一致
  const input = new TextEncoder().encode([...parts].sort().join('\n'))
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input))
  return {
    decimal: bytesToDecimalGroups(digest.slice(0, 6)),
    emojis: bytesToEmojis(digest.slice(6, 13)),
  }
}
