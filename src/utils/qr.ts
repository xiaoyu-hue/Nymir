/**
 * QR 码工具函数
 * 使用浏览器原生能力和 CDN 库实现 QR 码生成与识别
 */

/**
 * 动态加载脚本
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

let qrcodeLib: any = null
let jsqrLib: any = null

/**
 * 初始化 QR 码库
 */
async function initLibraries() {
  if (typeof (window as any).QRCode !== 'undefined') {
    qrcodeLib = (window as any).QRCode
  }
  if (typeof (window as any).jsQR !== 'undefined') {
    jsqrLib = (window as any).jsQR
  }
}

/**
 * 生成 QR 码 SVG 字符串
 */
export async function generateQRCodeSVG(text: string, size: number = 200): Promise<string> {
  try {
    await initLibraries()
    
    // 如果库已加载，直接使用
    if (qrcodeLib) {
      return qrcodeLib.toString(text, {
        type: 'svg',
        width: size,
        margin: 2,
        color: {
          dark: '#7c6aef',
          light: '#ffffff'
        }
      })
    }
    
    // 否则动态加载
    await loadScript('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js')
    const QRCode = (window as any).QRCode
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
    
    // 动态加载 jsqr
    if (typeof (window as any).jsQR === 'undefined') {
      loadScript('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js')
    }
    
    const code = (window as any).jsQR?.(imageData.data, imageData.width, imageData.height)
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
    await initLibraries()
    
    if (qrcodeLib) {
      return await qrcodeLib.toDataURL(text, {
        width: size,
        margin: 2,
        color: {
          dark: '#7c6aef',
          light: '#ffffff'
        }
      })
    }
    
    await loadScript('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js')
    const QRCode = (window as any).QRCode
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
