/**
 * offlineQueue 行为测试（不改实现，只记录真实行为与契约缺口）
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { offlineQueue } from '../communication/offlineQueue'

function installLocalStorage() {
  const store = new Map<string, string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    clear: () => store.clear(),
    get length() {
      return store.size
    },
    key: (i: number) => [...store.keys()][i] ?? null,
  }
}

beforeEach(() => {
  installLocalStorage()
  offlineQueue.clear()
})

describe('offlineQueue', () => {
  it('无 peer 场景：消息可入队且 getPending 能取回', () => {
    offlineQueue.enqueue('msg-1', 'room-a', {}, [])
    const pending = offlineQueue.getPending('room-a')
    expect(pending).toHaveLength(1)
    expect(pending[0].id).toBe('msg-1')
    expect(pending[0].status).toBe('pending')
    // payload 不存明文内容（设计如此，防 localStorage 泄露）
    expect(pending[0].payload).toEqual({})
  })

  it('相同 msgId 重复 enqueue 不会产生第二条', () => {
    offlineQueue.enqueue('msg-1', 'room-a', {}, [])
    offlineQueue.enqueue('msg-1', 'room-a', {}, [])
    expect(offlineQueue.getPending('room-a')).toHaveLength(1)
    expect(offlineQueue.getStats().total).toBe(1)
  })

  it('markSent 后不再出现在 getPending（attempts 仍 < 3 但 status 已非 pending）', () => {
    offlineQueue.enqueue('msg-2', 'room-a', {}, [])
    offlineQueue.markSent('msg-2')
    expect(offlineQueue.getPending('room-a')).toHaveLength(0)
    expect(offlineQueue.getStats().sent).toBe(1)
  })

  it('markDelivered 后从队列移除，不残留 id', () => {
    offlineQueue.enqueue('msg-3', 'room-a', {}, [])
    offlineQueue.markDelivered('msg-3')
    expect(offlineQueue.getStats().total).toBe(0)
    expect(offlineQueue.getPending('room-a')).toHaveLength(0)
  })

  it('clear() 清空内存与 localStorage 中的队列', () => {
    offlineQueue.enqueue('msg-4', 'room-a', {}, [])
    offlineQueue.clear()
    expect(offlineQueue.getStats().total).toBe(0)
    expect(localStorage.getItem('nymir_offline_queue')).toBe('[]')
  })

  it('clearRoom 只清理指定房间的条目，其他房间保留', () => {
    offlineQueue.enqueue('a-1', 'room-a', {}, [])
    offlineQueue.enqueue('b-1', 'room-b', {}, [])

    offlineQueue.clearRoom('room-a')

    expect(offlineQueue.getPending('room-a')).toHaveLength(0)
    expect(offlineQueue.getStats().total).toBe(1)
    expect(offlineQueue.getPending('room-b')).toHaveLength(1)
    // localStorage 同步清理
    const persisted = JSON.parse(localStorage.getItem('nymir_offline_queue') || '[]')
    expect(persisted.some((q: { roomId: string }) => q.roomId === 'room-a')).toBe(false)
  })

  it('clearRoom 对不存在的房间是幂等的，不报错', () => {
    offlineQueue.enqueue('a-1', 'room-a', {}, [])
    expect(() => offlineQueue.clearRoom('no-such-room')).not.toThrow()
    expect(offlineQueue.getStats().total).toBe(1)
  })

  /**
   * 『退出房间应清理该房间离线队列』的契约已由 room.test.ts 覆盖
   * （room.leaveRoom() 调用 offlineQueue.clearRoom(当前房间 id)）。
   * clearRoom 自身的隔离/幂等行为见上方两个用例。
   */
})
