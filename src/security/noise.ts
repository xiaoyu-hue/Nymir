/**
 * Nymir 流量混淆模块
 *
 * 通过添加噪声数据来提高流量分析的成本。
 *
 * ⚠️ 能力边界（诚实声明，勿高估）：
 * - 当前噪声是基础版，存在可识别特征：固定间隔、burnMode 恒为 read_once、无 sender、无 signature。
 * - 有经验的流量分析者仍可能通过周期性和字段特征区分噪声与真实消息。
 * - 本模块的目标是「提高分析成本」，而非「完全无法区分」。
 * - 更强的混淆（随机间隔、假 sender/签名、随机 burnMode）需要更大的设计改动，暂未实现。
 *
 * 原理：
 * - 在真实消息中混入随机噪声消息
 * - 接收方通过 isNoiseMessage 识别并丢弃噪声
 * - 使流量分析更困难（但非不可能）
 */

import { log } from '../utils/logger'
import { uint8ToBase64 } from '../utils/base64'
import { secureRandomInt } from '../utils/random'
import { NOISE_INTERVAL_MS, FAKE_ID_LENGTH } from '../constants'

const NOISE_ENABLED = true

let noiseTimer: ReturnType<typeof setInterval> | null = null
let noiseCount = 0

/**
 * 生成随机 ID（模拟真实消息 ID 格式）
 */
function generateFakeId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < FAKE_ID_LENGTH; i++) {
    result += chars[secureRandomInt(chars.length)]
  }
  return result
}

/**
 * 生成噪声消息（外观与真实加密消息完全一致）
 */
function generateNoiseMessage(): Record<string, unknown> {
  // 生成看起来像加密内容的 base64 字符串
  const fakeEncrypted = uint8ToBase64(crypto.getRandomValues(new Uint8Array(48)))
  return {
    id: generateFakeId(),
    content: fakeEncrypted,
    timestamp: Date.now(),
    burnMode: 'read_once',
    readBy: [],
    destroyed: false,
    encrypted: true,
    // 无 signature、无 sender — 与真实加密消息外观一致
  }
}

/**
 * 检查是否是噪声消息
 * 基于: 无 sender 字段 + encrypted=true + 无 signature + burnMode=read_once
 * 真实消息必须有 sender（来自 messageManager.send 的 payload）
 */
export function isNoiseMessage(data: Record<string, unknown>): boolean {
  // 真实消息必须有 sender 字段
  if (data.sender) return false

  // 噪声特征：加密 + 无签名 + read_once 模式
  return (
    data.encrypted === true &&
    !data.signature &&
    data.burnMode === 'read_once' &&
    typeof data.content === 'string' &&
    data.content.length > 10
  )
}

/**
 * 启动噪声生成
 */
export function startNoiseGeneration(
  sendFn: (data: Record<string, unknown>) => void,
): void {
  if (!NOISE_ENABLED) return
  if (noiseTimer) return

  noiseCount = 0 // 每次启动时重置计数，避免 stop/start 后统计累加
  noiseTimer = setInterval(() => {
    const noise = generateNoiseMessage()
    sendFn(noise)
    noiseCount++
  }, NOISE_INTERVAL_MS)

  log('[Noise] Started noise generation')
}

/**
 * 停止噪声生成
 */
export function stopNoiseGeneration(): void {
  if (noiseTimer) {
    clearInterval(noiseTimer)
    noiseTimer = null
    log(`[Noise] Stopped. Sent ${noiseCount} noise messages`)
  }
}
