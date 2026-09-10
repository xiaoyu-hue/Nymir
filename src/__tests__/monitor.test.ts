/**
 * communication/monitor 行为级测试
 *
 * 覆盖审查点：setChannel 每次注册新 onMessage 导致的重复注册泄漏——
 * 现在 onMessage 返回退订函数，setChannel/stop 会清理旧 handler。
 * 附 ping/pong 行为基线（AGENTS.md：communication 改动须有行为级测试）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectionMonitor } from '../communication/monitor'

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyData = Record<string, any>
type Ctx = { peerId: string }

/** 模拟 peer.ts 的 Channel 契约：onMessage 返回退订函数，置空 handler */
function makeFakeChannel() {
  let handler: ((data: AnyData, ctx: Ctx) => void) | null = null
  const send = vi.fn()
  return {
    channel: {
      send,
      onMessage: (cb: (data: AnyData, ctx: Ctx) => void) => {
        handler = cb
        return () => {
          handler = null
        }
      },
    },
    get handler() {
      return handler
    },
    trigger: (data: AnyData, ctx: Ctx = { peerId: 'p1' }) => handler?.(data, ctx),
    send,
  }
}

beforeEach(() => {
  connectionMonitor.stop()
})

afterEach(() => {
  connectionMonitor.stop()
  vi.restoreAllMocks()
})

describe('connectionMonitor setChannel 防重复注册', () => {
  it('重复 setChannel 会退订旧通道的 onMessage', () => {
    const a = makeFakeChannel()
    const b = makeFakeChannel()

    connectionMonitor.setChannel(a.channel)
    expect(a.handler).not.toBeNull()

    connectionMonitor.setChannel(b.channel)
    expect(a.handler).toBeNull()
    expect(b.handler).not.toBeNull()
  })

  it('stop() 退订当前通道的 onMessage', () => {
    const a = makeFakeChannel()
    connectionMonitor.setChannel(a.channel)
    expect(a.handler).not.toBeNull()

    connectionMonitor.stop()
    expect(a.handler).toBeNull()
  })
})

describe('connectionMonitor ping/pong 行为', () => {
  it('收到 ping 向来源 peer 回复 pong（携带原时间戳）', () => {
    const a = makeFakeChannel()
    connectionMonitor.setChannel(a.channel)

    a.trigger({ type: 'ping', ts: 1000 })

    expect(a.send).toHaveBeenCalledWith({ type: 'pong', ts: 1000 }, 'p1')
  })

  it('收到 pong 更新滑动平均延迟', () => {
    const a = makeFakeChannel()
    connectionMonitor.setChannel(a.channel)
    vi.spyOn(Date, 'now').mockReturnValue(1100)

    a.trigger({ type: 'pong', ts: 1000 })

    expect(connectionMonitor.getLatency()).toBe(100)
  })
})
