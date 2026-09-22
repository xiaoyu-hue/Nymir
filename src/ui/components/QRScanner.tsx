import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../../i18n'
import GlassCard from './GlassCard'
import { scanQRFromVideo } from '../../utils/qr'

type Props = {
  onScan: (code: string) => void
  onCancel: () => void
}

export default function QRScanner({ onScan, onCancel }: Props) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number>(0)
  const lastCodeRef = useRef<string>('')
  
  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])
  
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setScanning(true)
        startScanning()
      }
    } catch (e) {
      setError(t.room.cameraError || '无法访问摄像头')
    }
  }
  
  const stopCamera = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setScanning(false)
  }
  
  const startScanning = () => {
    const scan = () => {
      if (!scanning || !videoRef.current || videoRef.current.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(scan)
        return
      }
      
      const code = scanQRFromVideo(videoRef.current)
      if (code && code !== lastCodeRef.current) {
        lastCodeRef.current = code
        onScan(code)
        stopCamera()
        return
      }
      
      animFrameRef.current = requestAnimationFrame(scan)
    }
    scan()
  }
  
  const handleCancel = () => {
    stopCamera()
    onCancel()
  }
  
  return (
    <GlassCard variant="strong" className="qr-scanner-card">
      <div className="qr-scanner-header">
        <h3>{t.room.scanTitle || '扫描二维码'}</h3>
        <button className="qr-scanner-close" onClick={handleCancel}>{t.confirm.cancel || '取消'}</button>
      </div>
      <div className="qr-scanner-body">
        <video ref={videoRef} autoPlay playsInline muted className="qr-scanner-video" />
        <div className="qr-scanner-overlay">
          <div className="qr-scanner-frame" />
        </div>
        {error && <p className="qr-scanner-error">{error}</p>}
        {!error && scanning && <p className="qr-scanner-hint">将二维码对准摄像头</p>}
      </div>
      <div className="qr-scanner-footer">
        <p>{t.room.scanHint || '扫描成功后将自动加入房间'}</p>
      </div>
    </GlassCard>
  )
}
