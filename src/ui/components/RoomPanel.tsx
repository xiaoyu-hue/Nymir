import { useState, useEffect } from 'react'
import { useI18n } from '../../i18n'
import GlassCard from './GlassCard'
import QRCodeComponent from './QRCodeComponent'
import QRScanner from './QRScanner'

type Props = {
  onCreateRoom: (name: string) => void
  onJoinRoom: (code: string) => void
  error?: string
}

export default function RoomPanel({ onCreateRoom, onJoinRoom, error }: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [showQR, setShowQR] = useState(false)
  const [showScan, setShowScan] = useState(false)
  const [roomCode, setRoomCode] = useState('')

  useEffect(() => {
    if (roomCode && !showQR) {
      setShowQR(true)
    }
  }, [roomCode, showQR])

  useEffect(() => {
    // 监听 App 侧的房间创建事件
    const handler = (e: Event) => {
      const { detail } = e as CustomEvent
      if (detail) setRoomCode(detail)
    }
    window.addEventListener('nymir:roomCreated', handler)
    return () => window.removeEventListener('nymir:roomCreated', handler)
  }, [])

  const handleCreate = () => {
    if (!name.trim()) return
    // App 侧会设置 roomCode，通过轮询检查
    onCreateRoom(name.trim())
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
                  type="button"
                  className="room-panel-qr-btn"
                  onClick={() => setShowScan(true)}
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
                />
                <button
                  onClick={() => {
                    handleCreate()
                    // roomCode will be set via the callback passed to onCreateRoom
                  }}
                  disabled={!name.trim()}
                  className={`room-panel-submit ${name.trim() ? 'ready' : ''}`}
                >
                  {t.room.create}
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
        <QRCodeComponent
          roomCode={roomCode}
          roomName={name}
          onClose={() => setShowQR(false)}
        />
      )}

      {showScan && (
        <QRScanner
          onScan={handleScanSuccess}
          onCancel={() => setShowScan(false)}
        />
      )}
    </div>
  )
}
