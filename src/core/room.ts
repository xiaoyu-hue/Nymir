import { peerManager } from '../communication/peer'
import { saveRoom, getAllRooms, deleteRoom as dbDeleteRoom, getMessagesByRoom } from '../persistence/db'
import { generateRoomId } from '../utils/id'
import { messageManager } from './message'
import type { RoomInfo } from './types'
import type { StoredMessage } from '../persistence/types'

export type RoomListener = (event: string, data?: unknown) => void

export class RoomManager {
  private currentRoom: RoomInfo | null = null
  private listeners: RoomListener[] = []
  private unsubs: (() => void)[] = []

  get room(): RoomInfo | null {
    return this.currentRoom
  }

  get inRoom(): boolean {
    return this.currentRoom !== null
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

    peerManager.join(roomId)
    messageManager.init(roomId)

    this.currentRoom = {
      id: roomId,
      name: roomId,
      createdAt: Date.now(),
      peers: [],
    }

    const unsubJoin = peerManager.onPeerJoin((peerId) => {
      if (this.currentRoom) {
        this.currentRoom.peers = peerManager.peerList
        this.emit('peer:join', peerId)
      }
    })

    const unsubLeave = peerManager.onPeerLeave((peerId) => {
      if (this.currentRoom) {
        this.currentRoom.peers = peerManager.peerList
        this.emit('peer:leave', peerId)
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

  leaveRoom(): void {
    for (const unsub of this.unsubs) unsub()
    this.unsubs = []

    messageManager.destroy()
    peerManager.leave()
    this.currentRoom = null
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
