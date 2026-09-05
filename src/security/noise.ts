/**
 * Nymir 流量混淆模块
 * 
 * 通过添加噪声数据来混淆流量分析
 * 
 * 原理：
 * - 在真实消息中混入随机噪声消息
 * - 噪声消息格式与真实消息相同（无可识别标记）
 * - 接收方无法区分噪声与真实消息
 * - 使流量分析更困难
 */

import { log } from '../utils/logger'

const NOISE_INTERVAL_MS = 30000 // 30秒发送一次噪声
const NOISE_ENABLED = true

let noiseTimer: ReturnType<typeof setInterval> | null = null
let noiseCount = 0

/**
 * 生成随机噪声数据（模拟真实消息内容）
 */
function generateNoiseData(): string {
  const length = Math.floor(Math.random() * 100) + 10
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

/**
 * 生成随机 ID（模拟真实消息 ID 格式）
 */
function generateFakeId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 20; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

/**
 * 生成噪声消息（外观与真实消息完全一致）
 */
function generateNoiseMessage(): Record<string, unknown> {
  return {
    id: generateFakeId(),
    content: generateNoiseData(),
    timestamp: Date.now(),
    burnMode: 'read_once',
    readBy: [],
    destroyed: false,
    encrypted: false,
    // 无 signature、无 noise 标记、无 sender 字段 — 与真实消息外观一致
  }
}

/**
 * 检查是否是噪声消息（基于无签名 + 无加密 + read_once 模式）
 * 注意：真实消息也可能无签名（如果发送方 E2EE 未就绪），所以这是概率性检测
 */
export function isNoiseMessage(data: Record<string, unknown>): boolean {
  // 真实消息必须有 sender 字段（来自 messageManager.send 的 payload）
  // 噪声消息不包含 sender —— 这是最可靠的区分特征
  if (data.sender) return false

  // 噪声特征：未加密 + 无签名 + burnMode 为 read_once
  return (
    data.encrypted === false &&
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

/**
 * 获取噪声统计
 */
export function getNoiseStats(): { count: number; enabled: boolean } {
  return { count: noiseCount, enabled: NOISE_ENABLED }
}
