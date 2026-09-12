import { joinRoom as joinTorrent, selfId as torrentSelfId } from '@trystero-p2p/torrent'
import { joinRoom as joinMqtt, selfId as mqttSelfId } from '@trystero-p2p/mqtt'
import type { Room, DataPayload } from '@trystero-p2p/core'
import { e2eeManager } from '../security/e2eeManager'
import { connectionMonitor } from './monitor'
import { log } from '../utils/logger'
import { STRATEGY_FALLBACK_MS } from '../constants'

const APP_ID = 'nymir_treehole_v1'

export type PeerCallback = (peerId: string) => void
export type MessageCallback<T> = (data: T, info: { peerId: string }) => void
export type RoomNameCallback = (name: string, peerId: string) => void

export interface Channel<T> {
  send: (data: T, target?: string) => void
  /** 注册消息回调，返回退订函数（重复绑定/重建时用于清理旧 handler） */
  onMessage: (cb: MessageCallback<T>) => () => void
}

export type Strategy = 'torrent' | 'mqtt'

interface E2EEPayload {
  type: string
  publicKey: string
  signPublicKey: string
  [key: string]: string
}

interface RoomMetaPayload {
  type: 'room_name' | 'room_name_request'
  name: string
  [key: string]: string
}

export class PeerManager {
  private room: Room | null = null
  private peers = new Set<string>()
  private peerJoinCallbacks: PeerCallback[] = []
  private peerLeaveCallbacks: PeerCallback[] = []
  private roomRebuiltCallbacks: (() => void)[] = []
  private peerKeyCallbacks: PeerCallback[] = []
  private roomNameCallbacks: RoomNameCallback[] = []
  private currentStrategy: Strategy = 'mqtt'
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private strategyFallbackTimer: ReturnType<typeof setTimeout> | null = null
  private e2eeChannel: Channel<E2EEPayload> | null = null
  private roomMetaChannel: Channel<RoomMetaPayload> | null = null
  private isSwitchingStrategy = false

  get id(): string {
    // selfId 是 @trystero-p2p/core 模块加载时生成的常量，
    // mqtt 和 torrent 包都重新导出同一个 selfId，二者值相同。
    return this.currentStrategy === 'torrent' ? torrentSelfId : mqttSelfId
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

  onRoomRebuilt(cb: () => void): () => void {
    this.roomRebuiltCallbacks.push(cb)
    return () => {
      this.roomRebuiltCallbacks = this.roomRebuiltCallbacks.filter((fn) => fn !== cb)
    }
  }

  onPeerKey(cb: PeerCallback): () => void {
    this.peerKeyCallbacks.push(cb)
    return () => {
      this.peerKeyCallbacks = this.peerKeyCallbacks.filter((fn) => fn !== cb)
    }
  }

  /**
   * 监听对端广播的房间名字
   */
  onRoomName(cb: RoomNameCallback): () => void {
    this.roomNameCallbacks.push(cb)
    return () => {
      this.roomNameCallbacks = this.roomNameCallbacks.filter((fn) => fn !== cb)
    }
  }

  /**
   * 向房间内所有 peer 广播房间名字
   */
  broadcastRoomName(name: string): void {
    if (!this.roomMetaChannel) return
    this.roomMetaChannel.send({ type: 'room_name', name })
  }

  /**
   * 向房间内请求房间名字（新加入者使用）
   */
  requestRoomName(): void {
    if (!this.roomMetaChannel) return
    this.roomMetaChannel.send({ type: 'room_name_request', name: '' })
  }

  private joinWithStrategy(roomId: string, strategy: Strategy): Room {
    const joinFn = strategy === 'torrent' ? joinTorrent : joinMqtt
    // 国内可用的公共 STUN（trystero 默认用 Google STUN，在大陆网络下不通）。
    // 这些地址来自多源交叉验证（小米/B站/腾讯），仅用于 NAT 穿透，不中转数据。
    const room = joinFn(
      {
        appId: APP_ID,
        rtcConfig: {
          iceServers: [
            { urls: 'stun:stun.miwifi.com:3478' },
            { urls: 'stun:stun.chat.bilibili.com:3478' },
            { urls: 'stun:stun.qq.com:3478' },
            { urls: 'stun:stun.cloudflare.com:3478' },
          ],
        },
      },
      roomId,
    )
    room.onPeerJoin = (peerId: string) => {
      this.peers.add(peerId)
      connectionMonitor.setPeerCount(this.peers.size)
      if (this.strategyFallbackTimer) {
        clearTimeout(this.strategyFallbackTimer)
        this.strategyFallbackTimer = null
      }
      this.sendE2EEKey(peerId)
      for (const cb of this.peerJoinCallbacks) cb(peerId)
    }
    room.onPeerLeave = (peerId: string) => {
      this.peers.delete(peerId)
      connectionMonitor.setPeerCount(this.peers.size)
      e2eeManager.removePeerKey(peerId)
      for (const cb of this.peerLeaveCallbacks) cb(peerId)
    }
    return room
  }

  private sendE2EEKey(targetPeerId: string): void {
    if (!this.e2eeChannel) return
    const publicKey = e2eeManager.getOwnPublicKey()
    const signPublicKey = e2eeManager.getOwnSignPublicKey()
    if (!publicKey || !signPublicKey) return
    this.e2eeChannel.send({ type: 'e2ee_key', publicKey, signPublicKey }, targetPeerId)
  }

  private broadcastE2EEKey(): void {
    if (!this.e2eeChannel) return
    const publicKey = e2eeManager.getOwnPublicKey()
    const signPublicKey = e2eeManager.getOwnSignPublicKey()
    if (!publicKey || !signPublicKey) return
    this.e2eeChannel.send({ type: 'e2ee_key', publicKey, signPublicKey })
  }

  private setupE2EEChannel(): void {
    this.e2eeChannel = this.makeChannel<E2EEPayload>('e2ee-exchange')
    this.e2eeChannel.onMessage(async (data, { peerId }) => {
      if (data.type === 'e2ee_key') {
        await e2eeManager.handlePeerPublicKey(peerId, data.publicKey, data.signPublicKey)
        for (const cb of this.peerKeyCallbacks) cb(peerId)
      }
    })
  }

  /**
   * 设置房间元数据通道，用于同步房间名字等元信息
   */
  private setupRoomMetaChannel(): void {
    this.roomMetaChannel = this.makeChannel<RoomMetaPayload>('room-meta')
    this.roomMetaChannel.onMessage((data, { peerId }) => {
      if (data.type === 'room_name' && typeof data.name === 'string' && data.name.trim()) {
        for (const cb of this.roomNameCallbacks) cb(data.name, peerId)
      } else if (data.type === 'room_name_request') {
        // 对端请求房间名字，由 RoomManager 决定是否回复（在 RoomManager 中处理）
        for (const cb of this.roomNameCallbacks) cb('', peerId)
      }
    })
  }

  join(roomId: string): void {
    if (this.room) this.leave()
    // 默认走 MQTT：移动网络上 WebTorrent tracker 常被干扰；MQTT 公共 broker 更稳
    this.currentStrategy = 'mqtt'
    this.room = this.joinWithStrategy(roomId, 'mqtt')
    this.setupE2EEChannel()
    this.setupRoomMetaChannel()
    connectionMonitor.start()
    connectionMonitor.setPeerCount(this.peers.size)
    connectionMonitor.setChannel(this.makeChannel('__monitor__'))
    setTimeout(() => this.broadcastE2EEKey(), 100)
    // 若一段时间仍发现不了对端，再降级尝试 torrent
    this.strategyFallbackTimer = setTimeout(() => {
      if (this.peers.size === 0 && this.room) {
        this.switchStrategy(roomId, 'torrent')
      }
    }, STRATEGY_FALLBACK_MS)
  }

  private switchStrategy(roomId: string, newStrategy: Strategy): void {
    if (this.isSwitchingStrategy) return
    this.isSwitchingStrategy = true
    try {
      log(`[Nymir] Switching from ${this.currentStrategy} to ${newStrategy}`)
      if (this.strategyFallbackTimer) {
        clearTimeout(this.strategyFallbackTimer)
        this.strategyFallbackTimer = null
      }
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
      }
      if (this.room) {
        this.room.leave()
        this.room = null
      }
      this.peers.clear()
      this.e2eeChannel = null
      this.roomMetaChannel = null
      e2eeManager.clearAll()
      this.currentStrategy = newStrategy
      this.room = this.joinWithStrategy(roomId, newStrategy)
      this.setupE2EEChannel()
      this.setupRoomMetaChannel()
      connectionMonitor.setChannel(this.makeChannel('__monitor__'))
      connectionMonitor.setPeerCount(this.peers.size)
      for (const cb of this.roomRebuiltCallbacks) cb()
      setTimeout(() => this.broadcastE2EEKey(), 100)
    } finally {
      this.isSwitchingStrategy = false
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
        // 返回退订：将回调置空（trystero onMessage 为可空属性），
        // 防止同一 action / 重建场景下旧 handler 残留。
        return () => {
          action.onMessage = null
        }
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
    this.roomMetaChannel = null
    connectionMonitor.stop()
    e2eeManager.clearAll()
  }
}

export const peerManager = new PeerManager()
