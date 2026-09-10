/**
 * messageManager 接收路径测试
 * 只测行为，不改 src 实现。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type MsgCb = (data: Record<string, unknown>, ctx: { peerId: string }) => void | Promise<void>

const handlers: { messages?: MsgCb } = {}
const peerListState: string[] = []

vi.mock('../communication/peer', () => ({
  peerManager: {
    id: 'local-self',
    get peerList() {
      return [...peerListState]
    },
    makeChannel: (namespace: string) => ({
      send: vi.fn(),
      onMessage: (cb: MsgCb) => {
        if (namespace === 'messages') handlers.messages = cb
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

vi.mock('../security/e2eeManager', () => ({
  e2eeManager: {
    verify: vi.fn(),
    decrypt: vi.fn(),
    encrypt: vi.fn(),
    sign: vi.fn(),
    recordMessageSent: vi.fn(),
  },
}))

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
    clear: vi.fn(),
  },
}))

import { messageManager, MESSAGE_SIG_VERSION } from '../core/message'
import { e2eeManager } from '../security/e2eeManager'
import { saveMessage } from '../persistence/db'

const verifyMock = e2eeManager.verify as ReturnType<typeof vi.fn>
const decryptMock = e2eeManager.decrypt as ReturnType<typeof vi.fn>
const saveMock = saveMessage as ReturnType<typeof vi.fn>

async function fireIncoming(data: Record<string, unknown>, peerId = 'peer-a') {
  if (!handlers.messages) throw new Error('messages handler not bound')
  await handlers.messages(data, { peerId })
}

beforeEach(() => {
  peerListState.length = 0
  verifyMock.mockReset()
  decryptMock.mockReset()
  saveMock.mockReset()
  messageManager.destroy()
  messageManager.init('test-room')
})

describe('messageManager 接收路径', () => {
  it('缺 id 的 payload 被丢弃，不入库、不进入消息列表', async () => {
    await fireIncoming({
      timestamp: Date.now(),
      burnMode: 'persist',
      content: 'x',
    })
    expect(messageManager.getMessages()).toHaveLength(0)
    expect(saveMock).not.toHaveBeenCalled()
  })

  it('缺 timestamp 的 payload 被丢弃', async () => {
    await fireIncoming({
      id: 'm1',
      burnMode: 'persist',
      content: 'x',
    })
    expect(messageManager.getMessages()).toHaveLength(0)
    expect(saveMock).not.toHaveBeenCalled()
  })

  it('缺 burnMode 的 payload 被丢弃', async () => {
    await fireIncoming({
      id: 'm2',
      timestamp: Date.now(),
      content: 'x',
    })
    expect(messageManager.getMessages()).toHaveLength(0)
    expect(saveMock).not.toHaveBeenCalled()
  })

  it('解密失败时 content 为空且 decryptFailed=true，不得回退明文', async () => {
    verifyMock.mockResolvedValue(true)
    decryptMock.mockResolvedValue(null)

    await fireIncoming({
      id: 'm-dec-fail',
      timestamp: Date.now(),
      burnMode: 'persist',
      content: 'cipher-blob',
      encrypted: true,
      signature: 'sig',
      sig: MESSAGE_SIG_VERSION,
    })

    const msgs = messageManager.getMessages()
    expect(msgs).toHaveLength(1)
    expect(msgs[0].decryptFailed).toBe(true)
    expect(msgs[0].content).toBe('')
    expect(msgs[0].verified).toBe(false)
    expect(saveMock).toHaveBeenCalled()
  })

  it('验签失败时 verified=false，且不展示可读内容', async () => {
    verifyMock.mockResolvedValue(false)

    await fireIncoming({
      id: 'm-sig-fail',
      timestamp: Date.now(),
      burnMode: 'persist',
      content: 'cipher-or-plain',
      encrypted: true,
      signature: 'bad-sig',
      sig: MESSAGE_SIG_VERSION,
    })

    const msgs = messageManager.getMessages()
    expect(msgs).toHaveLength(1)
    expect(msgs[0].verified).toBe(false)
    expect(msgs[0].content).toBe('')
    expect(decryptMock).not.toHaveBeenCalled()
  })

  it('无 signature 或 sig 版本不对时 verified=false', async () => {
    await fireIncoming({
      id: 'm-legacy',
      timestamp: Date.now(),
      burnMode: 'persist',
      content: 'hello-plain',
      encrypted: false,
    })
    const msgs = messageManager.getMessages()
    expect(msgs).toHaveLength(1)
    expect(msgs[0].verified).toBe(false)
    expect(msgs[0].content).toBe('')
  })

  /**
   * 已知缺口（TODO，随实现修复后本断言反转）：
   * encrypted=false 且验签通过时，当前实现会把 content 当明文接受——
   * 这允许发送方用 sign-then-encrypt 的旧方式传输明文，绕过 encrypt-then-sign 契约。
   * 修复计划：sig===2 的载荷必须 encrypted===true，否则视为验签失败。
   */
  it('记录当前行为（待修复）：encrypted=false 且验签通过时，会把 content 当明文接受', async () => {
    verifyMock.mockResolvedValue(true)

    await fireIncoming({
      id: 'm-plain-signed',
      timestamp: Date.now(),
      burnMode: 'persist',
      content: 'cleartext-body',
      encrypted: false,
      signature: 'valid-over-plaintext',
      sig: MESSAGE_SIG_VERSION,
    })

    const msgs = messageManager.getMessages()
    expect(msgs).toHaveLength(1)
    expect(msgs[0].content).toBe('cleartext-body')
    expect(msgs[0].verified).not.toBe(false)
    expect(decryptMock).not.toHaveBeenCalled()
  })
})
