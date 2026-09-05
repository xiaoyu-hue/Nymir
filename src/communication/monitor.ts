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
import { MONITOR_PING_INTERVAL_MS, QUALITY_EXCELLENT_MS, QUALITY_GOOD_MS, QUALITY_FAIR_MS } from '../constants'

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

interface PingChannel {
  send: (data: Record<string, unknown>, target?: string) => void
  onMessage: (cb: (data: Record<string, unknown>, info: { peerId: string }) => void) => void
}

class ConnectionMonitor {
  private latency = 0
  private connectedAt = 0
  private messagesSent = 0
  private messagesReceived = 0
  private bytesSent = 0
  private bytesReceived = 0
  private peersConnected = 0
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private pendingPings = new Map<string, number>() // pingId -> sentAt
  private listeners: StatsListener[] = []
  private active = false
  private channel: PingChannel | null = null

  start(): void {
    if (this.active) return
    this.active = true
    this.connectedAt = Date.now()

    this.pingTimer = setInterval(() => {
      this.sendPing()
    }, MONITOR_PING_INTERVAL_MS)

    log('[Monitor] Started')
  }

  stop(): void {
    this.active = false
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
    this.pendingPings.clear()
    this.channel = null
    log('[Monitor] Stopped')
  }

  /**
   * 设置 ping/pong 通信通道
   */
  setChannel(channel: PingChannel): void {
    this.channel = channel
    channel.onMessage((data, { peerId }) => {
      if (data.type === 'ping') {
        // 回复 pong，附带原始时间戳
        this.channel?.send({ type: 'pong', ts: data.ts }, peerId)
      } else if (data.type === 'pong') {
        this.handlePong(data as { ts: number })
      }
    })
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

  private handlePong(data: { ts?: number }): void {
    if (typeof data.ts !== 'number') return
    const now = Date.now()
    const rtt = now - data.ts
    // 滑动平均
    this.latency = this.latency === 0 ? rtt : Math.round(this.latency * 0.7 + rtt * 0.3)
    this.emitStats()
  }

  private sendPing(): void {
    if (!this.channel || this.peersConnected === 0) return
    const ts = Date.now()
    this.channel.send({ type: 'ping', ts })
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
    if (this.latency < QUALITY_EXCELLENT_MS) return 'excellent'
    if (this.latency < QUALITY_GOOD_MS) return 'good'
    if (this.latency < QUALITY_FAIR_MS) return 'fair'
    return 'poor'
  }

  private emitStats(): void {
    const stats = this.getStats()
    for (const cb of this.listeners) cb(stats)
  }
}

export const connectionMonitor = new ConnectionMonitor()
