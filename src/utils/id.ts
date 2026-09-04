export function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

export function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
