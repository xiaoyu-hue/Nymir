import { peerManager, type Channel } from '../communication/peer'
import { saveMessage, markMessageRead, destroyMessage } from '../persistence/db'
import { generateMessageId } from '../utils/id'
import type { Message, BurnConfig } from './types'
import { shouldDestroy, getRemainingMs } from './burn'

export type MessageListener = (msg: Message) => void
type ReadReceipt = { type: 'read'; msgId: string; peerId: string }
type RecallEvent = { type: 'recall'; msgId: string }

const READ_ONCE_AUTO_DESTROY_MS = 30 * 60 * 1000 // 30 minutes safety net

export class MessageManager {
  private channel: Channel<Message> | null = null
  private readChannel: Channel<ReadReceipt> | null = null
  private recallChannel: Channel<RecallEvent> | null = null
  private listeners: MessageListener[] = []
  private messageStore = new Map<string, Message>()
  private burnTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private roomId: string = ''

  init(roomId: string): void {
    this.roomId = roomId
    this.channel = peerManager.makeChannel<Message>('messages')
    this.readChannel = peerManager.makeChannel<ReadReceipt>('read-receipts')
    this.recallChannel = peerManager.makeChannel<RecallEvent>('recall')

    this.channel.onMessage(async (data, { peerId }) => {
      const msg: Message = {
        ...data,
        sender: peerId,
      }
      this.messageStore.set(msg.id, msg)
      await saveMessage({ ...msg, roomId: this.roomId })
      this.scheduleBurn(msg)
      this.notifyListeners(msg)
    })

    this.readChannel.onMessage(async (data) => {
      if (data.type === 'read') {
        const msg = this.messageStore.get(data.msgId)
        if (msg && !msg.readBy.includes(data.peerId)) {
          msg.readBy.push(data.peerId)
          await markMessageRead(data.msgId, data.peerId)
          this.notifyListeners(msg)
        }
      }
    })

    this.recallChannel.onMessage(async (data) => {
      if (data.type === 'recall') {
        const msg = this.messageStore.get(data.msgId)
        if (msg) {
          await this.burn(msg)
        }
      }
    })
  }

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

    this.messageStore.set(msg.id, msg)
    await saveMessage({ ...msg, roomId: this.roomId })
    this.channel.send(msg)
    this.scheduleBurn(msg)
    this.notifyListeners(msg)
    return msg
  }

  async recall(msgId: string): Promise<boolean> {
    const msg = this.messageStore.get(msgId)
    if (!msg || msg.sender !== peerManager.id) return false

    // Broadcast recall to peers
    this.recallChannel?.send({ type: 'recall', msgId })

    // Destroy locally
    await this.burn(msg)
    return true
  }

  async markRead(msgId: string): Promise<void> {
    const msg = this.messageStore.get(msgId)
    if (!msg || msg.sender === peerManager.id) return

    if (!msg.readBy.includes(peerManager.id)) {
      msg.readBy.push(peerManager.id)
      await markMessageRead(msgId, peerManager.id)

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
    await destroyMessage(msg.id)
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
    return [...this.messageStore.values()]
      .filter((m) => !m.destroyed)
      .sort((a, b) => a.timestamp - b.timestamp)
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

    for (const msg of toKeep) {
      this.notifyListeners(msg)
    }
  }

  destroy(): void {
    for (const timer of this.burnTimers.values()) {
      clearTimeout(timer)
    }
    this.burnTimers.clear()
    this.messageStore.clear()
    this.listeners = []
    this.channel = null
    this.readChannel = null
    this.recallChannel = null
  }
}

export const messageManager = new MessageManager()
