import { peerManager, type Channel } from '../communication/peer'
import { saveMessage, markMessageRead, destroyMessage } from '../persistence/db'
import { e2eeManager } from '../security/e2eeManager'
import { isNoiseMessage, startNoiseGeneration, stopNoiseGeneration } from '../security/noise'
import { generateMessageId } from '../utils/id'
import { warn } from '../utils/logger'
import type { Message, BurnConfig } from './types'
import { shouldDestroy, getRemainingMs } from './burn'

export type MessageListener = (msg: Message) => void
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPayload = Record<string, any>

const READ_ONCE_AUTO_DESTROY_MS = 30 * 60 * 1000 // 30 minutes safety net

function logError(context: string, err: unknown, extra?: Record<string, unknown>): void {
  const msg = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined
  console.error(`[Message] ${context}: ${msg}`, { ...extra, stack })
}

export class MessageManager {
  private channel: Channel<AnyPayload> | null = null
  private readChannel: Channel<AnyPayload> | null = null
  private recallChannel: Channel<AnyPayload> | null = null
  private listeners: MessageListener[] = []
  private messageStore = new Map<string, Message>()
  private burnTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private roomId: string = ''
  private _cachedMessages: Message[] | null = null

  init(roomId: string): void {
    this.roomId = roomId
    this.channel = peerManager.makeChannel<AnyPayload>('messages')
    this.readChannel = peerManager.makeChannel<AnyPayload>('read-receipts')
    this.recallChannel = peerManager.makeChannel<AnyPayload>('recall')

    this.channel.onMessage(async (data, { peerId }) => {
      try {
        await this.handleIncomingMessage(data, peerId)
      } catch (err) {
        logError('onMessage handler error', err, {
          roomId: this.roomId,
          peerId,
          msgId: data?.id,
        })
      }
    })

    this.readChannel.onMessage(async (data) => {
      try {
        if (data.type === 'read') {
          const msg = this.messageStore.get(data.msgId)
          if (msg && !msg.readBy.includes(data.peerId)) {
            msg.readBy.push(data.peerId)
            await markMessageRead(data.msgId, data.peerId)
            this.notifyListeners(msg)
          }
        }
      } catch (err) {
        logError('readChannel handler error', err, {
          roomId: this.roomId,
          msgId: data?.msgId,
        })
      }
    })

    this.recallChannel.onMessage(async (data) => {
      try {
        if (data.type === 'recall') {
          const msg = this.messageStore.get(data.msgId)
          if (msg && data.peerId === msg.sender) {
            await this.burn(msg)
          }
        }
      } catch (err) {
        logError('recallChannel handler error', err, {
          roomId: this.roomId,
          msgId: data?.msgId,
        })
      }
    })

    // 启动噪声生成
    startNoiseGeneration((noise) => {
      this.channel?.send(noise)
    })
  }

  /**
   * 处理接收到的消息（解密 + 验证 + 持久化）
   */
  private async handleIncomingMessage(data: AnyPayload, peerId: string): Promise<void> {
    // 过滤噪声消息
    if (isNoiseMessage(data)) return

    // 验证 payload 必要字段
    if (!data.id || !data.timestamp || !data.burnMode) {
      warn('[Message] Ignoring malformed payload:', {
        peerId,
        hasId: !!data.id,
        hasTimestamp: !!data.timestamp,
        hasBurnMode: !!data.burnMode,
      })
      return
    }

    let content = ''
    let decryptFailed = false
    let verified: boolean | undefined = undefined

    // 解密处理
    if (data.encrypted) {
      try {
        const decrypted = await e2eeManager.decrypt(data.content, peerId, data.id)
        if (decrypted) {
          content = decrypted
        } else {
          // 解密失败 — 不使用明文回退
          decryptFailed = true
          content = '[encrypted message]'
          warn('[Message] Decrypt failed, not saving as readable:', {
            roomId: this.roomId,
            msgId: data.id,
            peerId,
          })
        }
      } catch (err) {
        decryptFailed = true
        content = '[encrypted message]'
        logError('Decrypt error', err, {
          roomId: this.roomId,
          msgId: data.id,
          peerId,
        })
      }
    } else {
      content = data.content
    }

    // 签名验证
    if (data.signature && !decryptFailed) {
      try {
        const valid = await e2eeManager.verify(content, data.signature, peerId)
        verified = valid
        if (!valid) {
          warn('[Message] Signature verification failed:', {
            roomId: this.roomId,
            msgId: data.id,
            peerId,
          })
        }
      } catch (err) {
        verified = false
        logError('Verify error', err, {
          roomId: this.roomId,
          msgId: data.id,
          peerId,
        })
      }
    }

    // 如果解密失败，不保存为正常可读消息
    if (decryptFailed) {
      const failedMsg: Message = {
        id: data.id,
        content: '',
        sender: peerId,
        timestamp: data.timestamp,
        burnMode: data.burnMode,
        burnAfter: data.burnAfter,
        burnAt: data.burnAt,
        readBy: [],
        destroyed: false,
        decryptFailed: true,
        verified: false,
      }
      this.messageStore.set(failedMsg.id, failedMsg)
      this.invalidateCache()
      try {
        await saveMessage({ ...failedMsg, roomId: this.roomId })
      } catch (err) {
        logError('saveMessage (decryptFailed) error', err, {
          roomId: this.roomId,
          msgId: data.id,
        })
      }
      this.notifyListeners(failedMsg)
      return
    }

    const msg: Message = {
      id: data.id,
      content,
      sender: peerId,
      timestamp: data.timestamp,
      burnMode: data.burnMode,
      burnAfter: data.burnAfter,
      burnAt: data.burnAt,
      readBy: [],
      destroyed: false,
      verified,
    }

    this.messageStore.set(msg.id, msg)
    this.invalidateCache()
    try {
      await saveMessage({ ...msg, roomId: this.roomId })
    } catch (err) {
      logError('saveMessage error', err, { roomId: this.roomId, msgId: msg.id })
    }
    this.scheduleBurn(msg)
    this.notifyListeners(msg)
  }

  /**
   * 发送消息：为每个 peer 单独加密并单播发送
   */
  async send(content: string, burn: BurnConfig): Promise<Message> {
    if (!this.channel) throw new Error('MessageManager not initialized')

    const msg: Message = {
      id: generateMessageId(),
      content,
      sender: peerManager.id,
      timestamp: Date.now(),
      burnMode: burn.mode,
      burnAfter: burn.burnAfter,
      burnAt: burn.burnAt,
      readBy: [],
      destroyed: false,
    }

    try {
      // 计算签名（对原始明文签名）
      const signature = await e2eeManager.sign(content)

      const peerList = peerManager.peerList

      if (peerList.length > 0) {
        // 为每个 peer 单独加密并发送
        for (const peerId of peerList) {
          try {
            const encrypted = await e2eeManager.encrypt(content, peerId, msg.id)
            if (!encrypted) {
              // 加密失败（无 peer 公钥）— 不发送明文，跳过该 peer
              warn('[Message] Encrypt returned null, skipping peer')
              continue
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payload: AnyPayload = {
              ...msg,
              content: encrypted,
              encrypted: true,
            }
            if (signature) {
              payload.signature = signature
            }
            this.channel.send(payload, peerId)
          } catch (err) {
            logError('Per-peer encrypt/send failed', err, {
              roomId: this.roomId,
              msgId: msg.id,
              peerId,
            })
            // 跳过该 peer，不影响其他 peer
          }
        }
      } else {
        // 没有 peer，仅本地保存（不发送）
      }

      // 本地存储
      this.messageStore.set(msg.id, msg)
      this.invalidateCache()
      try {
        await saveMessage({ ...msg, roomId: this.roomId })
      } catch (err) {
        logError('saveMessage (send) error', err, {
          roomId: this.roomId,
          msgId: msg.id,
        })
      }
      this.scheduleBurn(msg)
      this.notifyListeners(msg)
      return msg
    } catch (err) {
      logError('send() unrecoverable error', err, {
        roomId: this.roomId,
        msgId: msg.id,
      })
      throw err
    }
  }

  async recall(msgId: string): Promise<boolean> {
    const msg = this.messageStore.get(msgId)
    if (!msg || msg.sender !== peerManager.id) return false

    // Broadcast recall to peers
    this.recallChannel?.send({ type: 'recall', msgId, peerId: peerManager.id })

    // Destroy locally
    await this.burn(msg)
    return true
  }

  async markRead(msgId: string): Promise<void> {
    const msg = this.messageStore.get(msgId)
    if (!msg || msg.sender === peerManager.id) return

    if (!msg.readBy.includes(peerManager.id)) {
      msg.readBy.push(peerManager.id)
      try {
        await markMessageRead(msgId, peerManager.id)
      } catch (err) {
        logError('markMessageRead error', err, { roomId: this.roomId, msgId })
      }

      // Broadcast read receipt
      this.readChannel?.send({
        type: 'read',
        msgId,
        peerId: peerManager.id,
      })

      if (shouldDestroy(msg)) {
        await this.burn(msg)
      } else {
        this.notifyListeners(msg)
      }
    }
  }

  private async burn(msg: Message): Promise<void> {
    msg.destroyed = true
    this.clearBurnTimer(msg.id)
    this.messageStore.delete(msg.id)
    this.invalidateCache()
    try {
      await destroyMessage(msg.id)
    } catch (err) {
      // destroyMessage 幂等：如果 id 不存在，不应抛出
      logError('destroyMessage error (idempotent)', err, {
        roomId: this.roomId,
        msgId: msg.id,
      })
    }
    this.notifyListeners(msg)
  }

  private scheduleBurn(msg: Message): void {
    if (msg.destroyed || msg.burnMode === 'persist') return

    // read_once: schedule a safety-net auto-destroy after 30 min
    if (msg.burnMode === 'read_once') {
      const timer = setTimeout(() => {
        if (this.messageStore.has(msg.id) && msg.readBy.length === 0) {
          this.burn(msg)
        }
      }, READ_ONCE_AUTO_DESTROY_MS)
      this.burnTimers.set(msg.id, timer)
      return
    }

    const remaining = getRemainingMs(msg)
    if (remaining <= 0) {
      this.burn(msg)
      return
    }

    const timer = setTimeout(() => {
      this.burn(msg)
    }, remaining)

    this.burnTimers.set(msg.id, timer)
  }

  private clearBurnTimer(msgId: string): void {
    const timer = this.burnTimers.get(msgId)
    if (timer) {
      clearTimeout(timer)
      this.burnTimers.delete(msgId)
    }
  }

  private notifyListeners(msg: Message): void {
    for (const cb of this.listeners) cb(msg)
  }

  onMessage(cb: MessageListener): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== cb)
    }
  }

  getMessages(): Message[] {
    if (!this._cachedMessages) {
      this._cachedMessages = [...this.messageStore.values()]
        .filter((m) => !m.destroyed)
        .sort((a, b) => a.timestamp - b.timestamp)
    }
    return this._cachedMessages
  }

  private invalidateCache(): void {
    this._cachedMessages = null
  }

  async loadFromStorage(messages: Message[]): Promise<void> {
    const toDestroy: Message[] = []
    const toKeep: Message[] = []

    for (const msg of messages) {
      if (shouldDestroy(msg)) {
        toDestroy.push(msg)
      } else {
        toKeep.push(msg)
        this.messageStore.set(msg.id, msg)
        this.scheduleBurn(msg)
      }
    }

    for (const msg of toDestroy) {
      await this.burn(msg)
    }

    this.invalidateCache()

    for (const msg of toKeep) {
      this.notifyListeners(msg)
    }
  }

  destroy(): void {
    stopNoiseGeneration()
    for (const timer of this.burnTimers.values()) {
      clearTimeout(timer)
    }
    this.burnTimers.clear()
    this.messageStore.clear()
    this.invalidateCache()
    this.listeners = []
    this.channel = null
    this.readChannel = null
    this.recallChannel = null
  }
}

export const messageManager = new MessageManager()
