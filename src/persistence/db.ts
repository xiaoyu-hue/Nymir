import { openDB, type IDBPDatabase } from 'idb'
import { securityManager } from '../security'
import type { StoredMessage, StoredRoom } from './types'
import { warn } from '../utils/logger'

const DB_NAME = 'nymir-treehole'
const DB_VERSION = 1

interface NymirDB {
  rooms: {
    key: string
    value: StoredRoom
  }
  messages: {
    key: string
    value: StoredMessage
    indexes: { roomId: string }
  }
}

let dbInstance: IDBPDatabase<NymirDB> | null = null

async function getDB(): Promise<IDBPDatabase<NymirDB>> {
  if (dbInstance) return dbInstance
  dbInstance = await openDB<NymirDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('rooms', { keyPath: 'id' })
      const msgStore = db.createObjectStore('messages', { keyPath: 'id' })
      msgStore.createIndex('roomId', 'roomId')
    },
  })
  return dbInstance
}

// 加密/解密辅助函数
async function encryptField(value: string): Promise<string> {
  if (securityManager.isLocked) return value
  try {
    return await securityManager.encrypt(value)
  } catch {
    return value
  }
}

async function decryptField(value: string): Promise<string> {
  if (securityManager.isLocked) return value
  try {
    // 检查是否是加密数据（base64 格式）
    if (value.length > 20 && /^[A-Za-z0-9+/=]+$/.test(value)) {
      return await securityManager.decrypt(value)
    }
    return value
  } catch {
    warn('[DB] Decryption failed, returning placeholder')
    return '[encrypted]'
  }
}

// 加密房间
async function encryptRoom(room: StoredRoom): Promise<StoredRoom> {
  return {
    ...room,
    name: await encryptField(room.name),
  }
}

// 解密房间
async function decryptRoom(room: StoredRoom): Promise<StoredRoom> {
  return {
    ...room,
    name: await decryptField(room.name),
  }
}

// 加密消息
async function encryptMessage(msg: StoredMessage): Promise<StoredMessage> {
  return {
    ...msg,
    content: await encryptField(msg.content),
    sender: await encryptField(msg.sender),
    readBy: await Promise.all(msg.readBy.map(encryptField)),
  }
}

// 解密消息
async function decryptMessage(msg: StoredMessage): Promise<StoredMessage> {
  return {
    ...msg,
    content: await decryptField(msg.content),
    sender: await decryptField(msg.sender),
    readBy: await Promise.all(msg.readBy.map(decryptField)),
  }
}

export async function saveRoom(room: StoredRoom): Promise<void> {
  const db = await getDB()
  const encrypted = await encryptRoom(room)
  await db.put('rooms', encrypted)
}

export async function getRoom(id: string): Promise<StoredRoom | undefined> {
  const db = await getDB()
  const room = await db.get('rooms', id)
  return room ? decryptRoom(room) : undefined
}

export async function getAllRooms(): Promise<StoredRoom[]> {
  const db = await getDB()
  const rooms = await db.getAll('rooms')
  return Promise.all(rooms.map(decryptRoom))
}

export async function deleteRoom(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('rooms', id)
}

export async function saveMessage(msg: StoredMessage): Promise<void> {
  const db = await getDB()
  const encrypted = await encryptMessage(msg)
  await db.put('messages', encrypted)
}

export async function getMessagesByRoom(roomId: string): Promise<StoredMessage[]> {
  const db = await getDB()
  const messages = await db.getAllFromIndex('messages', 'roomId', roomId)
  return Promise.all(messages.map(decryptMessage))
}

export async function destroyMessage(id: string): Promise<void> {
  const db = await getDB()
  // 幂等：如果 id 不存在，不抛出异常
  await db.delete('messages', id).catch(() => {})
}

export async function markMessageRead(id: string, peerId: string): Promise<void> {
  const db = await getDB()
  const msg = await db.get('messages', id)
  if (msg && !msg.readBy.includes(peerId)) {
    msg.readBy.push(peerId)
    await db.put('messages', msg)
  }
}

/**
 * 清空所有数据（忘记密码时使用）
 */
export async function clearAllData(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['rooms', 'messages'], 'readwrite')
  await Promise.all([
    tx.objectStore('rooms').clear(),
    tx.objectStore('messages').clear(),
    tx.done,
  ])
}
