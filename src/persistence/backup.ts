/**
 * Nymir 备份模块
 * 
 * 支持加密备份：
 * - 导出时使用用户密码加密
 * - 导入时需要密码解密
 * - 备份文件包含加密标记
 */

import { getAllRooms, getMessagesByRoom, saveRoom, saveMessage, getRoom, getMessage } from './db'
import { decrypt, verifyPassword, encryptWithSalt, decryptWithSalt } from '../security/crypto'
import { uint8ToBase64, base64ToUint8 } from '../utils/base64'
import type { BackupData } from './types'

const BACKUP_VERSION = 3
const BACKUP_MAGIC = 'NYMIR_ENC_V3'
const BACKUP_SALT_LENGTH = 16

export interface EncryptedBackup {
  version: number
  encrypted: boolean
  magic: string
  data: string // 加密后的 JSON 或明文 JSON
  /** V3+ 备份自带的随机盐（base64），跨设备恢复用 */
  salt?: string
  exportedAt: number
}

/**
 * 导出备份（加密）
 *
 * V3：备份文件自带随机盐（16 字节），不依赖安装盐。
 * 这样备份可以在任意设备上用同一密码恢复。
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
  // 为本次备份生成独立的随机盐，随文件一起导出
  const salt = crypto.getRandomValues(new Uint8Array(BACKUP_SALT_LENGTH))
  const encrypted = await encryptWithSalt(json, password, salt)

  const backup: EncryptedBackup = {
    version: BACKUP_VERSION,
    encrypted: true,
    magic: BACKUP_MAGIC,
    data: encrypted,
    salt: uint8ToBase64(salt),
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
  // 延迟释放：a.click() 是异步触发下载，立即 revoke 可能导致下载未开始就失效
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * 验证备份密码
 * V3+：用备份内嵌的盐解密；V2 旧格式：用安装盐（仅同设备）
 */
export async function verifyBackupPassword(json: string, password: string): Promise<boolean> {
  try {
    const backup: EncryptedBackup = JSON.parse(json)
    if (!backup.encrypted) return false

    // V3+：备份自带盐
    if (backup.salt && backup.magic === BACKUP_MAGIC) {
      try {
        const salt = base64ToUint8(backup.salt)
        await decryptWithSalt(backup.data, password, salt)
        return true
      } catch {
        return false
      }
    }

    // V2 旧格式：用安装盐（只能在导出设备上验证）
    if (backup.magic === 'NYMIR_ENC_V2') {
      return await verifyPassword(backup.data, password)
    }

    return false
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

  // 验证备份格式：接受 V2 和 V3
  const isV3 = backup.magic === BACKUP_MAGIC
  const isV2 = backup.magic === 'NYMIR_ENC_V2'
  if (!isV3 && !isV2) {
    throw new Error('Invalid backup file: not a Nymir backup')
  }

  if (isV2 && backup.version !== 2) {
    throw new Error(`Unsupported backup version: ${backup.version}`)
  }
  if (isV3 && backup.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${backup.version}`)
  }

  if (!backup.encrypted) {
    throw new Error('Backup is not encrypted')
  }

  // 解密
  let decrypted: string
  try {
    if (backup.salt) {
      // V3+：用备份内嵌的盐（跨设备恢复）
      const salt = base64ToUint8(backup.salt)
      decrypted = await decryptWithSalt(backup.data, password, salt)
    } else {
      // V2 旧格式：用安装盐（只能在导出设备上恢复）
      decrypted = await decrypt(backup.data, password)
    }
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

  // 导入数据：跳过已存在的条目，避免覆盖本地新产生的数据
  let importedRooms = 0
  let importedMessages = 0
  for (const room of data.rooms) {
    if (!room.id || !room.name) continue
    const existing = await getRoom(room.id)
    if (existing) continue // 本地已有该房间，跳过，不覆盖
    await saveRoom(room)
    importedRooms++
  }
  for (const msg of data.messages) {
    if (!msg.id || !msg.content) continue
    const existing = await getMessage(msg.id)
    if (existing) continue // 本地已有该消息，跳过，不覆盖
    await saveMessage(msg)
    importedMessages++
  }

  return { rooms: importedRooms, messages: importedMessages }
}
