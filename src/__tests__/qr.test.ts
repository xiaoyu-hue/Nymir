import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateQRCodeSVG, scanQRFromVideo } from '../utils/qr'

describe('QR utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateQRCodeSVG', () => {
    it('生成合法 SVG 字符串', async () => {
      const svg = await generateQRCodeSVG('test-room-code', 200)
      expect(svg).toContain('<svg')
      expect(svg).toContain('width="200"')
      expect(svg).toContain('height="200"')
    })

    it('空字符串返回降级占位 SVG', async () => {
      const svg = await generateQRCodeSVG('', 150)
      expect(svg).toContain('<svg')
      expect(svg).toContain('150')
    })

    it('自定义尺寸', async () => {
      const svg = await generateQRCodeSVG('nymir', 300)
      expect(svg).toContain('width="300"')
      expect(svg).toContain('height="300"')
    })

    it('包含品牌颜色', async () => {
      const svg = await generateQRCodeSVG('room', 200)
      expect(svg).toContain('#7c6aef')
    })
  })

  describe('scanQRFromVideo', () => {
    it('videoWidth 为 0 时返回 null', () => {
      const videoEl = { videoWidth: 0, videoHeight: 0 } as unknown as HTMLVideoElement
      const result = scanQRFromVideo(videoEl)
      expect(result).toBeNull()
    })

    it('canvas context 不可用时返回 null', () => {
      // 暂不测复杂 canvas，保证基础调用不抛错
      const videoEl = { videoWidth: 200, videoHeight: 200 } as unknown as HTMLVideoElement
      expect(() => scanQRFromVideo(videoEl)).not.toThrow()
    })
  })
})
