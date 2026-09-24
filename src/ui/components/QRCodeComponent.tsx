import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../../i18n'
import GlassCard from './GlassCard'
import { generateQRCodeSVG } from '../../utils/qr'

type Props = {
  roomCode: string
  roomName: string
  onClose: () => void
}

export default function QRCodeComponent({ roomCode, roomName, onClose }: Props) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgUrl, setSvgUrl] = useState<string>('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!roomCode) {
      setError('等待房间代码...')
      return
    }

    setError('')
    generateQRCodeSVG(roomCode, 200).then((svg) => {
      if (svg) {
        // 转为 blob URL 避免 dangerouslySetInnerHTML 的 XSS 风险
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)
        setSvgUrl(url)
        return () => URL.revokeObjectURL(url)
      } else {
        setError('二维码生成失败')
      }
    }).catch(() => {
      setError('二维码生成失败')
    })
  }, [roomCode])

  return (
    <div className="qr-modal-overlay" onClick={onClose}>
      <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="qr-modal-close" onClick={onClose}>✕</button>
        <GlassCard variant="strong" className="qr-code-card">
          <div className="qr-code-header">
            <h3 className="qr-code-title">{t.room.qrCodeTitle}</h3>
            <p className="qr-code-room-name">{roomName}</p>
          </div>
          <div className="qr-code-content" ref={containerRef}>
            {svgUrl ? (
              <img src={svgUrl} alt={`QR Code for ${roomName}`} className="qr-svg-img" />
            ) : error ? (
              <p className="qr-code-error">{error}</p>
            ) : (
              <div className="qr-code-loading">生成中...</div>
            )}
          </div>
          <div className="qr-code-footer">
            <p className="qr-code-hint">{t.room.qrCodeHint}</p>
            <p className="qr-code-code">{t.room.shareCode}: <span className="qr-code-code-value">{roomCode}</span></p>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
