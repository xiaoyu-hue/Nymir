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
