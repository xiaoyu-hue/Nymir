import { getAllRooms, getMessagesByRoom, saveRoom, saveMessage } from './db'
import type { BackupData } from './types'

export async function exportBackup(): Promise<string> {
  const rooms = await getAllRooms()
  const allMessages = []
  for (const room of rooms) {
    const msgs = await getMessagesByRoom(room.id)
    allMessages.push(...msgs)
  }

  const data: BackupData = {
    version: 1,
    exportedAt: Date.now(),
    rooms,
    messages: allMessages,
  }

  return JSON.stringify(data, null, 2)
}

export function downloadBackup(json: string, filename?: string): void {
  const name = filename ?? `nymir-backup-${new Date().toISOString().slice(0, 10)}.json`
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export async function importBackup(json: string): Promise<{ rooms: number; messages: number }> {
  let data: BackupData
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('Invalid JSON format')
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid backup: not an object')
  }
  if (data.version !== 1) {
    throw new Error(`Unsupported backup version: ${data.version}`)
  }
  if (!Array.isArray(data.rooms)) {
    throw new Error('Invalid backup: missing rooms array')
  }
  if (!Array.isArray(data.messages)) {
    throw new Error('Invalid backup: missing messages array')
  }

  for (const room of data.rooms) {
    if (!room.id || !room.name) continue
    await saveRoom(room)
  }
  for (const msg of data.messages) {
    if (!msg.id || !msg.content) continue
    await saveMessage(msg)
  }

  return { rooms: data.rooms.length, messages: data.messages.length }
}
