/**
 * ID 生成工具
 */

import { secureRandomInt } from './random'

const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去除 I/O/0/1 避免混淆
const ROOM_ID_LENGTH = 8

/**
 * 生成房间 ID（8位 + 1位校验码）
 *
 * 格式：XXXXXXXXC
 * - X: 加密安全随机字符
 * - C: 校验码（Luhn-like 算法）
 */
export function generateRoomId(): string {
  let result = ''
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    result += ROOM_CHARS[secureRandomInt(ROOM_CHARS.length)]
  }

  const checksum = calculateChecksum(result)
  return result + ROOM_CHARS[checksum % ROOM_CHARS.length]
}

/**
 * 验证房间 ID 格式（格式校验，不查库）
 */
export function isValidRoomId(roomId: string): boolean {
  if (roomId.length !== 9) return false
  if (!/^[A-Z2-9]{9}$/.test(roomId)) return false

  const code = roomId.slice(0, 8)
  const expectedChecksum = ROOM_CHARS[calculateChecksum(code) % ROOM_CHARS.length]
  return roomId[8] === expectedChecksum
}

/**
 * 计算校验码
 */
function calculateChecksum(code: string): number {
  let sum = 0
  for (let i = 0; i < code.length; i++) {
    const charValue = ROOM_CHARS.indexOf(code[i])
    // 奇数位乘 2
    if (i % 2 === 0) {
      sum += charValue * 2
    } else {
      sum += charValue
    }
  }
  return sum % ROOM_CHARS.length
}

/**
 * 生成消息 ID
 */
export function generateMessageId(): string {
  const array = new Uint32Array(4)
  crypto.getRandomValues(array)
  return `${Date.now()}-${Array.from(array, (v) => v.toString(36)).join('')}`
}
