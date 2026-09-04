export const BurnMode = {
  READ_ONCE: 'read_once',
  TIMED: 'timed',
  SCHEDULED: 'scheduled',
  PERSIST: 'persist',
} as const

export type BurnMode = (typeof BurnMode)[keyof typeof BurnMode]

export interface Message {
  id: string
  content: string
  sender: string
  timestamp: number
  burnMode: BurnMode
  burnAfter?: number
  burnAt?: number
  readBy: string[]
  destroyed: boolean
}

export interface RoomInfo {
  id: string
  name: string
  createdAt: number
  peers: string[]
}

export interface BurnConfig {
  mode: BurnMode
  burnAfter?: number
  burnAt?: number
}
