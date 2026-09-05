/**
 * Nymir 连接质量监控
 * 
 * 追踪：
 * - 延迟（通过 ping/pong 测量）
 * - 连接时长
 * - 消息收发统计
 * - 连接质量评级
 */

import { log } from '../utils/logger'

export type QualityLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'

export interface ConnectionStats {
  latencyMs: number
  uptimeMs: number
  messagesSent: number
  messagesReceived: number
  peersConnected: number
  quality: QualityLevel
  bytesSent: number
  bytesReceived: number
}

type StatsListener = (stats: ConnectionStats) => void

const LATENCY_PING_INTERVAL = 5000
const QUALITY_EXCELLENT_THRESHOLD = 100
const QUALITY_GOOD_THRESHOLD = 300
const QUALITY_FAIR_THRESHOLD = 800

class ConnectionMonitor {
  private latency = 0
  private connectedAt = 0
  private messagesSent = 0
  private messagesReceived = 0
  private bytesSent = 0
  private bytesReceived = 0
  private peersConnected = 0
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private pendingPings = new Map<string, number>()
  private listeners: StatsListener[] = []
  private active = false

  start(): void {
    if (this.active) return
    this.active = true
    this.connectedAt = Date.now()

    this.pingTimer = setInterval(() => {
      this.sendPing()
    }, LATENCY_PING_INTERVAL)

    log('[Monitor] Started')
  }

  stop(): void {
    this.active = false
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
    this.pendingPings.clear()
    log('[Monitor] Stopped')
  }

  onStats(cb: StatsListener): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== cb)
    }
  }

  recordMessageSent(size: number): void {
    this.messagesSent++
    this.bytesSent += size
    this.emitStats()
  }

  recordMessageReceived(size: number): void {
    this.messagesReceived++
    this.bytesReceived += size
    this.emitStats()
  }

  setPeerCount(count: number): void {
    this.peersConnected = count
    this.emitStats()
  }

  handlePong(peerId: string): void {
    const sentAt = this.pendingPings.get(peerId)
    if (sentAt) {
      this.latency = Date.now() - sentAt
      this.pendingPings.delete(peerId)
      this.emitStats()
    }
  }

  private sendPing(): void {
    const pingId = crypto.randomUUID()
    const peerId = `ping:${pingId}`
    this.pendingPings.set(peerId, Date.now())

    // 超时清理
    setTimeout(() => {
      if (this.pendingPings.has(peerId)) {
        this.pendingPings.delete(peerId)
      }
    }, LATENCY_PING_INTERVAL)
  }

  getLatency(): number {
    return this.latency
  }

  getStats(): ConnectionStats {
    return {
      latencyMs: this.latency,
      uptimeMs: this.active ? Date.now() - this.connectedAt : 0,
      messagesSent: this.messagesSent,
      messagesReceived: this.messagesReceived,
      peersConnected: this.peersConnected,
      quality: this.calculateQuality(),
      bytesSent: this.bytesSent,
      bytesReceived: this.bytesReceived,
    }
  }

  private calculateQuality(): QualityLevel {
    if (this.latency === 0) return 'unknown'
    if (this.latency < QUALITY_EXCELLENT_THRESHOLD) return 'excellent'
    if (this.latency < QUALITY_GOOD_THRESHOLD) return 'good'
    if (this.latency < QUALITY_FAIR_THRESHOLD) return 'fair'
    return 'poor'
  }

  private emitStats(): void {
    const stats = this.getStats()
    for (const cb of this.listeners) cb(stats)
  }
}

export const connectionMonitor = new ConnectionMonitor()
