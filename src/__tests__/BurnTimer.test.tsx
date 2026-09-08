// @vitest-environment jsdom
/**
 * BurnTimer 组件回归测试（UI 测试设施首次引入：@testing-library/react + jsdom）
 *
 * 重点回归项：同一组件实例先后收到两条消息时，
 * onExpired 必须能为第二条消息再次触发（hasExpiredRef 重置修复）。
 */
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BurnTimer from '../ui/components/BurnTimer'
import { I18nProvider } from '../i18n'
import type { Message } from '../core/types'

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    content: 'secret',
    sender: 'peer-a',
    timestamp: Date.now(),
    burnMode: 'persist',
    readBy: [],
    destroyed: false,
    ...overrides,
  }
}

function renderTimer(message: Message, onExpired?: () => void) {
  return render(
    <I18nProvider>
      <BurnTimer message={message} onExpired={onExpired} />
    </I18nProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('BurnTimer', () => {
  it('persist 消息：不渲染任何内容，不触发 onExpired', () => {
    const onExpired = vi.fn()
    const { container } = renderTimer(makeMessage(), onExpired)
    expect(container.textContent).toBe('')
    expect(onExpired).not.toHaveBeenCalled()
  })

  it('挂载时已过期的 timed 消息：立即触发一次 onExpired，显示已焚', () => {
    const onExpired = vi.fn()
    const { container } = renderTimer(
      makeMessage({
        burnMode: 'timed',
        burnAfter: 10,
        timestamp: Date.now() - 60_000, // 60 秒前发出、10 秒即焚 → 已过期
      }),
      onExpired,
    )
    expect(onExpired).toHaveBeenCalledTimes(1)
    expect(container.textContent).toMatch(/已焚|Burned/)
  })

  it('未到期的 timed 消息：显示倒计时，随时间推进到期后触发一次 onExpired', () => {
    const onExpired = vi.fn()
    const now = Date.now()
    const { container } = renderTimer(
      makeMessage({ burnMode: 'timed', burnAfter: 30, timestamp: now }),
      onExpired,
    )
    expect(container.textContent).toBe('30s')
    expect(onExpired).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(31_000) // 共享 tick 每秒推进
    })
    expect(onExpired).toHaveBeenCalledTimes(1)
    expect(container.textContent).toMatch(/已焚|Burned/)
  })

  it('read_once 已读消息：视为过期，触发 onExpired', () => {
    const onExpired = vi.fn()
    renderTimer(makeMessage({ burnMode: 'read_once', readBy: ['peer-b'] }), onExpired)
    expect(onExpired).toHaveBeenCalledTimes(1)
  })

  it('回归：同一实例先后收到两条已过期消息，onExpired 各触发一次', () => {
    const onExpired = vi.fn()
    const expired = (id: string) =>
      makeMessage({
        id,
        burnMode: 'timed',
        burnAfter: 5,
        timestamp: Date.now() - 60_000,
      })

    const { rerender } = render(
      <I18nProvider>
        <BurnTimer message={expired('m1')} onExpired={onExpired} />
      </I18nProvider>,
    )
    expect(onExpired).toHaveBeenCalledTimes(1)

    // 关键回归点：修复前 hasExpiredRef 永不重置，第二条消息不会再触发
    rerender(
      <I18nProvider>
        <BurnTimer message={expired('m2')} onExpired={onExpired} />
      </I18nProvider>,
    )
    expect(onExpired).toHaveBeenCalledTimes(2)
  })
})
