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
import { uint8ToBase64 } from '../utils/base64'

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
