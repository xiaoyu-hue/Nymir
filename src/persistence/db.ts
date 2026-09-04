import { openDB, type IDBPDatabase } from 'idb'
import type { StoredMessage, StoredRoom } from './types'

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

export async function saveRoom(room: StoredRoom): Promise<void> {
  const db = await getDB()
  await db.put('rooms', room)
}

export async function getRoom(id: string): Promise<StoredRoom | undefined> {
  const db = await getDB()
  return db.get('rooms', id)
}

export async function getAllRooms(): Promise<StoredRoom[]> {
  const db = await getDB()
  return db.getAll('rooms')
}

export async function deleteRoom(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('rooms', id)
}

export async function saveMessage(msg: StoredMessage): Promise<void> {
  const db = await getDB()
  await db.put('messages', msg)
}

export async function getMessage(id: string): Promise<StoredMessage | undefined> {
  const db = await getDB()
  return db.get('messages', id)
}

export async function getMessagesByRoom(roomId: string): Promise<StoredMessage[]> {
  const db = await getDB()
  return db.getAllFromIndex('messages', 'roomId', roomId)
}

export async function deleteMessage(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('messages', id)
}

export async function destroyMessage(id: string): Promise<void> {
  const db = await getDB()
  const msg = await db.get('messages', id)
  if (msg) {
    msg.destroyed = true
    await db.put('messages', msg)
  }
}

export async function markMessageRead(id: string, peerId: string): Promise<void> {
  const db = await getDB()
  const msg = await db.get('messages', id)
  if (msg && !msg.readBy.includes(peerId)) {
    msg.readBy.push(peerId)
    await db.put('messages', msg)
  }
}

export async function clearRoomMessages(roomId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('messages', 'readwrite')
  const index = tx.store.index('roomId')
  let cursor = await index.openCursor(roomId)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}
