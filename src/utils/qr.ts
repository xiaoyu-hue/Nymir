/**
 * QR 码工具函数
 * 使用本地安装的 npm 包实现 QR 码生成与识别
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
        light: '#ffffff'
      }
    })
  } catch (error) {
    console.error('QR code generation failed:', error)
    // 返回一个简单的占位符
    return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" fill="#7c6aef"/><text x="50%" y="50%" text-anchor="middle" fill="white" font-size="14">${text}</text></svg>`
  }
}

/**
 * 从视频帧中识别 QR 码
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
  } catch (error) {
    console.error('QR code scanning failed:', error)
    return null
  }
}

/**
 * 生成 QR 码 Data URL
 */
export async function generateQRCodeDataURL(text: string, size: number = 200): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: size,
      margin: 2,
      color: {
        dark: '#7c6aef',
        light: '#ffffff'
      }
    })
  } catch (error) {
    console.error('QR code generation failed:', error)
    return ''
  }
}
