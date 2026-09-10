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
    offlineQueue.enqueue('msg-1', 'room-a', { content: 'hello', id: 'msg-1' }, [])
    const pending = offlineQueue.getPending('room-a')
    expect(pending).toHaveLength(1)
    expect(pending[0].id).toBe('msg-1')
    expect(pending[0].status).toBe('pending')
    expect(pending[0].payload).toMatchObject({ content: 'hello' })
  })

  it('相同 msgId 重复 enqueue 不会产生第二条', () => {
    offlineQueue.enqueue('msg-1', 'room-a', { content: 'a' }, [])
    offlineQueue.enqueue('msg-1', 'room-a', { content: 'b' }, [])
    expect(offlineQueue.getPending('room-a')).toHaveLength(1)
    expect(offlineQueue.getStats().total).toBe(1)
  })

  it('markSent 后不再出现在 getPending（attempts 仍 < 3 但 status 已非 pending）', () => {
    offlineQueue.enqueue('msg-2', 'room-a', { content: 'x' }, [])
    offlineQueue.markSent('msg-2')
    expect(offlineQueue.getPending('room-a')).toHaveLength(0)
    expect(offlineQueue.getStats().sent).toBe(1)
  })

  it('markDelivered 后从队列移除，不残留 id', () => {
    offlineQueue.enqueue('msg-3', 'room-a', { content: 'y' }, [])
    offlineQueue.markDelivered('msg-3')
    expect(offlineQueue.getStats().total).toBe(0)
    expect(offlineQueue.getPending('room-a')).toHaveLength(0)
  })

  it('clear() 清空内存与 localStorage 中的队列', () => {
    offlineQueue.enqueue('msg-4', 'room-a', { content: 'secret' }, [])
    offlineQueue.clear()
    expect(offlineQueue.getStats().total).toBe(0)
    expect(localStorage.getItem('nymir_offline_queue')).toBe('[]')
  })

  /**
   * 已知缺口（已登记为 it.todo，不阻塞 CI）：
   * 退出房间应清理该房间的离线队列，避免 payload 残留。
   * 当前 room.leaveRoom() 只调 messageManager.destroy()，并不清理队列。
   * 修复计划：新增 offlineQueue.clearRoom(roomId)，并在 room.leaveRoom() 中调用；
   * 修复完成后本 todo 转为真实断言。
   */
  it.todo('契约：退出房间后该房间队列不应残留敏感 payload（待实现 clearRoom）')
})
