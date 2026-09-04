/**
 * Nymir 备份模块
 * 
 * 支持加密备份：
 * - 导出时使用用户密码加密
 * - 导入时需要密码解密
 * - 备份文件包含加密标记
 */

import { getAllRooms, getMessagesByRoom, saveRoom, saveMessage } from './db'
import { encrypt, decrypt, verifyPassword } from '../security/crypto'
import type { BackupData } from './types'

const BACKUP_VERSION = 2
const BACKUP_MAGIC = 'NYMIR_ENC_V2'

export interface EncryptedBackup {
  version: number
  encrypted: boolean
  magic: string
  data: string // 加密后的 JSON 或明文 JSON
  exportedAt: number
}

/**
 * 导出备份（加密）
 */
export async function exportBackup(password: string): Promise<string> {
  const rooms = await getAllRooms()
  const allMessages = []
  for (const room of rooms) {
    const msgs = await getMessagesByRoom(room.id)
    allMessages.push(...msgs)
  }

  const data: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    rooms,
    messages: allMessages,
  }

  const json = JSON.stringify(data)
  const encrypted = await encrypt(json, password)

  const backup: EncryptedBackup = {
    version: BACKUP_VERSION,
    encrypted: true,
    magic: BACKUP_MAGIC,
    data: encrypted,
    exportedAt: Date.now(),
  }

  return JSON.stringify(backup)
}

/**
 * 下载备份文件
 */
export function downloadBackup(json: string, filename?: string): void {
  const name = filename ?? `nymir-backup-${new Date().toISOString().slice(0, 10)}.nymir`
  const blob = new Blob([json], { type: 'application/nymir-backup' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * 验证备份密码
 */
export async function verifyBackupPassword(json: string, password: string): Promise<boolean> {
  try {
    const backup: EncryptedBackup = JSON.parse(json)
    if (backup.magic !== BACKUP_MAGIC || !backup.encrypted) {
      return false
    }
    return await verifyPassword(backup.data, password)
  } catch {
    return false
  }
}

/**
 * 导入备份（解密）
 */
export async function importBackup(
  json: string,
  password: string,
): Promise<{ rooms: number; messages: number }> {
  let backup: EncryptedBackup
  try {
    backup = JSON.parse(json)
  } catch {
    throw new Error('Invalid backup file format')
  }

  // 验证备份格式
  if (backup.magic !== BACKUP_MAGIC) {
    throw new Error('Invalid backup file: not a Nymir backup')
  }

  if (backup.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${backup.version}`)
  }

  if (!backup.encrypted) {
    throw new Error('Backup is not encrypted')
  }

  // 解密
  let decrypted: string
  try {
    decrypted = await decrypt(backup.data, password)
  } catch {
    throw new Error('Wrong password or corrupted backup')
  }

  // 解析数据
  let data: BackupData
  try {
    data = JSON.parse(decrypted)
  } catch {
    throw new Error('Failed to parse backup data')
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid backup data')
  }

  if (!Array.isArray(data.rooms)) {
    throw new Error('Invalid backup: missing rooms array')
  }

  if (!Array.isArray(data.messages)) {
    throw new Error('Invalid backup: missing messages array')
  }

  // 导入数据
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
