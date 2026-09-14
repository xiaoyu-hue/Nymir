// @vitest-environment jsdom
/**
 * ChatView 密钥轮换入口测试
 *
 * 覆盖：有对端时显示换钥按钮、确认弹窗流程、成功/失败横幅反馈、取消不调用。
 * messageManager / e2eeManager / useRoom 用 vi.mock 隔离。
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ChatView from '../ui/components/ChatView'
import { I18nProvider } from '../i18n'

vi.mock('../ui/hooks/useRoom', () => ({
  useRoom: () => ({
    status: 'connected',
    room: { id: 'room-1', name: '测试房间', peers: ['peer-a'] },
  }),
}))

vi.mock('../App', () => ({
  useKeyboard: () => ({ keyboardOpen: false, viewportHeight: 800 }),
}))

const { rotateKeys } = vi.hoisted(() => ({ rotateKeys: vi.fn() }))
vi.mock('../core/message', () => ({
  messageManager: {
    getMessages: () => [],
    onMessage: () => () => {},
    markRead: vi.fn(),
    send: vi.fn(),
    rotateKeys,
  },
}))

vi.mock('../core/room', () => ({
  roomManager: { leave: vi.fn() },
}))

vi.mock('../communication/peer', () => ({
  peerManager: { id: 'local-self' },
}))

vi.mock('../security/e2eeManager', () => ({
  e2eeManager: {
    getVerificationState: vi.fn(async () => 'verified'),
  },
}))

function renderChat() {
  localStorage.setItem('nymir-lang', 'zh')
  return render(
    <I18nProvider>
      <ChatView />
    </I18nProvider>,
  )
}

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  rotateKeys.mockReset()
  // jsdom 未实现 scrollIntoView，mock 掉避免渲染报错
  Element.prototype.scrollIntoView = vi.fn()
})

describe('ChatView 密钥轮换入口', () => {
  it('有对端时显示换钥按钮', () => {
    renderChat()
    expect(screen.getByLabelText('安全换钥')).toBeTruthy()
  })

  it('点击换钥 → 确认弹窗 → 确认后调用 rotateKeys 并显示成功横幅', async () => {
    rotateKeys.mockResolvedValue(true)
    renderChat()
    fireEvent.click(screen.getByLabelText('安全换钥'))
    // 确认弹窗出现
    expect(screen.getByText(/将生成新的加密密钥/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认' }))
    await waitFor(() => expect(rotateKeys).toHaveBeenCalledTimes(1))
    expect(screen.getByText(/密钥已轮换/)).toBeTruthy()
  })

  it('rotateKeys 返回 false 时显示失败横幅', async () => {
    rotateKeys.mockResolvedValue(false)
    renderChat()
    fireEvent.click(screen.getByLabelText('安全换钥'))
    fireEvent.click(screen.getByRole('button', { name: '确认' }))
    await waitFor(() => expect(screen.getByText(/换钥失败/)).toBeTruthy())
  })

  it('取消确认时不调用 rotateKeys', async () => {
    renderChat()
    fireEvent.click(screen.getByLabelText('安全换钥'))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(rotateKeys).not.toHaveBeenCalled()
  })
})
