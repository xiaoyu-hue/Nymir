/**
 * Nymir 离线消息队列
 * 
 * 职责：
 * - 发送失败的消息暂存本地
 * - peer 上线后自动重发
 * - 追踪消息投递状态
 * - 过期消息自动清理
 */

import { log } from '../utils/logger'

const QUEUE_STORAGE_KEY = 'nymir_offline_queue'
const MAX_QUEUE_AGE_MS = 24 * 60 * 60 * 1000 // 24 小时
const MAX_QUEUE_SIZE = 100

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'expired' | 'failed'

export interface QueuedMessage {
  id: string
  roomId: string
  payload: Record<string, unknown>
  targetPeers: string[]
  createdAt: number
  attempts: number
  lastAttempt: number
  status: DeliveryStatus
}

type QueueListener = (message: QueuedMessage, status: DeliveryStatus) => void

class OfflineQueue {
  private queue: QueuedMessage[] = []
  private listeners: QueueListener[] = []

  constructor() {
    this.loadFromStorage()
  }

  /**
   * 消息入队
   */
  enqueue(
    msgId: string,
    roomId: string,
    payload: Record<string, unknown>,
    targetPeers: string[],
  ): void {
    // 检查是否已存在
    const existing = this.queue.find((q) => q.id === msgId)
    if (existing) return

    const queued: QueuedMessage = {
      id: msgId,
      roomId,
      payload,
      targetPeers,
      createdAt: Date.now(),
      attempts: 0,
      lastAttempt: 0,
      status: 'pending',
    }

    this.queue.push(queued)
    this.prune()
    this.saveToStorage()
    this.emit(queued, 'pending')

    log(`[OfflineQueue] Enqueued message ${msgId} (queue size: ${this.queue.length})`)
  }

  /**
   * 标记消息已发送
   */
  markSent(msgId: string): void {
    const item = this.queue.find((q) => q.id === msgId)
    if (item) {
      item.status = 'sent'
      item.lastAttempt = Date.now()
      item.attempts++
      this.saveToStorage()
      this.emit(item, 'sent')
    }
  }

  /**
   * 标记消息已投递（所有 peer 确认收到）
   */
  markDelivered(msgId: string): void {
    const item = this.queue.find((q) => q.id === msgId)
    if (item) {
      item.status = 'delivered'
      this.saveToStorage()
      this.emit(item, 'delivered')

      // 移除已投递的消息
      this.queue = this.queue.filter((q) => q.id !== msgId)
      this.saveToStorage()
    }
  }

  /**
   * 标记消息投递失败
   */
  markFailed(msgId: string): void {
    const item = this.queue.find((q) => q.id === msgId)
    if (item) {
      item.status = 'failed'
      item.attempts++
      item.lastAttempt = Date.now()
      this.saveToStorage()
      this.emit(item, 'failed')
    }
  }

  /**
   * 获取待发送的消息列表
   */
  getPending(roomId: string): QueuedMessage[] {
    return this.queue.filter(
      (q) =>
        q.roomId === roomId &&
        q.status === 'pending' &&
        q.attempts < 3,
    )
  }

  /**
   * 获取队列状态
   */
  getStats(): { total: number; pending: number; sent: number; failed: number } {
    return {
      total: this.queue.length,
      pending: this.queue.filter((q) => q.status === 'pending').length,
      sent: this.queue.filter((q) => q.status === 'sent').length,
      failed: this.queue.filter((q) => q.status === 'failed').length,
    }
  }

  onMessage(cb: QueueListener): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== cb)
    }
  }

  /**
   * 清理过期消息
   */
  private prune(): void {
    const now = Date.now()
    this.queue = this.queue.filter((q) => {
      if (now - q.createdAt > MAX_QUEUE_AGE_MS) {
        q.status = 'expired'
        this.emit(q, 'expired')
        return false
      }
      return true
    })

    // 限制队列大小
    if (this.queue.length > MAX_QUEUE_SIZE) {
      const excess = this.queue.splice(0, this.queue.length - MAX_QUEUE_SIZE)
      for (const item of excess) {
        item.status = 'expired'
        this.emit(item, 'expired')
      }
    }
  }

  private emit(message: QueuedMessage, status: DeliveryStatus): void {
    for (const cb of this.listeners) cb(message, status)
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue))
    } catch (e) {
      log('[OfflineQueue] Failed to save to storage:', e)
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY)
      if (raw) {
        this.queue = JSON.parse(raw)
        this.prune()
      }
    } catch (e) {
      log('[OfflineQueue] Failed to load from storage:', e)
      this.queue = []
    }
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.queue = []
    this.saveToStorage()
  }
}

export const offlineQueue = new OfflineQueue()
