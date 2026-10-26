// @vitest-environment jsdom
/**
 * 信令可配置模块测试
 * 覆盖：默认配置兜底、持久化往返、非法 URL 清洗、redundancy 钳制、空列表回退、重置。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SIGNALING,
  loadSignalingConfig,
  saveSignalingConfig,
  resetSignalingConfig,
  type SignalingConfig,
} from '../config/signaling'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('signaling — 默认兜底', () => {
  it('无存储时返回默认配置（深拷贝，互不影响）', () => {
    const cfg = loadSignalingConfig()
    expect(cfg.defaultStrategy).toBe('mqtt')
    expect(cfg.mqtt.urls.length).toBe(DEFAULT_SIGNALING.mqtt.urls.length)
    expect(cfg.nostr.redundancy).toBe(5)
    // 修改返回值不影响 DEFAULT
    cfg.mqtt.urls.push('wss://evil.example')
    expect(DEFAULT_SIGNALING.mqtt.urls).not.toContain('wss://evil.example')
  })

  it('存储内容非法（坏 JSON）时整体回退默认', () => {
    localStorage.setItem('nymir:signaling-config', '{not json')
    const cfg = loadSignalingConfig()
    expect(cfg.mqtt.urls).toEqual(DEFAULT_SIGNALING.mqtt.urls)
  })
})

describe('signaling — 持久化往返', () => {
  it('save 后 load 得到相同配置', () => {
    const custom: SignalingConfig = {
      defaultStrategy: 'nostr',
      mqtt: { urls: ['wss://a.example:8084/mqtt'], redundancy: 1 },
      nostr: { urls: ['wss://b.example'], redundancy: 1 },
      torrent: { urls: ['wss://c.example'], redundancy: 1 },
    }
    saveSignalingConfig(custom)
    const loaded = loadSignalingConfig()
    expect(loaded.defaultStrategy).toBe('nostr')
    expect(loaded.mqtt.urls).toEqual(['wss://a.example:8084/mqtt'])
    expect(loaded.nostr.urls).toEqual(['wss://b.example'])
  })
})

describe('signaling — 校验与清洗', () => {
  it('非法 URL 被丢弃，只保留 wss/ws 合法项', () => {
    const cleaned = saveSignalingConfig({
      defaultStrategy: 'mqtt',
      mqtt: {
        urls: ['wss://good.example:8084/mqtt', 'ftp://bad', 'not-a-url', ''],
        redundancy: 9,
      },
      nostr: DEFAULT_SIGNALING.nostr,
      torrent: DEFAULT_SIGNALING.torrent,
    })
    expect(cleaned.mqtt.urls).toEqual(['wss://good.example:8084/mqtt'])
  })

  it('redundancy 被钳制到 [1, url 数量]', () => {
    const cleaned = saveSignalingConfig({
      defaultStrategy: 'mqtt',
      mqtt: { urls: ['wss://a.example', 'wss://b.example'], redundancy: 99 },
      nostr: DEFAULT_SIGNALING.nostr,
      torrent: DEFAULT_SIGNALING.torrent,
    })
    expect(cleaned.mqtt.redundancy).toBe(2)

    const cleaned2 = saveSignalingConfig({
      defaultStrategy: 'mqtt',
      mqtt: { urls: ['wss://a.example'], redundancy: 0 },
      nostr: DEFAULT_SIGNALING.nostr,
      torrent: DEFAULT_SIGNALING.torrent,
    })
    expect(cleaned2.mqtt.redundancy).toBe(1)
  })

  it('某策略 URLs 为空时回退默认（不静默接受空配置）', () => {
    localStorage.setItem(
      'nymir:signaling-config',
      JSON.stringify({
        mqtt: { urls: [], redundancy: 0 },
      }),
    )
    const loaded = loadSignalingConfig()
    expect(loaded.mqtt.urls).toEqual(DEFAULT_SIGNALING.mqtt.urls)
    expect(loaded.mqtt.redundancy).toBe(DEFAULT_SIGNALING.mqtt.redundancy)
  })

  it('非法 defaultStrategy 回退默认', () => {
    localStorage.setItem(
      'nymir:signaling-config',
      JSON.stringify({ defaultStrategy: 'ftp' }),
    )
    expect(loadSignalingConfig().defaultStrategy).toBe('mqtt')
  })
})

describe('signaling — 重置', () => {
  it('reset 后恢复默认', () => {
    saveSignalingConfig({
      defaultStrategy: 'torrent',
      mqtt: DEFAULT_SIGNALING.mqtt,
      nostr: DEFAULT_SIGNALING.nostr,
      torrent: DEFAULT_SIGNALING.torrent,
    })
    resetSignalingConfig()
    expect(loadSignalingConfig().defaultStrategy).toBe('mqtt')
  })
})
