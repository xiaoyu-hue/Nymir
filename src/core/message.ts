import { peerManager, type Channel } from '../communication/peer'
import { offlineQueue } from '../communication/offlineQueue'
import { saveMessage, markMessageRead, destroyMessage } from '../persistence/db'
import { e2eeManager } from '../security/e2eeManager'
import { isNoiseMessage, startNoiseGeneration, stopNoiseGeneration } from '../security/noise'
import { generateMessageId } from '../utils/id'
import { log, warn, error } from '../utils/logger'
import { BurnMode, type Message, type BurnConfig, type AnyPayload } from './types'
import { shouldDestroy, getRemainingMs } from './burn'
import { READ_ONCE_AUTO_DESTROY_MS } from '../constants'

/** 签名协议版本：2 = encrypt-then-sign（对密文签名）。旧消息无此字段或值≠2 一律验签失败。 */
export const MESSAGE_SIG_VERSION = 2

/** 合法 burnMode 枚举（防御：拒绝构造值打乱排序/绕过阅读即焚） */
const VALID_BURN_MODES = new Set<string>(Object.values(BurnMode))

export type MessageListener = (msg: Message) => void

function logError(context: string, err: unknown, extra?: Record<string, unknown>): void {
  const msg = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined
  error(`[Message] ${context}: ${msg}`, { ...extra, stack })
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
  private unsubRoomRebuilt: (() => void) | null = null

  init(roomId: string): void {
    this.roomId = roomId
    this.bindChannels()

    // 传输策略切换会重建底层 room，必须重绑业务 channel，否则收不到实时消息
    this.unsubRoomRebuilt?.()
    this.unsubRoomRebuilt = peerManager.onRoomRebuilt(() => {
      log('[Message] Room rebuilt — rebinding channels')
      this.bindChannels()
    })
  }

  /** 在当前 peer room 上绑定 messages/read/recall 通道 */
  private bindChannels(): void {
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

    startNoiseGeneration((noise) => {
      this.channel?.send(noise)
    })
  }

  private async handleIncomingMessage(data: AnyPayload, peerId: string): Promise<void> {
    if (isNoiseMessage(data)) return

    if (!data.id || typeof data.timestamp !== 'number' || !Number.isFinite(data.timestamp)) {
      warn('[Message] Ignoring malformed payload:', {
        peerId,
        hasId: !!data.id,
        timestampType: typeof data.timestamp,
      })
      return
    }
    if (typeof data.burnMode !== 'string' || !VALID_BURN_MODES.has(data.burnMode)) {
      warn('[Message] Ignoring payload with invalid burnMode:', {
        peerId,
        msgId: data.id,
        burnMode: data.burnMode,
      })
      return
    }

    let content = ''
    let decryptFailed = false
    let verified: boolean | undefined = undefined

    const sigVersionOk = data.sig === MESSAGE_SIG_VERSION
    if (!data.signature || !sigVersionOk) {
      verified = false
      if (data.signature && !sigVersionOk) {
        warn('[Message] Rejected legacy/unsupported signature version:', {
          roomId: this.roomId,
          msgId: data.id,
          peerId,
          sig: data.sig,
        })
      }
    } else {
      try {
        const valid = await e2eeManager.verify(data.content, data.signature, peerId)
        verified = valid
        if (!valid) {
          warn('[Message] Signature verification failed (ciphertext):', {
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

    // encrypt-then-sign 契约：sig===2 的载荷必须携带加密内容。
    // encrypted=false 时签名只能是对明文（sign-then-encrypt 旧方式），
    // 接受它会重新打开字典攻击路径，因此一律视为验签失败。
    if (verified === true && !data.encrypted) {
      verified = false
      warn('[Message] Rejected plaintext payload with valid signature (encrypt-then-sign violated):', {
        roomId: this.roomId,
        msgId: data.id,
        peerId,
      })
    }

    if (verified === false) {
      const failedMsg: Message = {
        id: data.id,
        content: '',
        sender: peerId,
        timestamp: data.timestamp,
        burnMode: data.burnMode as BurnMode,
        burnAfter: data.burnAfter,
        burnAt: data.burnAt,
        readBy: [],
        destroyed: false,
        verified: false,
      }
      this.messageStore.set(failedMsg.id, failedMsg)
      this.invalidateCache()
      try {
        await saveMessage({ ...failedMsg, roomId: this.roomId })
      } catch (err) {
        logError('saveMessage (verifyFailed) error', err, {
          roomId: this.roomId,
          msgId: data.id,
        })
      }
      this.notifyListeners(failedMsg)
      return
    }

    if (data.encrypted) {
      try {
        const decrypted = await e2eeManager.decrypt(data.content, peerId, data.id)
        if (decrypted) {
          content = decrypted
        } else {
          decryptFailed = true
          content = ''
          warn('[Message] Decrypt failed, not saving as readable:', {
            roomId: this.roomId,
            msgId: data.id,
            peerId,
          })
        }
      } catch (err) {
        decryptFailed = true
        content = ''
        logError('Decrypt error', err, {
          roomId: this.roomId,
          msgId: data.id,
          peerId,
        })
      }
    } else {
      content = data.content
    }

    if (decryptFailed) {
      const failedMsg: Message = {
        id: data.id,
        content: '',
        sender: peerId,
        timestamp: data.timestamp,
        burnMode: data.burnMode as BurnMode,
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
      burnMode: data.burnMode as BurnMode,
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

  async send(content: string, burn: BurnConfig): Promise<Message> {
    if (!this.channel) throw new Error('MessageManager not initialized')
    if (content.length > 10000) throw new Error('Message too long (max 10000 chars)')

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
      const peerList = peerManager.peerList

      if (peerList.length > 0) {
        let delivered = 0
        for (const peerId of peerList) {
          try {
            const encrypted = await e2eeManager.encrypt(content, peerId, msg.id)
            if (!encrypted) {
              warn('[Message] Encrypt returned null (no peer key?), will queue if none delivered')
              continue
            }
            const signature = await e2eeManager.sign(encrypted)
            const payload: AnyPayload = {
              ...msg,
              content: encrypted,
              encrypted: true,
              sig: MESSAGE_SIG_VERSION,
            }
            if (signature) {
              payload.signature = signature
            }
            this.channel.send(payload, peerId)
            delivered++
          } catch (err) {
            logError('Per-peer encrypt/send failed', err, {
              roomId: this.roomId,
              msgId: msg.id,
              peerId,
            })
          }
        }
        if (delivered > 0) {
          e2eeManager.recordMessageSent()
        } else {
          // 入队仅存元数据，绝不携带明文 content（离线队列持久化到 localStorage）
          offlineQueue.enqueue(msg.id, this.roomId, {}, [])
          log(`[Message] Peers present but encrypt failed, queued ${msg.id}`)
        }
      } else {
        offlineQueue.enqueue(msg.id, this.roomId, {}, [])
        log(`[Message] No peers, queued message ${msg.id}`)
      }

      this.messageStore.set(msg.id, msg)
      this.invalidateCache()
      try {
        await saveMessage({ ...msg, roomId: this.roomId })
      } catch (err) {
        logError('saveMessage (send) error', err, { roomId: this.roomId, msgId: msg.id })
      }
      this.scheduleBurn(msg)
      this.notifyListeners(msg)
      return msg
    } catch (err) {
      logError('send() unrecoverable error', err, { roomId: this.roomId, msgId: msg.id })
      throw err
    }
  }

  async retryOfflineMessages(): Promise<void> {
    if (!this.channel) return

    const pending = offlineQueue.getPending(this.roomId)
    if (pending.length === 0) return

    const peerList = peerManager.peerList
    if (peerList.length === 0) return

    for (const queued of pending) {
      const msg = this.messageStore.get(queued.id)
      if (!msg || msg.destroyed) {
        offlineQueue.markDelivered(queued.id)
        continue
      }

      try {
        for (const peerId of peerList) {
          try {
            const encrypted = await e2eeManager.encrypt(msg.content, peerId, msg.id)
            if (!encrypted) continue

            const signature = await e2eeManager.sign(encrypted)
            const payload: AnyPayload = {
              ...msg,
              content: encrypted,
              encrypted: true,
              sig: MESSAGE_SIG_VERSION,
            }
            if (signature) payload.signature = signature

            this.channel.send(payload, peerId)
          } catch (err) {
            logError('Retry send failed', err, { msgId: msg.id, peerId })
          }
        }
        offlineQueue.markSent(queued.id)
      } catch (err) {
        logError('Retry batch failed', err, { msgId: queued.id })
        offlineQueue.markFailed(queued.id)
      }
    }
  }

  async recall(msgId: string): Promise<boolean> {
    const msg = this.messageStore.get(msgId)
    if (!msg || msg.sender !== peerManager.id) return false
    this.recallChannel?.send({ type: 'recall', msgId, peerId: peerManager.id })
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
      logError('destroyMessage error (idempotent)', err, {
        roomId: this.roomId,
        msgId: msg.id,
      })
    }
    this.notifyListeners(msg)
  }

  private scheduleBurn(msg: Message): void {
    if (msg.destroyed || msg.burnMode === 'persist') return

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
    this.unsubRoomRebuilt?.()
    this.unsubRoomRebuilt = null
    this.channel = null
    this.readChannel = null
    this.recallChannel = null
  }
}

export const messageManager = new MessageManager()
