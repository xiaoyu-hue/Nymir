import { joinRoom as joinTorrent } from '@trystero-p2p/torrent'
import { joinRoom as joinMqtt } from '@trystero-p2p/mqtt'
import type { Room, DataPayload } from '@trystero-p2p/core'
import { e2eeManager } from '../security/e2eeManager'

const APP_ID = 'nymir_treehole_v1'

export type PeerCallback = (peerId: string) => void
export type MessageCallback<T> = (data: T, info: { peerId: string }) => void

export interface Channel<T> {
  send: (data: T, target?: string) => void
  onMessage: (cb: MessageCallback<T>) => void
}

export type Strategy = 'torrent' | 'mqtt'

// E2EE 密钥交换 action
interface E2EEPayload {
  type: string
  publicKey: string
  [key: string]: string
}

export class PeerManager {
  private room: Room | null = null
  private peers = new Set<string>()
  private peerJoinCallbacks: PeerCallback[] = []
  private peerLeaveCallbacks: PeerCallback[] = []
  private currentStrategy: Strategy = 'torrent'
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private strategyFallbackTimer: ReturnType<typeof setTimeout> | null = null
  private e2eeChannel: Channel<E2EEPayload> | null = null

  get id(): string {
    return this.currentStrategy === 'torrent'
      ? (joinTorrent as unknown as { selfId: string }).selfId
      : (joinMqtt as unknown as { selfId: string }).selfId
  }

  get peerList(): string[] {
    return [...this.peers]
  }

  get connected(): boolean {
    return this.room !== null
  }

  get strategy(): Strategy {
    return this.currentStrategy
  }

  onPeerJoin(cb: PeerCallback): () => void {
    this.peerJoinCallbacks.push(cb)
    return () => {
      this.peerJoinCallbacks = this.peerJoinCallbacks.filter((fn) => fn !== cb)
    }
  }

  onPeerLeave(cb: PeerCallback): () => void {
    this.peerLeaveCallbacks.push(cb)
    return () => {
      this.peerLeaveCallbacks = this.peerLeaveCallbacks.filter((fn) => fn !== cb)
    }
  }

  private joinWithStrategy(roomId: string, strategy: Strategy): Room {
    const joinFn = strategy === 'torrent' ? joinTorrent : joinMqtt
    const room = joinFn({ appId: APP_ID }, roomId)

    room.onPeerJoin = (peerId: string) => {
      this.peers.add(peerId)

      // Cancel fallback timer if we got a peer
      if (this.strategyFallbackTimer) {
        clearTimeout(this.strategyFallbackTimer)
        this.strategyFallbackTimer = null
      }

      // 发送 E2EE 公钥给新 peer
      this.sendE2EEKey(peerId)

      for (const cb of this.peerJoinCallbacks) cb(peerId)
    }

    room.onPeerLeave = (peerId: string) => {
      this.peers.delete(peerId)
      e2eeManager.removePeerKey(peerId)
      for (const cb of this.peerLeaveCallbacks) cb(peerId)
    }

    return room
  }

  /**
   * 发送 E2EE 公钥给指定 peer
   */
  private sendE2EEKey(targetPeerId: string): void {
    if (!this.e2eeChannel) return
    const publicKey = e2eeManager.getOwnPublicKey()
    if (!publicKey) return

    this.e2eeChannel.send({ type: 'e2ee_key', publicKey }, targetPeerId)
  }

  /**
   * 广播 E2EE 公钥
   */
  private broadcastE2EEKey(): void {
    if (!this.e2eeChannel) return
    const publicKey = e2eeManager.getOwnPublicKey()
    if (!publicKey) return

    this.e2eeChannel.send({ type: 'e2ee_key', publicKey })
  }

  join(roomId: string): void {
    if (this.room) this.leave()

    this.currentStrategy = 'torrent'
    this.room = this.joinWithStrategy(roomId, 'torrent')

    // 设置 E2EE 密钥交换通道
    this.e2eeChannel = this.makeChannel<E2EEPayload>('e2ee-exchange')
    this.e2eeChannel.onMessage(async (data, { peerId }) => {
      if (data.type === 'e2ee_key') {
        await e2eeManager.handlePeerPublicKey(peerId, data.publicKey)
      }
    })

    // 广播自己的公钥
    setTimeout(() => this.broadcastE2EEKey(), 100)

    // Fallback to MQTT if no peers found within 5 seconds
    this.strategyFallbackTimer = setTimeout(() => {
      if (this.peers.size === 0 && this.room) {
        console.log('[Nymir] BitTorrent signaling slow, falling back to MQTT')
        this.room.leave()
        this.currentStrategy = 'mqtt'
        this.room = this.joinWithStrategy(roomId, 'mqtt')

        // 重新设置 E2EE 通道
        this.e2eeChannel = this.makeChannel<E2EEPayload>('e2ee-exchange')
        this.e2eeChannel.onMessage(async (data, { peerId }) => {
          if (data.type === 'e2ee_key') {
            await e2eeManager.handlePeerPublicKey(peerId, data.publicKey)
          }
        })
        setTimeout(() => this.broadcastE2EEKey(), 100)
      }
    }, 5000)
  }

  reconnect(roomId: string): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }
    this.reconnectTimer = setTimeout(() => {
      console.log('[Nymir] Reconnecting...')
      this.join(roomId)
    }, 2000)
  }

  makeChannel<T extends DataPayload>(namespace: string): Channel<T> {
    if (!this.room) throw new Error('Not connected to a room')

    const action = this.room.makeAction<T>(namespace)

    return {
      send: (data: T, target?: string) => {
        action.send(data, target ? { target } : undefined)
      },
      onMessage: (cb: MessageCallback<T>) => {
        action.onMessage = (data: T, ctx: { peerId: string }) => cb(data, ctx)
      },
    }
  }

  leave(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.strategyFallbackTimer) {
      clearTimeout(this.strategyFallbackTimer)
      this.strategyFallbackTimer = null
    }
    if (this.room) {
      this.room.leave()
      this.room = null
      this.peers.clear()
    }
    this.e2eeChannel = null
    e2eeManager.clearAll()
  }
}

export const peerManager = new PeerManager()
