import { openDB, type IDBPDatabase } from 'idb'
import { securityManager } from '../security'
import type { StoredMessage, StoredRoom } from './types'
import { warn } from '../utils/logger'

const DB_NAME = 'nymir-treehole'
const DB_VERSION = 2

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
  identity: {
    key: string
    value: { id: string; encKeypair: string; signKeypair: string }
  }
}

let dbInstance: IDBPDatabase<NymirDB> | null = null

async function getDB(): Promise<IDBPDatabase<NymirDB>> {
  if (dbInstance) return dbInstance
  dbInstance = await openDB<NymirDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('rooms', { keyPath: 'id' })
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' })
        msgStore.createIndex('roomId', 'roomId')
      }
      if (oldVersion < 2) {
        db.createObjectStore('identity', { keyPath: 'id' })
      }
    },
  })
  return dbInstance
}

// 加密数据前缀标记，用于可靠区分加密/明文（替代不可靠的正则猜测）
const ENCRYPTED_PREFIX = 'enc:'

// 加密/解密辅助函数
// 红线：加密失败（含锁定无密钥）时抛错，绝不静默降级为明文落盘。
// 一旦明文写入 IndexedDB，将不再有重新加密的时机，且违反「禁止明文落盘」。
async function encryptField(value: string): Promise<string> {
  const encrypted = await securityManager.encrypt(value)
  return ENCRYPTED_PREFIX + encrypted
}

async function decryptField(value: string): Promise<string> {
  // 锁定时抛错而非返回原值：原值可能是历史明文数据，
  // 锁定状态下返回明文违反「锁定时不应暴露数据」原则。
  if (securityManager.isLocked) throw new Error('Security: locked, cannot decrypt field')
  try {
    // 新数据：带 enc: 前缀，可靠识别
    if (value.startsWith(ENCRYPTED_PREFIX)) {
      return await securityManager.decrypt(value.slice(ENCRYPTED_PREFIX.length))
    }
    // 旧数据兼容：无前缀时尝试正则检测 + 解密
    // 解密失败时返回原值（不再返回 [encrypted]，避免明文被误判后丢失）
    if (value.length > 20 && /^[A-Za-z0-9+/=]+$/.test(value)) {
      try {
        return await securityManager.decrypt(value)
      } catch {
        return value
      }
    }
    return value
  } catch {
    warn('[DB] Decryption failed, returning original value')
    return value
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

/**
 * 根据 ID 获取单条消息（用于备份导入时检查是否已存在，避免覆盖本地新数据）
 */
export async function getMessage(id: string): Promise<StoredMessage | undefined> {
  const db = await getDB()
  const msg = await db.get('messages', id)
  return msg ? decryptMessage(msg) : undefined
}

export async function destroyMessage(id: string): Promise<void> {
  const db = await getDB()
  // 幂等：如果 id 不存在，不抛出异常
  await db.delete('messages', id).catch(() => {})
}

export async function markMessageRead(id: string, peerId: string): Promise<void> {
  const db = await getDB()
  const msg = await db.get('messages', id)
  if (!msg) return
  // 数据库中 readBy 存储的是加密后的 peerId，必须先加密再比较和存入
  const encryptedPeerId = await encryptField(peerId)
  if (!msg.readBy.includes(encryptedPeerId)) {
    msg.readBy.push(encryptedPeerId)
    await db.put('messages', msg)
  }
}

/**
 * 清空所有数据（忘记密码时使用）
 */
export async function clearAllData(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['rooms', 'messages', 'identity'], 'readwrite')
  await Promise.all([
    tx.objectStore('rooms').clear(),
    tx.objectStore('messages').clear(),
    tx.objectStore('identity').clear(),
    tx.done,
  ])
}

// --- 身份密钥持久化（v4 起）---

const IDENTITY_KEY = 'default'

/** 保存加密后的身份密钥对（调用方负责用锁屏密码加密） */
export async function saveIdentity(encKeypair: string, signKeypair: string): Promise<void> {
  const db = await getDB()
  await db.put('identity', { id: IDENTITY_KEY, encKeypair, signKeypair })
}

/** 读取加密后的身份密钥对；不存在返回 undefined */
export async function loadIdentity(): Promise<{ encKeypair: string; signKeypair: string } | undefined> {
  const db = await getDB()
  const row = await db.get('identity', IDENTITY_KEY)
  return row ? { encKeypair: row.encKeypair, signKeypair: row.signKeypair } : undefined
}
