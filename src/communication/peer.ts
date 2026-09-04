import { joinRoom as joinTorrent, selfId as selfIdTorrent } from '@trystero-p2p/torrent'
import { joinRoom as joinMqtt, selfId as selfIdMqtt } from '@trystero-p2p/mqtt'
import type { Room, DataPayload } from '@trystero-p2p/core'

const APP_ID = 'nymir_treehole_v1'

export type PeerCallback = (peerId: string) => void
export type MessageCallback<T> = (data: T, info: { peerId: string }) => void

export interface Channel<T> {
  send: (data: T, target?: string) => void
  onMessage: (cb: MessageCallback<T>) => void
}

export type Strategy = 'torrent' | 'mqtt'

export class PeerManager {
  private room: Room | null = null
  private peers = new Set<string>()
  private peerJoinCallbacks: PeerCallback[] = []
  private peerLeaveCallbacks: PeerCallback[] = []
  private currentStrategy: Strategy = 'torrent'
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private strategyFallbackTimer: ReturnType<typeof setTimeout> | null = null

  get id(): string {
    return this.currentStrategy === 'torrent' ? selfIdTorrent : selfIdMqtt
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
      if (this.strategyFallbackTimer) {
        clearTimeout(this.strategyFallbackTimer)
        this.strategyFallbackTimer = null
      }
      for (const cb of this.peerJoinCallbacks) cb(peerId)
    }

    room.onPeerLeave = (peerId: string) => {
      this.peers.delete(peerId)
      for (const cb of this.peerLeaveCallbacks) cb(peerId)
    }

    return room
  }

  join(roomId: string): void {
    if (this.room) this.leave()

    this.currentStrategy = 'torrent'
    this.room = this.joinWithStrategy(roomId, 'torrent')

    // Fallback to MQTT if no peers found within 5 seconds
    this.strategyFallbackTimer = setTimeout(() => {
      if (this.peers.size === 0 && this.room) {
        console.log('[Nymir] BitTorrent signaling slow, falling back to MQTT')
        this.room.leave()
        this.currentStrategy = 'mqtt'
        this.room = this.joinWithStrategy(roomId, 'mqtt')
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
  }
}

export const peerManager = new PeerManager()
