// @vitest-environment jsdom
/**
 * SignalingSettings 组件测试
 * 覆盖：标题渲染、保存把自定义地址写入 localStorage、重置清除覆盖。
 */
import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import SignalingSettings from '../ui/components/SignalingSettings'
import { I18nProvider } from '../i18n'

const STORAGE_KEY = 'nymir:signaling-config'

function renderPanel() {
  localStorage.setItem('nymir-lang', 'zh')
  return render(
    <I18nProvider>
      <SignalingSettings open onClose={() => {}} />
    </I18nProvider>,
  )
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('SignalingSettings — 渲染与持久化', () => {
  it('标题与三套策略输入渲染', () => {
    renderPanel()
    expect(screen.getByText('信令设置')).toBeTruthy()
    // 策略名同时出现在「默认策略」下拉选项与各区标题，用 getAllByText 适配
    expect(screen.getAllByText('MQTT').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Nostr').length).toBeGreaterThan(0)
    expect(screen.getAllByText('WebTorrent').length).toBeGreaterThan(0)
  })

  it('保存把自定义 MQTT 地址写入 localStorage', () => {
    renderPanel()
    const textareas = screen.getAllByPlaceholderText(/wss:\/\/\.\.\./)
    const mqtt = textareas[0] as HTMLTextAreaElement
    fireEvent.change(mqtt, { target: { value: 'wss://self-hosted.example:8084/mqtt' } })
    fireEvent.click(screen.getByText('保存'))
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    const cfg = JSON.parse(raw!)
    expect(cfg.mqtt.urls).toContain('wss://self-hosted.example:8084/mqtt')
  })

  it('保存清洗掉非法地址（不写入）', () => {
    renderPanel()
    const textareas = screen.getAllByPlaceholderText(/wss:\/\/\.\.\./)
    const mqtt = textareas[0] as HTMLTextAreaElement
    fireEvent.change(mqtt, { target: { value: 'wss://good.example:8084/mqtt\nftp://bad' } })
    fireEvent.click(screen.getByText('保存'))
    const cfg = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(cfg.mqtt.urls).toEqual(['wss://good.example:8084/mqtt'])
  })

  it('重置清除用户覆盖', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mqtt: { urls: ['wss://x.example'], redundancy: 1 }, nostr: { urls: [], redundancy: 0 }, torrent: { urls: [], redundancy: 0 } }))
    renderPanel()
    fireEvent.click(screen.getByText('恢复默认'))
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
