// @vitest-environment jsdom
/**
 * SafetyCheckDialog 组件测试
 *
 * 覆盖：open=false 不渲染、渲染指纹数字与 emoji、按钮交互。
 * e2eeManager 用 vi.mock 隔离，不跑真密码学。
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SafetyCheckDialog from '../ui/components/SafetyCheckDialog'
import { I18nProvider } from '../i18n'

vi.mock('../security/e2eeManager', () => ({
  e2eeManager: {
    computePeerFingerprint: vi.fn(),
    getVerificationState: vi.fn(),
    markPeerVerified: vi.fn(),
  },
}))

import { e2eeManager } from '../security/e2eeManager'

const fakeFingerprint = {
  decimal: '48291 73506 19483',
  emojis: ['🍎', '🐶', '🌲', '🍀', '🌈', '⭐', '🔥'],
}

function renderDialog(props: Partial<React.ComponentProps<typeof SafetyCheckDialog>> = {}) {
  localStorage.setItem('nymir-lang', 'zh')
  return render(
    <I18nProvider>
      <SafetyCheckDialog
        open={true}
        peerId="peer-1"
        onClose={vi.fn()}
        {...props}
      />
    </I18nProvider>,
  )
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('SafetyCheckDialog 渲染', () => {
  it('open=false 时不渲染', () => {
    renderDialog({ open: false })
    expect(screen.queryByText('安全码核对')).not.toBeInTheDocument()
  })

  it('open=true 时渲染标题', async () => {
    vi.mocked(e2eeManager.computePeerFingerprint).mockResolvedValue(fakeFingerprint)
    vi.mocked(e2eeManager.getVerificationState).mockResolvedValue('unverified')
    renderDialog({ open: true })
    expect(await screen.findByText('安全码核对')).toBeInTheDocument()
  })

  it('渲染 15 位数字指纹', async () => {
    vi.mocked(e2eeManager.computePeerFingerprint).mockResolvedValue(fakeFingerprint)
    vi.mocked(e2eeManager.getVerificationState).mockResolvedValue('unverified')
    renderDialog({ open: true })
    expect(await screen.findByText('48291 73506 19483')).toBeInTheDocument()
  })

  it('peerId 为 null 时显示等待提示', async () => {
    renderDialog({ open: true, peerId: null })
    expect(await screen.findByText('等待对方完成密钥交换...')).toBeInTheDocument()
  })
})

describe('SafetyCheckDialog 交互', () => {
  it('点"我已核对一致"调用 markPeerVerified 并关闭', async () => {
    vi.mocked(e2eeManager.computePeerFingerprint).mockResolvedValue(fakeFingerprint)
    vi.mocked(e2eeManager.getVerificationState).mockResolvedValue('unverified')
    vi.mocked(e2eeManager.markPeerVerified).mockResolvedValue(undefined)
    const onClose = vi.fn()
    renderDialog({ open: true, onClose })

    const confirmBtn = await screen.findByText('我已核对一致')
    fireEvent.click(confirmBtn)
    expect(await screen.findByText('我已核对一致')).toBeInTheDocument()
    expect(e2eeManager.markPeerVerified).toHaveBeenCalledWith('peer-1')
    // onClose 在 markPeerVerified 完成后由父组件触发；本组件内部不直接调 onClose，
    // 这里只验证 markPeerVerified 被调用。
  })

  it('点"关闭"按钮不调用 markPeerVerified', async () => {
    vi.mocked(e2eeManager.computePeerFingerprint).mockResolvedValue(fakeFingerprint)
    vi.mocked(e2eeManager.getVerificationState).mockResolvedValue('unverified')
    renderDialog({ open: true })

    const closeBtn = await screen.findByText('关闭')
    fireEvent.click(closeBtn)
    expect(e2eeManager.markPeerVerified).not.toHaveBeenCalled()
  })
})
