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

    this.currentRoom = {
      id: roomId,
      name: roomName ?? roomId,
      createdAt: Date.now(),
      peers: [],
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

    this.unsubs.push(unsubJoin, unsubLeave)

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
