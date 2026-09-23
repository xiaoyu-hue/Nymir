/**
 * QR 码工具函数
 * 使用本地 npm 包实现二维码生成与识别
 */
import QRCode from 'qrcode'
import jsQR from 'jsqr'

/**
 * 生成 QR 码 SVG 字符串
 */
export async function generateQRCodeSVG(text: string, size: number = 200): Promise<string> {
  try {
    return await QRCode.toString(text, {
      type: 'svg',
      width: size,
      margin: 2,
      color: {
        dark: '#7c6aef',
        light: '#ffffff',
      },
    })
  } catch {
    // 降级：返回占位 SVG
    // 注意：text 来自用户输入的 room code（纯字母数字），此处做 HTML 实体转义
    // 防止降级路径下 dangerouslySetInnerHTML 的 XSS 风险
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
    return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" fill="#7c6aef"/><text x="50%" y="50%" text-anchor="middle" fill="white" font-size="14">${escaped}</text></svg>`
  }
}

/**
 * 从视频帧中识别 QR 码
 * @returns 解码后的文本，失败返回 null
 */
export function scanQRFromVideo(videoElement: HTMLVideoElement): string | null {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = videoElement.videoWidth
    canvas.height = videoElement.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    const code = jsQR(imageData.data, imageData.width, imageData.height)
    return code ? code.data : null
  } catch {
    return null
  }
}

/**
 * 检测浏览器是否支持摄像头扫码
 */
export async function isCameraAvailable(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    stream.getTracks().forEach((track) => track.stop())
    return true
  } catch {
    return false
  }
}
