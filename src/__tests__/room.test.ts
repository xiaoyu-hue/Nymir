/**
 * roomManager 行为测试：退出房间必须清理该房间的离线队列（契约）。
 * 覆盖审查点：『room.leaveRoom() 只调 messageManager.destroy()，并不调用
 * offlineQueue.clear()，导致 payload 残留』。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const clearRoomMock = vi.hoisted(() => vi.fn())

vi.mock('../communication/offlineQueue', () => ({
  offlineQueue: { clearRoom: clearRoomMock },
}))

vi.mock('../communication/peer', () => ({
  peerManager: {
    id: 'local-self',
    get peerList() {
      return []
    },
    join: vi.fn(),
    leave: vi.fn(),
    onPeerJoin: vi.fn(() => () => {}),
    onPeerLeave: vi.fn(() => () => {}),
    onPeerKey: vi.fn(() => () => {}),
    onRoomName: vi.fn(() => () => {}),
    onRoomRebuilt: vi.fn(() => () => {}),
    broadcastRoomName: vi.fn(),
    requestRoomName: vi.fn(),
  },
}))

vi.mock('../communication/monitor', () => ({
  connectionMonitor: {
    start: vi.fn(),
    stop: vi.fn(),
    setPeerCount: vi.fn(),
    setChannel: vi.fn(),
  },
}))

vi.mock('../persistence/db', () => ({
  saveRoom: vi.fn(async () => {}),
  getAllRooms: vi.fn(async () => []),
  deleteRoom: vi.fn(async () => {}),
  getMessagesByRoom: vi.fn(async () => []),
  getRoom: vi.fn(async () => undefined),
}))

vi.mock('../security/secureDelete', () => ({
  clearLocalStorage: vi.fn(),
}))

vi.mock('../utils/id', () => ({
  generateRoomId: vi.fn(() => 'generated-room'),
  isValidRoomId: vi.fn(() => true),
}))

vi.mock('../core/message', () => ({
  messageManager: {
    init: vi.fn(),
    destroy: vi.fn(),
    loadFromStorage: vi.fn(async () => {}),
    retryOfflineMessages: vi.fn(),
  },
}))

import { roomManager } from '../core/room'

beforeEach(() => {
  clearRoomMock.mockReset()
})

afterEach(() => {
  // 清理单例状态，避免用例间 currentRoom 残留
  roomManager.leaveRoom()
})

describe('roomManager.leaveRoom 清理离线队列', () => {
  it('退出房间时调用 offlineQueue.clearRoom(当前房间 id)', async () => {
    await roomManager.joinRoom('room-abc', 'My Room')
    expect(roomManager.inRoom).toBe(true)

    roomManager.leaveRoom()

    expect(clearRoomMock).toHaveBeenCalledTimes(1)
    expect(clearRoomMock).toHaveBeenCalledWith('room-abc')
    expect(roomManager.inRoom).toBe(false)
  })

  it('未加入房间时 leaveRoom 不调用 clearRoom', () => {
    roomManager.leaveRoom()
    expect(clearRoomMock).not.toHaveBeenCalled()
  })
})

describe('roomManager 初始状态', () => {
  it('未在房间时 inRoom 为 false', () => {
    expect(roomManager.inRoom).toBe(false)
  })

  it('未在房间时 room 为 null', () => {
    expect(roomManager.room).toBeNull()
  })

  it('初始状态 status 为 disconnected', () => {
    expect(roomManager.status).toBe('disconnected')
  })
})

describe('roomManager 事件订阅/退订', () => {
  it('onEvent 订阅后返回退订函数', () => {
    const cb = vi.fn()
    const unsub = roomManager.onEvent(cb)
    expect(typeof unsub).toBe('function')
    unsub()
  })
})

describe('roomManager getSavedRooms', () => {
  it('getSavedRooms 返回房间列表（peers 为空数组）', async () => {
    const { getAllRooms } = await import('../persistence/db')
    vi.mocked(getAllRooms).mockResolvedValueOnce([
      { id: 'room1', name: 'Room 1', createdAt: 12345 },
      { id: 'room2', name: 'Room 2', createdAt: 67890 },
    ])

    const rooms = await roomManager.getSavedRooms()
    expect(rooms).toHaveLength(2)
    expect(rooms[0]).toEqual({ id: 'room1', name: 'Room 1', createdAt: 12345, peers: [] })
    expect(rooms[1]).toEqual({ id: 'room2', name: 'Room 2', createdAt: 67890, peers: [] })
  })

  it('getSavedRooms 无房间时返回空数组', async () => {
    const { getAllRooms } = await import('../persistence/db')
    vi.mocked(getAllRooms).mockResolvedValueOnce([])
    const rooms = await roomManager.getSavedRooms()
    expect(rooms).toEqual([])
  })
})

describe('roomManager deleteSavedRoom', () => {
  it('deleteSavedRoom 调用 db.deleteRoom', async () => {
    const { deleteRoom } = await import('../persistence/db')
    await roomManager.deleteSavedRoom('room1')
    expect(deleteRoom).toHaveBeenCalledWith('room1')
  })
})

describe('roomManager secureReset（废弃方法）', () => {
  it('secureReset 调用 leaveRoom 和 clearLocalStorage', async () => {
    const { clearLocalStorage } = await import('../security/secureDelete')
    await roomManager.secureReset()
    expect(clearLocalStorage).toHaveBeenCalledWith('nymir')
  })
})
