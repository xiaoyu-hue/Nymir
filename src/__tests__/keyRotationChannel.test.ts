/**
 * 可验证密钥轮换通道集成测试（message.ts ↔ e2eeManager）
 *
 * 覆盖：
 * - init 时注册 onKeyRotation 广播回调
 * - rotateKeys() 触发 e2eeManager 轮换，成功则广播证明到 key-rotation 通道
 * - 收到对端 key-rotation 通知 → handleKeyRotation 被调用
 * - 畸形通知不进入 handleKeyRotation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

type MsgCb = (data: Record<string, unknown>, ctx: { peerId: string }) => void | Promise<void>

const handlers: Record<string, MsgCb> = {}
const sent: Array<{ ns: string; data: unknown }> = []
const channelUnsubs: (() => void)[] = []

vi.mock('../communication/peer', () => ({
  peerManager: {
    id: 'local-self',
    get peerList() {
      return []
    },
    makeChannel: (namespace: string) => ({
      send: (data: unknown) => {
        sent.push({ ns: namespace, data })
      },
      onMessage: (cb: MsgCb) => {
        handlers[namespace] = cb
        const unsub = vi.fn()
        channelUnsubs.push(unsub)
        return unsub
      },
    }),
    onRoomRebuilt: () => () => {},
  },
}))

vi.mock('../persistence/db', () => ({
  saveMessage: vi.fn(async () => {}),
  markMessageRead: vi.fn(async () => {}),
  destroyMessage: vi.fn(async () => {}),
}))

// 真实可用的 e2eeManager mock：捕获 onKeyRotation 回调，handleKeyRotation 可编程
const keyRotationCbs: Array<(n: unknown) => void> = []
const mockE2ee = {
  verify: vi.fn(),
  decrypt: vi.fn(),
  encrypt: vi.fn(),
  sign: vi.fn(),
  recordMessageSent: vi.fn(),
  onKeyRotation: vi.fn((cb: (n: unknown) => void) => {
    keyRotationCbs.push(cb)
  }),
  handleKeyRotation: vi.fn(async () => 'accepted'),
  rotateKeysVerifiable: vi.fn(async () => ({
    proof: '{"v":1,"newEncPub":"new-enc"}',
    signature: 'sig-abc',
  })),
}

vi.mock('../security/e2eeManager', () => ({ e2eeManager: mockE2ee }))

vi.mock('../security/noise', () => ({
  isNoiseMessage: vi.fn(() => false),
  startNoiseGeneration: vi.fn(),
  stopNoiseGeneration: vi.fn(),
}))

vi.mock('../communication/offlineQueue', () => ({
  offlineQueue: {
    enqueue: vi.fn(),
    getPending: vi.fn(() => []),
    markSent: vi.fn(),
    markDelivered: vi.fn(),
    markFailed: vi.fn(),
  },
}))

describe('可验证密钥轮换通道（message.ts）', () => {
  beforeEach(() => {
    Object.keys(handlers).forEach((k) => delete handlers[k])
    sent.length = 0
    keyRotationCbs.length = 0
    vi.clearAllMocks()
  })

  it('init 后注册 onKeyRotation 广播回调', async () => {
    const { messageManager } = await import('../core/message')
    messageManager.init('room-a')
    expect(mockE2ee.onKeyRotation).toHaveBeenCalledTimes(1)
  })

  it('rotateKeys() 触发轮换并广播证明到 key-rotation 通道', async () => {
    const { messageManager } = await import('../core/message')
    messageManager.init('room-a')

    // 触发已注册的 onKeyRotation 回调（模拟 e2eeManager 轮换完成）
    const cb = keyRotationCbs[0]
    expect(cb).toBeDefined()
    cb({ proof: '{"v":1,"newEncPub":"new-enc"}', signature: 'sig-abc' })

    expect(sent).toContainEqual({
      ns: 'key-rotation',
      data: { type: 'key-rotation', proof: '{"v":1,"newEncPub":"new-enc"}', signature: 'sig-abc' },
    })
  })

  it('onKeyRotation 回调收到 null（非可验证轮换）时不广播', async () => {
    const { messageManager } = await import('../core/message')
    messageManager.init('room-a')

    keyRotationCbs[0](null)

    expect(sent.filter((s) => s.ns === 'key-rotation')).toHaveLength(0)
  })

  it('messageManager.rotateKeys() 调用 e2eeManager 并返回成功', async () => {
    const { messageManager } = await import('../core/message')
    messageManager.init('room-a')

    const ok = await messageManager.rotateKeys()
    expect(mockE2ee.rotateKeysVerifiable).toHaveBeenCalledTimes(1)
    expect(ok).toBe(true)
  })

  it('收到对端 key-rotation 通知 → handleKeyRotation(peerId, notice)', async () => {
    const { messageManager } = await import('../core/message')
    messageManager.init('room-a')

    mockE2ee.handleKeyRotation.mockResolvedValueOnce('accepted')
    await handlers['key-rotation'](
      { type: 'key-rotation', proof: '{"v":1}', signature: 'sig-x' },
      { peerId: 'peer-b' },
    )

    expect(mockE2ee.handleKeyRotation).toHaveBeenCalledWith('peer-b', {
      proof: '{"v":1}',
      signature: 'sig-x',
    })
  })

  it('畸形通知（缺 proof/signature）不进入 handleKeyRotation', async () => {
    const { messageManager } = await import('../core/message')
    messageManager.init('room-a')

    await handlers['key-rotation']({ type: 'key-rotation', proof: 'x' }, { peerId: 'peer-b' })
    await handlers['key-rotation']({ type: 'other' }, { peerId: 'peer-b' })

    expect(mockE2ee.handleKeyRotation).not.toHaveBeenCalled()
  })
})
