import type { Message } from './types'

export function shouldDestroy(msg: Message): boolean {
  if (msg.destroyed) return true
  if (msg.burnMode === 'persist') return false
  if (msg.burnMode === 'read_once' && msg.readBy.length > 0) return true
  if (msg.burnMode === 'timed' && msg.burnAfter) {
    const elapsed = Date.now() - msg.timestamp
    if (elapsed >= msg.burnAfter * 1000) return true
  }
  // scheduled：仅用于接收旧版/对端客户端发来的消息，当前 UI 不发送此模式
  if (msg.burnMode === 'scheduled' && msg.burnAt) {
    if (Date.now() >= msg.burnAt) return true
  }
  return false
}

export function getRemainingMs(msg: Message): number {
  if (msg.burnMode === 'persist') return Infinity
  if (msg.burnMode === 'read_once') {
    return msg.readBy.length > 0 ? 0 : Infinity
  }
  if (msg.burnMode === 'timed' && msg.burnAfter) {
    const end = msg.timestamp + msg.burnAfter * 1000
    return Math.max(0, end - Date.now())
  }
  // scheduled：协议兼容，当前 UI 不发送
  if (msg.burnMode === 'scheduled' && msg.burnAt) {
    return Math.max(0, msg.burnAt - Date.now())
  }
  return Infinity
}
