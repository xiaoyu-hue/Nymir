import { peerManager } from '../communication/peer'
import { connectionMonitor } from '../communication/monitor'
import { saveRoom, getAllRooms, deleteRoom as dbDeleteRoom, getMessagesByRoom, getRoom } from '../persistence/db'
import { generateRoomId, isValidRoomId } from '../utils/id'
import { messageManager } from './message'
import { clearLocalStorage } from '../security/secureDelete'
import type { RoomInfo, BurnMode } from './types'
import type { StoredMessage } from '../persistence/types'
import { log } from '../utils/logger'
import { RECONNECT_BASE_DELAY_MS, RECONNECT_MAX_DELAY_MS, RECONNECT_MAX_ATTEMPTS } from '../constants'

export type RoomListener = (event: string, data?: unknown) => void
export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

export class RoomManager {
  private currentRoom: RoomInfo | null = null
  private listeners: RoomListener[] = []
  private unsubs: (() => void)[] = []
  private connectionStatus: ConnectionStatus = 'disconnected'
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0

  get room(): RoomInfo | null {
    return this.currentRoom
  }

  get inRoom(): boolean {
    return this.currentRoom !== null
  }

  get status(): ConnectionStatus {
    return this.connectionStatus
  }

  onEvent(cb: RoomListener): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== cb)
    }
  }

  private emit(event: string, data?: unknown): void {
    for (const cb of this.listeners) cb(event, data)
  }

  private setStatus(s: ConnectionStatus): void {
    this.connectionStatus = s
    this.emit('status:change', s)
  }

  async createRoom(name: string): Promise<RoomInfo> {
    const maxRetries = 5
    let id = ''
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      id = generateRoomId()
      const existing = await getRoom(id)
      if (!existing) break
      if (attempt === maxRetries - 1) {
        throw new Error('Failed to generate unique room ID')
      }
    }
    const room: RoomInfo = {
      id,
      name,
      createdAt: Date.now(),
      peers: [],
    }
    await saveRoom({ id, name, createdAt: room.createdAt })
    await this.joinRoom(id, name)
    return room
  }

  async joinRoom(roomId: string, roomName?: string): Promise<void> {
    if (!isValidRoomId(roomId)) {
      throw new Error('Invalid room code format')
    }
    if (this.currentRoom) this.leaveRoom()

    const existing = await getRoom(roomId)
    // isCreator: 调用方显式传入了房间名（createRoom 路径），视为房间创建者
    const isCreator = typeof roomName === 'string' && roomName.trim().length > 0

    this.currentRoom = {
      id: roomId,
      name: roomName || existing?.name || roomId,
      createdAt: existing?.createdAt || Date.now(),
      peers: [],
    }

    if (!existing) {
      await saveRoom({
        id: roomId,
        name: this.currentRoom.name,
        createdAt: this.currentRoom.createdAt,
      })
    }

    this.reconnectAttempts = 0
    peerManager.join(roomId)
    messageManager.init(roomId)
    connectionMonitor.start()
    this.setStatus('connected')

    const unsubJoin = peerManager.onPeerJoin((peerId) => {
      if (this.currentRoom) {
        this.currentRoom.peers = peerManager.peerList
        this.reconnectAttempts = 0
        this.setStatus('connected')
        this.emit('peer:join', peerId)
        // 重发离线队列中的消息
        messageManager.retryOfflineMessages()

        // 房间名字同步：
        // - 创建者：有 peer 加入时广播自己的房间名
        // - 加入者：有 peer 加入时请求房间名（若本地仍是占位的 roomId）
        if (isCreator) {
          peerManager.broadcastRoomName(this.currentRoom.name)
        } else if (this.currentRoom.name === this.currentRoom.id) {
          peerManager.requestRoomName()
        }
      }
    })

    const unsubLeave = peerManager.onPeerLeave((peerId) => {
      if (this.currentRoom) {
        this.currentRoom.peers = peerManager.peerList
        this.emit('peer:leave', peerId)
        if (this.currentRoom.peers.length === 0) {
          this.attemptReconnect()
        }
      }
    })

    // 对端公钥到达后重试因缺密钥而入队的消息
    const unsubPeerKey = peerManager.onPeerKey(() => {
      messageManager.retryOfflineMessages()
    })

    // 房间名字同步：接收对端广播/请求
    const unsubRoomName = peerManager.onRoomName((name, _peerId) => {
      if (!this.currentRoom) return

      // name 为空字符串表示对端在请求房间名字（room_name_request）
      if (!name) {
        // 仅当自己持有非占位的房间名时才回复，避免把 roomId 传播出去
        if (this.currentRoom.name !== this.currentRoom.id) {
          peerManager.broadcastRoomName(this.currentRoom.name)
        }
        return
      }

      // 收到对端广播的房间名：
      // 仅当本地仍是占位名（=== roomId）时才采用，不覆盖用户已自定义的名字
      if (this.currentRoom.name === this.currentRoom.id && name !== this.currentRoom.id) {
        this.updateRoomName(name)
      }
    })

    // 传输策略切换（MQTT ↔ torrent）后重建底层 room，同步 peers 并通知 UI
    const unsubRoomRebuilt = peerManager.onRoomRebuilt(() => {
      if (this.currentRoom) {
        this.currentRoom.peers = peerManager.peerList
        this.emit('room:rebuilt')
      }
    })

    this.unsubs.push(unsubJoin, unsubLeave, unsubPeerKey, unsubRoomName, unsubRoomRebuilt)

    const saved = await getMessagesByRoom(roomId)
    const messages = saved.map((s: StoredMessage) => ({
      id: s.id,
      content: s.content,
      sender: s.sender,
      timestamp: s.timestamp,
      burnMode: s.burnMode as BurnMode,
      readBy: s.readBy ?? [],
      destroyed: s.destroyed,
      decryptFailed: s.decryptFailed,
      verified: s.verified,
    }))
    await messageManager.loadFromStorage(messages)
    this.emit('room:joined', roomId)
  }

  /**
   * 更新当前房间名字，并持久化到 IndexedDB，通知 UI 刷新
   */
  private async updateRoomName(name: string): Promise<void> {
    if (!this.currentRoom) return
    const trimmed = name.trim()
    if (!trimmed || trimmed === this.currentRoom.name) return

    this.currentRoom.name = trimmed
    try {
      await saveRoom({
        id: this.currentRoom.id,
        name: trimmed,
        createdAt: this.currentRoom.createdAt,
      })
    } catch (err) {
      log('[Room] Failed to persist room name:', err)
    }
    this.emit('room:name-change', trimmed)
  }

  private attemptReconnect(): void {
    if (this.reconnectTimer || !this.currentRoom) return
    this.reconnectAttempts++
    if (this.reconnectAttempts > RECONNECT_MAX_ATTEMPTS) {
      this.setStatus('disconnected')
      this.emit('reconnect:failed')
      return
    }
    this.setStatus('reconnecting')
    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1),
      RECONNECT_MAX_DELAY_MS,
    )
    log(`[Room] Reconnect attempt ${this.reconnectAttempts}/${RECONNECT_MAX_ATTEMPTS} in ${delay}ms`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.currentRoom) {
        peerManager.join(this.currentRoom.id)
      }
    }, delay)
  }

  leaveRoom(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    for (const unsub of this.unsubs) unsub()
    this.unsubs = []
    messageManager.destroy()
    peerManager.leave()
    connectionMonitor.stop()
    this.currentRoom = null
    this.reconnectAttempts = 0
    this.setStatus('disconnected')
    this.emit('room:left')
  }

  async getSavedRooms(): Promise<RoomInfo[]> {
    const rooms = await getAllRooms()
    return rooms.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      peers: [],
    }))
  }

  async deleteSavedRoom(id: string): Promise<void> {
    await dbDeleteRoom(id)
  }

  async secureReset(): Promise<void> {
    this.leaveRoom()
    clearLocalStorage('nymir')
  }
}

export const roomManager = new RoomManager()
