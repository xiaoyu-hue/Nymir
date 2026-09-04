/**
 * Nymir 流量混淆模块
 * 
 * 通过添加噪声数据来混淆流量分析
 * 
 * 原理：
 * - 在真实消息中混入随机噪声消息
 * - 噪声消息格式与真实消息相同
 * - 接收方验证签名后丢弃无效消息
 * - 使流量分析更困难
 */

import { e2eeManager } from './e2eeManager'

const NOISE_INTERVAL_MS = 30000 // 30秒发送一次噪声
const NOISE_ENABLED = true

let noiseTimer: ReturnType<typeof setInterval> | null = null
let noiseCount = 0

/**
 * 生成随机噪声数据
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
 * 生成噪声消息
 */
async function generateNoiseMessage(): Promise<Record<string, unknown>> {
  const signature = await e2eeManager.sign('noise')
  return {
    id: `noise-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    content: generateNoiseData(),
    sender: 'noise',
    timestamp: Date.now(),
    burnMode: 'read_once',
    readBy: [],
    destroyed: false,
    encrypted: false,
    noise: true,
    signature: signature ?? '',
  }
}

/**
 * 检查是否是噪声消息
 */
export function isNoiseMessage(data: Record<string, unknown>): boolean {
  return data.noise === true || data.sender === 'noise'
}

/**
 * 启动噪声生成
 */
export function startNoiseGeneration(
  sendFn: (data: Record<string, unknown>) => void,
): void {
  if (!NOISE_ENABLED) return
  if (noiseTimer) return

  noiseTimer = setInterval(async () => {
    const noise = await generateNoiseMessage()
    sendFn(noise)
    noiseCount++
  }, NOISE_INTERVAL_MS)

  console.log('[Noise] Started noise generation')
}

/**
 * 停止噪声生成
 */
export function stopNoiseGeneration(): void {
  if (noiseTimer) {
    clearInterval(noiseTimer)
    noiseTimer = null
    console.log(`[Noise] Stopped. Sent ${noiseCount} noise messages`)
  }
}

/**
 * 获取噪声统计
 */
export function getNoiseStats(): { count: number; enabled: boolean } {
  return { count: noiseCount, enabled: NOISE_ENABLED }
}
