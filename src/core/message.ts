import { peerManager, type Channel } from '../communication/peer'
import { saveMessage, markMessageRead, destroyMessage } from '../persistence/db'
import { generateMessageId } from '../utils/id'
import type { Message, BurnConfig } from './types'
import { shouldDestroy } from './burn'

export type MessageListener = (msg: Message) => void

export class MessageManager {
  private channel: Channel<Message> | null = null
  private listeners: MessageListener[] = []
  private messageStore = new Map<string, Message>()
  private burnTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private roomId: string = ''

  init(roomId: string): void {
    this.roomId = roomId
    this.channel = peerManager.makeChannel<Message>('messages')

    this.channel.onMessage(async (data, { peerId }) => {
      const msg: Message = {
        ...data,
        sender: peerId,
      }
      this.messageStore.set(msg.id, msg)
      await saveMessage({ ...msg, roomId: this.roomId })
      this.notifyListeners(msg)
      this.scheduleBurn(msg)
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
    this.notifyListeners(msg)
    this.scheduleBurn(msg)
    return msg
  }

  async markRead(msgId: string): Promise<void> {
    const msg = this.messageStore.get(msgId)
    if (!msg || msg.sender === peerManager.id) return

    if (!msg.readBy.includes(peerManager.id)) {
      msg.readBy.push(peerManager.id)
      await markMessageRead(msgId, peerManager.id)

      if (shouldDestroy(msg)) {
        await this.burn(msg)
      }

      this.notifyListeners(msg)
    }
  }

  private async burn(msg: Message): Promise<void> {
    msg.destroyed = true
    await destroyMessage(msg.id)
    this.messageStore.delete(msg.id)
    this.clearBurnTimer(msg.id)
    this.notifyListeners(msg)
  }

  private scheduleBurn(msg: Message): void {
    if (msg.destroyed || msg.burnMode === 'persist' || msg.burnMode === 'read_once') return

    const remaining = this.getRemainingMs(msg)
    if (remaining === Infinity || remaining <= 0) return

    const timer = setTimeout(() => {
      this.burn(msg)
    }, remaining)

    this.burnTimers.set(msg.id, timer)
  }

  private getRemainingMs(msg: Message): number {
    if (msg.burnMode === 'timed' && msg.burnAfter) {
      return Math.max(0, msg.burnAfter * 1000 - (Date.now() - msg.timestamp))
    }
    if (msg.burnMode === 'scheduled' && msg.burnAt) {
      return Math.max(0, msg.burnAt - Date.now())
    }
    return Infinity
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
    for (const msg of messages) {
      this.messageStore.set(msg.id, msg)
      if (!shouldDestroy(msg)) {
        this.scheduleBurn(msg)
      } else {
        await this.burn(msg)
      }
    }
    for (const msg of this.messageStore.values()) {
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
  }
}

export const messageManager = new MessageManager()
