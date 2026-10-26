// @vitest-environment jsdom
/**
 * OutOfBandVerify 组件测试
 * 覆盖：分享标签页渲染我的身份串；核对标签页粘贴对方串后算出安全码。
 * e2eeManager 用 vi.mock 隔离（不跑真密码学，只提供身份导出）。
 */
import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OutOfBandVerify from '../ui/components/OutOfBandVerify'
import { I18nProvider } from '../i18n'
import { serializeIdentity, type IdentityKeys } from '../security/outOfBand'

const alice: IdentityKeys = {
  encPub: 'YWxpY2UtdGVzdC1lbmMta2V5LTAxMjM0NTY3ODk=',
  signPub: 'YWxpY2UtdGVzdC1zaWduLWtleS0wMTIzNDU2Nzg5',
}
const bob: IdentityKeys = {
  encPub: 'Ym9iLXRlc3QtZW5jLWtleS0wMTIzNDU2Nzg5',
  signPub: 'Ym9iLXRlc3Qtc2lnbi1rZXktMDEyMzQ1Njc4OQ==',
}

vi.mock('../security/e2eeManager', () => ({
  e2eeManager: {
    getOwnIdentityExport: vi.fn(() => ({ encPub: alice.encPub, signPub: alice.signPub })),
    getPeerIdentityExport: vi.fn(() => null),
    markPeerVerified: vi.fn(),
  },
}))

function renderOob() {
  localStorage.setItem('nymir-lang', 'zh')
  return render(
    <I18nProvider>
      <OutOfBandVerify peerId={null} onClose={() => {}} />
    </I18nProvider>,
  )
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('OutOfBandVerify — 分享与核对', () => {
  it('分享标签页渲染我的身份串（nymir1: 前缀）', () => {
    renderOob()
    const ta = document.querySelector('textarea[readonly]') as HTMLTextAreaElement
    expect(ta).toBeTruthy()
    expect(ta.value.startsWith('nymir1:')).toBe(true)
  })

  it('核对标签页：粘贴对方串后算出安全码', async () => {
    renderOob()
    fireEvent.click(screen.getByText('核对对方身份'))
    const ta = screen.getByPlaceholderText('nymir1:...') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: serializeIdentity(bob) } })
    fireEvent.click(screen.getByText('计算安全码'))
    // 安全码为 15 位数字（3 组×5，含空格），出现即说明指纹已计算
    await screen.findByText(/\d{5} \d{5} \d{5}/)
    expect(screen.getByText('共同安全码')).toBeTruthy()
  })

  it('非法串不计算（保持等待提示）', async () => {
    renderOob()
    fireEvent.click(screen.getByText('核对对方身份'))
    const ta = screen.getByPlaceholderText('nymir1:...') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'not-a-valid-string' } })
    fireEvent.click(screen.getByText('计算安全码'))
    expect(await screen.findByText('身份串格式不正确')).toBeTruthy()
  })
})
