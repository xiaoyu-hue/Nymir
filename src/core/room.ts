import { peerManager } from '../communication/peer'
import { saveRoom, getAllRooms, deleteRoom as dbDeleteRoom, getMessagesByRoom } from '../persistence/db'
import { generateRoomId } from '../utils/id'
import { messageManager } from './message'
import type { RoomInfo } from './types'
import type { StoredMessage } from '../persistence/types'

export type RoomListener = (event: string, data?: unknown) => void

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

export class RoomManager {
  private currentRoom: RoomInfo | null = null
  private listeners: RoomListener[] = []
  private unsubs: (() => void)[] = []
  private connectionStatus: ConnectionStatus = 'disconnected'
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private roomId: string = ''

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
    const id = generateRoomId()
    const room: RoomInfo = {
      id,
      name,
      createdAt: Date.now(),
      peers: [],
    }

    await saveRoom({ id, name, createdAt: room.createdAt })
    await this.joinRoom(id)
    return room
  }

  async joinRoom(roomId: string): Promise<void> {
    if (this.currentRoom) this.leaveRoom()

    this.roomId = roomId
    peerManager.join(roomId)
    messageManager.init(roomId)

    this.currentRoom = {
      id: roomId,
      name: roomId,
      createdAt: Date.now(),
      peers: [],
    }

    this.setStatus('connected')

    const unsubJoin = peerManager.onPeerJoin((peerId) => {
      if (this.currentRoom) {
        this.currentRoom.peers = peerManager.peerList
        this.setStatus('connected')
        this.emit('peer:join', peerId)
      }
    })

    const unsubLeave = peerManager.onPeerLeave((peerId) => {
      if (this.currentRoom) {
        this.currentRoom.peers = peerManager.peerList
        this.emit('peer:leave', peerId)

        // If all peers left, start reconnecting
        if (this.currentRoom.peers.length === 0) {
          this.attemptReconnect()
        }
      }
    })

    this.unsubs.push(unsubJoin, unsubLeave)

    // Load saved messages
    const saved = await getMessagesByRoom(roomId)
    const messages: Message[] = saved.map((s: StoredMessage) => ({
      id: s.id,
      content: s.content,
      sender: s.sender,
      timestamp: s.timestamp,
      burnMode: s.burnMode as Message['burnMode'],
      burnAfter: s.burnAfter,
      burnAt: s.burnAt,
      readBy: s.readBy,
      destroyed: s.destroyed,
    }))
    await messageManager.loadFromStorage(messages)

    this.emit('room:joined', roomId)
  }

  private attemptReconnect(): void {
    if (this.reconnectTimer) return

    this.setStatus('reconnecting')
    let attempts = 0
    const maxAttempts = 5

    const tryReconnect = () => {
      attempts++
      if (attempts > maxAttempts || !this.currentRoom) {
        this.setStatus('disconnected')
        this.emit('reconnect:failed')
        return
      }

      console.log(`[Nymir] Reconnect attempt ${attempts}/${maxAttempts}`)
      peerManager.join(this.roomId)
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      tryReconnect()

      const interval = setInterval(() => {
        if (peerManager.peerList.length > 0 || !this.currentRoom) {
          clearInterval(interval)
          return
        }
        tryReconnect()
      }, 3000)

      // Store interval for cleanup
      this.unsubs.push(() => clearInterval(interval))
    }, 2000)
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
    this.currentRoom = null
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
}

type Message = import('./types').Message

export const roomManager = new RoomManager()
