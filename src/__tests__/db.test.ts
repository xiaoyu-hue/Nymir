/**
 * persistence/db 行为测试（mock idb 与 securityManager）
 *
 * 覆盖审查点：加密落盘（enc: 前缀）、解密还原、readBy 加密比较、
 * 以及最关键的红线——加密失败/锁定状态下不得静默降级为明文落盘。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 可控的 securityManager 替身（真实实现走 WebCrypto，这里用可逆 base64 保持测试快速且行为等价）
const securityMock = vi.hoisted(() => ({
  securityManager: {
    isLocked: false,
    encrypt: vi.fn(async (v: string) => btoa(v)),
    decrypt: vi.fn(async (v: string) => atob(v)),
  },
}))

vi.mock('../security', () => securityMock)

// 内存版 idb 替身
const stores = vi.hoisted(() => ({
  rooms: new Map<string, unknown>(),
  messages: new Map<string, unknown>(),
}) as Record<string, Map<string, unknown>>)

vi.mock('idb', () => ({
  openDB: vi.fn(async () => ({
    put: async (store: string, value: { id: string }) => {
      stores[store].set(value.id, value)
    },
    get: async (store: string, key: string) => stores[store].get(key),
    getAll: async (store: string) => [...stores[store].values()],
    getAllFromIndex: async (store: string, _index: string, key: string) =>
      [...stores[store].values()].filter(
        (v) => (v as { roomId: string }).roomId === key,
      ),
    delete: async (store: string, key: string) => {
      stores[store].delete(key)
    },
    transaction: () => ({
      objectStore: (name: string) => ({
        clear: async () => stores[name].clear(),
      }),
      done: Promise.resolve(),
    }),
  })),
}))

import {
  saveMessage,
  getMessagesByRoom,
  saveRoom,
  getRoom,
  getMessage,
  markMessageRead,
  clearAllData,
} from '../persistence/db'

/* eslint-disable @typescript-eslint/no-explicit-any */
const baseMessage = {
  roomId: 'r1',
  timestamp: 1,
  burnMode: 'persist',
  destroyed: false,
} as const

beforeEach(() => {
  stores.rooms.clear()
  stores.messages.clear()
  securityMock.securityManager.isLocked = false
  securityMock.securityManager.encrypt.mockReset()
  securityMock.securityManager.decrypt.mockReset()
  securityMock.securityManager.encrypt.mockImplementation(async (v: string) => btoa(v))
  securityMock.securityManager.decrypt.mockImplementation(async (v: string) => atob(v))
})

describe('persistence/db 加密存储', () => {
  it('saveMessage：明文不落盘，content/sender/readBy 均带 enc: 前缀', async () => {
    await saveMessage({
      ...baseMessage,
      id: 'm1',
      content: 'secret-message',
      sender: 'peer-a',
      readBy: ['peer-b'],
    } as any)

    const stored = stores.messages.get('m1') as any
    expect(stored.content).toBe('enc:' + btoa('secret-message'))
    expect(stored.content).not.toContain('secret-message')
    expect(stored.sender).toBe('enc:' + btoa('peer-a'))
    expect(stored.readBy).toEqual(['enc:' + btoa('peer-b')])
    // roomId 作为索引字段不加密
    expect(stored.roomId).toBe('r1')
  })

  it('getMessagesByRoom：解密还原明文', async () => {
    stores.messages.set('m1', {
      ...baseMessage,
      id: 'm1',
      content: 'enc:' + btoa('hi'),
      sender: 'enc:' + btoa('alice'),
      readBy: ['enc:' + btoa('bob')],
    })

    const msgs = await getMessagesByRoom('r1')
    expect(msgs).toHaveLength(1)
    expect(msgs[0].content).toBe('hi')
    expect(msgs[0].sender).toBe('alice')
    expect(msgs[0].readBy).toEqual(['bob'])
  })

  it('markMessageRead：用加密后的 peerId 比较与追加，不重复', async () => {
    stores.messages.set('m1', {
      ...baseMessage,
      id: 'm1',
      content: 'enc:' + btoa('hi'),
      sender: 'enc:' + btoa('alice'),
      readBy: ['enc:' + btoa('bob')],
    })

    await markMessageRead('m1', 'bob')
    expect((stores.messages.get('m1') as any).readBy).toEqual(['enc:' + btoa('bob')])

    await markMessageRead('m1', 'carol')
    expect((stores.messages.get('m1') as any).readBy).toEqual([
      'enc:' + btoa('bob'),
      'enc:' + btoa('carol'),
    ])
  })

  it('saveRoom/getRoom：房间名加密存储、解密还原', async () => {
    await saveRoom({ id: 'r1', name: 'my-room', createdAt: 1 })
    expect((stores.rooms.get('r1') as any).name).toBe('enc:' + btoa('my-room'))

    const room = await getRoom('r1')
    expect(room?.name).toBe('my-room')
  })

  it('clearAllData：清空 rooms 与 messages', async () => {
    stores.rooms.set('r1', { id: 'r1' })
    stores.messages.set('m1', { id: 'm1' })

    await clearAllData()
    expect(stores.rooms.size).toBe(0)
    expect(stores.messages.size).toBe(0)
  })
})

describe('persistence/db 加密失败红线（禁止静默明文降级）', () => {
  it('加密抛错时 saveMessage 拒绝并抛错，明文不落盘', async () => {
    securityMock.securityManager.encrypt.mockRejectedValue(new Error('encrypt failed'))

    await expect(
      saveMessage({
        ...baseMessage,
        id: 'm-fail',
        content: 'secret-message',
        sender: 'peer-a',
        readBy: [],
      } as any),
    ).rejects.toThrow()

    expect(stores.messages.has('m-fail')).toBe(false)
    const storedAny = [...stores.messages.values()].some(
      (v) => JSON.stringify(v).includes('secret-message'),
    )
    expect(storedAny).toBe(false)
  })

  it('锁定状态（isLocked=true，无可用密钥）时 saveMessage 拒绝，明文不落盘', async () => {
    securityMock.securityManager.isLocked = true
    securityMock.securityManager.encrypt.mockRejectedValue(
      new Error('Security: no password set'),
    )

    await expect(
      saveMessage({
        ...baseMessage,
        id: 'm-locked',
        content: 'secret-message',
        sender: 'peer-a',
        readBy: [],
      } as any),
    ).rejects.toThrow()

    expect(stores.messages.has('m-locked')).toBe(false)
  })

  it('加密抛错时 saveRoom 拒绝，房间名明文不落盘', async () => {
    securityMock.securityManager.encrypt.mockRejectedValue(new Error('encrypt failed'))

    await expect(
      saveRoom({ id: 'r-fail', name: 'secret-room', createdAt: 1 }),
    ).rejects.toThrow()

    expect(stores.rooms.has('r-fail')).toBe(false)
  })

  it('锁定状态下 getRoom 抛错（decryptField 锁定时拒绝暴露数据）', async () => {
    // 先存一条加密数据
    await saveRoom({ id: 'r-locked', name: 'secret-room', createdAt: 1 })
    expect(stores.rooms.has('r-locked')).toBe(true)

    // 锁定后读取应抛错，而非返回明文或原值
    securityMock.securityManager.isLocked = true
    await expect(getRoom('r-locked')).rejects.toThrow('Security: locked')
  })

  it('锁定状态下 getMessagesByRoom 抛错（decryptField 锁定时拒绝暴露数据）', async () => {
    await saveMessage({
      ...baseMessage,
      id: 'm-locked-read',
      content: 'secret content',
      sender: 'peer1',
      readBy: [],
    })

    securityMock.securityManager.isLocked = true
    await expect(getMessagesByRoom('r1')).rejects.toThrow('Security: locked')
  })
})

describe('persistence/db getMessage（单条查询）', () => {
  it('getMessage：存在时返回解密后的消息', async () => {
    await saveMessage({
      ...baseMessage,
      id: 'm-get',
      content: 'hello world',
      sender: 'peer1',
      readBy: [],
    })

    const msg = await getMessage('m-get')
    expect(msg).toBeDefined()
    expect(msg?.id).toBe('m-get')
    expect(msg?.content).toBe('hello world')
    expect(msg?.sender).toBe('peer1')
  })

  it('getMessage：不存在时返回 undefined', async () => {
    const msg = await getMessage('nonexistent')
    expect(msg).toBeUndefined()
  })

  it('getMessage：锁定状态下抛错', async () => {
    await saveMessage({
      ...baseMessage,
      id: 'm-get-locked',
      content: 'secret',
      sender: 'peer1',
      readBy: [],
    })

    securityMock.securityManager.isLocked = true
    await expect(getMessage('m-get-locked')).rejects.toThrow('Security: locked')
  })
})
