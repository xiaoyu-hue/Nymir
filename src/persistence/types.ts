export interface StoredMessage {
  id: string
  roomId: string
  content: string
  sender: string
  timestamp: number
  burnMode: string
  burnAfter?: number
  burnAt?: number
  readBy: string[]
  destroyed: boolean
}

export interface StoredRoom {
  id: string
  name: string
  createdAt: number
}

export interface BackupData {
  version: number
  exportedAt: number
  rooms: StoredRoom[]
  messages: StoredMessage[]
}
