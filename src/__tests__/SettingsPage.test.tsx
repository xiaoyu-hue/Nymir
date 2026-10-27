// @vitest-environment jsdom
/**
 * SettingsPage 组件测试（M7）
 * 覆盖：设置页渲染「身份与安全码」入口；点击后打开带外身份核对抽屉（建连前可用，无需 peerId）。
 */
import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SettingsPage from '../ui/components/SettingsPage'
import { I18nProvider } from '../i18n'

vi.mock('../security/securityManager', () => ({
  securityManager: { lock: vi.fn(), isLocked: false, isSetup: true },
}))

vi.mock('../security/e2eeManager', () => ({
  e2eeManager: {
    getOwnIdentityExport: vi.fn(() => ({
      encPub: 'YWxpY2UtdGVzdC1lbmMta2V5',
      signPub: 'YWxpY2UtdGVzdC1zaWduLWtleQ==',
    })),
    getPeerIdentityExport: vi.fn(() => null),
    markPeerVerified: vi.fn(),
  },
}))

function renderSettings() {
  localStorage.setItem('nymir-lang', 'zh')
  return render(
    <I18nProvider>
      <SettingsPage />
    </I18nProvider>,
  )
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('SettingsPage — 身份与安全码入口（M7）', () => {
  it('渲染「身份与安全码」入口行', () => {
    renderSettings()
    expect(screen.getByText('身份与安全码')).toBeTruthy()
  })

  it('点击入口打开带外身份核对抽屉（建连前可用，无需 peerId）', async () => {
    renderSettings()
    fireEvent.click(screen.getByText('身份与安全码'))
    // BottomSheet 打开后展示 OOB 标题
    expect(await screen.findByText('带外身份核对')).toBeTruthy()
  })
})
