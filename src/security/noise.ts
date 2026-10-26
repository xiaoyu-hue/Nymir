/**
 * Nymir 流量混淆模块
 *
 * 通过添加噪声数据来提高流量分析的成本。
 *
 * ⚠️ 能力边界（诚实声明，勿高估）：
 * - 已对噪声做随机化：发送间隔在 [NOISE_MIN_INTERVAL_MS, NOISE_MAX_INTERVAL_MS] 间随机、
 *   载荷长度在 [NOISE_MIN_LEN, NOISE_MAX_LEN] 间随机，打破了「固定每 30s / 固定 48 字节」特征。
 * - 但噪声仍与真实消息共享同一条 DTLS 加密数据通道，观察者仍可看到「总字节量」与「粗粒度活跃度」，
 *   无法完全隐藏通信是否发生。
 * - 本模块的目标是「提高分析成本」，而非「完全无法区分」。要对标 obfs4 / 域前置等需要远端代理，
 *   纯浏览器端不可行（详见技术提升调研报告）。
 *
 * 原理：
 * - 在真实消息中混入随机噪声消息（无 sender 字段，接收方据此丢弃）
 * - 接收方通过 isNoiseMessage 识别并丢弃噪声
 * - 使流量分析更困难（但非不可能）
 */

import { log } from '../utils/logger'
import { uint8ToBase64 } from '../utils/base64'
import { secureRandomInt } from '../utils/random'
import {
  NOISE_MIN_INTERVAL_MS,
  NOISE_MAX_INTERVAL_MS,
  NOISE_MIN_LEN,
  NOISE_MAX_LEN,
  FAKE_ID_LENGTH,
} from '../constants'

const NOISE_ENABLED = true

let noiseTimer: ReturnType<typeof setTimeout> | null = null
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
 * 生成随机噪声载荷长度（贴近真实加密消息长度分布）
 */
function randomNoiseLength(): number {
  return NOISE_MIN_LEN + secureRandomInt(NOISE_MAX_LEN - NOISE_MIN_LEN + 1)
}

/**
 * 生成噪声消息（外观与真实加密消息一致）
 */
function generateNoiseMessage(): Record<string, unknown> {
  // 生成看起来像加密内容的随机长度 base64 字符串（长度随机化）
  const fakeEncrypted = uint8ToBase64(
    crypto.getRandomValues(new Uint8Array(randomNoiseLength())),
  )
  return {
    id: generateFakeId(),
    content: fakeEncrypted,
    timestamp: Date.now(),
    burnMode: 'read_once',
    readBy: [],
    destroyed: false,
    encrypted: true,
    // 无 signature、无 sender — 与真实加密消息外观一致，且长度随机
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
 * 计算下一次噪声发送的随机延迟（区间随机，打破固定周期）
 */
function nextNoiseDelay(): number {
  return (
    NOISE_MIN_INTERVAL_MS +
    secureRandomInt(NOISE_MAX_INTERVAL_MS - NOISE_MIN_INTERVAL_MS + 1)
  )
}

/**
 * 自调度下一次噪声发送（递归 setTimeout，每次延迟随机）
 */
function scheduleNextNoise(sendFn: (data: Record<string, unknown>) => void): void {
  noiseTimer = setTimeout(() => {
    const noise = generateNoiseMessage()
    sendFn(noise)
    noiseCount++
    scheduleNextNoise(sendFn)
  }, nextNoiseDelay())
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
  scheduleNextNoise(sendFn)

  log('[Noise] Started noise generation (randomised interval & length)')
}

/**
 * 停止噪声生成
 */
export function stopNoiseGeneration(): void {
  if (noiseTimer) {
    clearTimeout(noiseTimer)
    noiseTimer = null
    log(`[Noise] Stopped. Sent ${noiseCount} noise messages`)
  }
}
