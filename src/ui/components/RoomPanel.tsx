import { useState, useEffect } from 'react'
import { useI18n } from '../../i18n'
import GlassCard from './GlassCard'
import QRCodeComponent from './QRCodeComponent'
import QRScanner from './QRScanner'
type Props = {
  onCreateRoom: (name: string) => void
  onJoinRoom: (code: string) => void
  error?: string
  onRoomCreated?: (roomCode: string) => void
}

export default function RoomPanel({ onCreateRoom, onJoinRoom, error, onRoomCreated }: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [showQR, setShowQR] = useState(false)
  const [showScan, setShowScan] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [creating, setCreating] = useState(false)
  
  useEffect(() => {
    if (roomCode && showQR === false) {
      // 有房间代码且未显示二维码时，自动显示
      setShowQR(true)
    }
  }, [roomCode])
  
  const handleCreate = async () => {
    if (!name.trim() || creating) return
    setCreating(true)
    onCreateRoom(name.trim())
    // 模拟延迟后设置房间代码（实际应由父组件回调）
    setTimeout(() => {
      const tempCode = 'ABC-123-XYZ' // 占位符，实际应使用真实代码
      setRoomCode(tempCode)
      onRoomCreated?.(tempCode)
      setCreating(false)
    }, 500)
  }
  
  const handleJoin = () => {
    if (!code.trim()) return
    onJoinRoom(code.trim().toUpperCase())
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (tab === 'create') handleCreate()
      else handleJoin()
    }
  }
  
  const handleScanSuccess = (scannedCode: string) => {
    setShowScan(false)
    onJoinRoom(scannedCode.toUpperCase())
  }
  
  return (
    <div className="page-enter room-panel-container">
      <GlassCard variant="strong" className="room-panel-card" onClick={(e) => e?.stopPropagation()}>
        <div className="room-panel-inner">
          <div className="room-panel-title">
            <h1 className="room-panel-heading">{t.app.title}</h1>
            <p className="room-panel-subtitle">{t.app.subtitle}</p>
          </div>
          <div className="room-panel-tabs" role="tablist">
            {(['create', 'join'] as const).map((key) => (
              <button
                key={key}
                id={`tab-${key}`}
                onClick={() => setTab(key)}
                role="tab"
                aria-selected={tab === key}
                className={`room-panel-tab ${tab === key ? 'active' : ''}`}
              >
                {key === 'join' ? t.room.joinTitle : t.room.createTitle}
              </button>
            ))}
          </div>
          <div className="room-panel-form" role="tabpanel" aria-labelledby={tab === 'create' ? 'tab-create' : 'tab-join'}>
            {tab === 'join' ? (
              <div key="join" className="page-enter room-panel-fields">
                <label htmlFor="room-code" className="room-panel-label">
                  {t.room.codeLabel}
                </label>
                <input
                  id="room-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={handleKeyDown}
                  placeholder={t.room.codePlaceholder}
                  maxLength={9}
                  className="room-panel-input room-panel-input-code"
                />
                <button
                  onClick={handleJoin}
                  disabled={!code.trim()}
                  className={`room-panel-submit ${code.trim() ? 'ready' : ''}`}
                >
                  {t.room.join}
                </button>
                <div className="room-panel-divider">
                  <span>{t.room.orEnterCode}</span>
                </div>
                <button
                  onClick={() => setShowScan(true)}
                  className="room-panel-qr-btn"
                  type="button"
                >
                  📷 {t.room.scanTitle}
                </button>
              </div>
            ) : (
              <div key="create" className="page-enter room-panel-fields">
                <label htmlFor="room-name" className="room-panel-label">
                  {t.room.nameLabel}
                </label>
                <input
                  id="room-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t.room.namePlaceholder}
                  maxLength={50}
                  className="room-panel-input room-panel-input-name"
                  disabled={creating}
                />
                <button
                  onClick={handleCreate}
                  disabled={!name.trim() || creating}
                  className={`room-panel-submit ${name.trim() && !creating ? 'ready' : ''}`}
                >
                  {creating ? '...' : t.room.create}
                </button>
              </div>
            )}
            {error && (
              <p className="room-panel-error" role="alert">{error}</p>
            )}
          </div>
        </div>
      </GlassCard>
      
      {showQR && roomCode && (
        <div className="qr-modal-overlay" onClick={() => setShowQR(false)}>
          <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>
            <QRCodeComponent roomCode={roomCode} roomName={name} />
            <button
              onClick={() => setShowQR(false)}
              className="qr-modal-close"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      {showScan && (
        <div className="qr-modal-overlay" onClick={() => setShowScan(false)}>
          <div className="qr-modal-content qr-scanner-modal" onClick={(e) => e.stopPropagation()}>
            <QRScanner
              onScan={handleScanSuccess}
              onCancel={() => setShowScan(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
