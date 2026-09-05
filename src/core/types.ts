// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPayload = Record<string, any>

export const BurnMode = {
  READ_ONCE: 'read_once',
  TIMED: 'timed',
  SCHEDULED: 'scheduled',
  PERSIST: 'persist',
} as const

export type BurnMode = (typeof BurnMode)[keyof typeof BurnMode]

export type Message = {
  id: string
  content: string
  sender: string
  timestamp: number
  burnMode: BurnMode
  burnAfter?: number
  burnAt?: number
  readBy: string[]
  destroyed: boolean
  /** 解密失败时为 true，content 为空占位 */
  decryptFailed?: boolean
  /** 签名验证结果：true=通过, false=失败, undefined=无签名或未验证 */
  verified?: boolean
}

export type RoomInfo = {
  id: string
  name: string
  createdAt: number
  peers: string[]
}

export type BurnConfig = {
  mode: BurnMode
  burnAfter?: number
  burnAt?: number
}
