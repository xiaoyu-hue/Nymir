import type { Message } from './types'

export function shouldDestroy(msg: Message): boolean {
  if (msg.destroyed) return true
  if (msg.burnMode === 'persist') return false
  if (msg.burnMode === 'read_once' && msg.readBy.length > 0) return true
  if (msg.burnMode === 'timed' && msg.burnAfter) {
    const elapsed = Date.now() - msg.timestamp
    if (elapsed >= msg.burnAfter * 1000) return true
  }
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
  if (msg.burnMode === 'scheduled' && msg.burnAt) {
    return Math.max(0, msg.burnAt - Date.now())
  }
  return Infinity
}
