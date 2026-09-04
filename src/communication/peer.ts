import { joinRoom, selfId } from '@trystero-p2p/torrent'
import type { Room, DataPayload } from '@trystero-p2p/core'

const APP_ID = 'nymir_treehole_v1'

export type PeerCallback = (peerId: string) => void
export type MessageCallback<T> = (data: T, info: { peerId: string }) => void

export interface Channel<T> {
  send: (data: T, target?: string) => void
  onMessage: (cb: MessageCallback<T>) => void
}

export class PeerManager {
  private room: Room | null = null
  private peers = new Set<string>()
  private peerJoinCallbacks: PeerCallback[] = []
  private peerLeaveCallbacks: PeerCallback[] = []

  get id(): string {
    return selfId
  }

  get peerList(): string[] {
    return [...this.peers]
  }

  get connected(): boolean {
    return this.room !== null
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

  join(roomId: string): void {
    if (this.room) this.leave()

    this.room = joinRoom({ appId: APP_ID }, roomId)

    this.room.onPeerJoin = (peerId: string) => {
      this.peers.add(peerId)
      for (const cb of this.peerJoinCallbacks) cb(peerId)
    }

    this.room.onPeerLeave = (peerId: string) => {
      this.peers.delete(peerId)
      for (const cb of this.peerLeaveCallbacks) cb(peerId)
    }
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
    if (this.room) {
      this.room.leave()
      this.room = null
      this.peers.clear()
    }
  }
}

export const peerManager = new PeerManager()
