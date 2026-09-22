import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../../i18n'
import GlassCard from './GlassCard'
import { generateQRCodeSVG } from '../../utils/qr'

type Props = {
  roomCode: string
  roomName: string
}

export default function QRCodeComponent({ roomCode, roomName }: Props) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  
  useEffect(() => {
    if (!roomCode) {
      setError('等待房间代码...')
      return
    }
    
    setError('')
    generateQRCodeSVG(roomCode, 200).then(svg => {
      if (svg) {
        setSvg(svg)
      } else {
        setError('二维码生成失败')
      }
    }).catch(err => {
      console.error('QR generation error:', err)
      setError('二维码生成失败')
    })
  }, [roomCode])
  
  return (
    <GlassCard variant="strong" className="qr-code-card">
      <div className="qr-code-header">
        <h3 className="qr-code-title">{t.room.qrCodeTitle}</h3>
        <p className="qr-code-room-name">{roomName}</p>
      </div>
      <div className="qr-code-content" ref={containerRef}>
        {svg ? (
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        ) : error ? (
          <p className="qr-code-error">{error}</p>
        ) : (
          <div className="qr-code-loading">生成中...</div>
        )}
      </div>
      <div className="qr-code-footer">
        <p className="qr-code-hint">{t.room.qrCodeHint}</p>
        <p className="qr-code-code">{t.room.roomCode}: <span className="qr-code-code-value">{roomCode}</span></p>
      </div>
    </GlassCard>
  )
}
