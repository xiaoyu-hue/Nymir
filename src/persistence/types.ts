import type { BurnMode } from '../core/types'

export interface StoredMessage {
  id: string
  roomId: string
  content: string
  sender: string
  timestamp: number
  burnMode: BurnMode
  burnAfter?: number
  burnAt?: number
  readBy: string[]
  destroyed: boolean
  /** 解密失败时为 true */
  decryptFailed?: boolean
  /** 签名验证结果：true=通过, false=失败, undefined=无签名或未验证 */
  verified?: boolean
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
