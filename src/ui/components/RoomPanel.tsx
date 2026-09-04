import { useState } from 'react'
import { useI18n } from '../../i18n'
import GlassCard from './GlassCard'

type Props = {
  onCreateRoom: (name: string) => void
  onJoinRoom: (code: string) => void
}

export default function RoomPanel({ onCreateRoom, onJoinRoom }: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<'create' | 'join'>('join')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  const handleCreate = () => {
    if (!name.trim()) return
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

  return (
    <div
      className="page-enter"
      style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '60px 20px 80px',
      }}
    >
      <GlassCard variant="strong" className="room-panel-card" onClick={(e) => e?.stopPropagation()}>
        <div style={{ padding: '24px' }}>
          {/* Logo / Title */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1
              style={{
                fontSize: '1.6rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '4px',
              }}
            >
              {t.app.title}
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {t.app.subtitle}
            </p>
          </div>

          {/* Tab buttons */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: '10px',
              padding: '4px',
              marginBottom: '20px',
            }}
          >
            {(['join', 'create'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  background: tab === key ? 'rgba(124,106,239,0.25)' : 'transparent',
                  color: tab === key ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                {key === 'join' ? t.room.joinTitle : t.room.createTitle}
              </button>
            ))}
          </div>

          {/* Tab content with animation */}
          <div style={{ position: 'relative', minHeight: '140px' }}>
            {tab === 'join' ? (
              <div key="join" className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label
                  htmlFor="room-code"
                  style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                >
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
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid var(--glass-border)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-primary)',
                    fontSize: '1.1rem',
                    letterSpacing: '3px',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    boxSizing: 'border-box',
                    width: '100%',
                  }}
                />
                <button
                  onClick={handleJoin}
                  disabled={!code.trim()}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    background: code.trim()
                      ? 'linear-gradient(135deg, var(--accent), #5b4bc9)'
                      : 'rgba(255,255,255,0.05)',
                    color: code.trim() ? 'white' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    marginTop: '8px',
                  }}
                >
                  {t.room.join}
                </button>
              </div>
            ) : (
              <div key="create" className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label
                  htmlFor="room-name"
                  style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                >
                  {t.room.nameLabel}
                </label>
                <input
                  id="room-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t.room.namePlaceholder}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid var(--glass-border)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                    width: '100%',
                  }}
                />
                <button
                  onClick={handleCreate}
                  disabled={!name.trim()}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    background: name.trim()
                      ? 'linear-gradient(135deg, var(--accent), #5b4bc9)'
                      : 'rgba(255,255,255,0.05)',
                    color: name.trim() ? 'white' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    marginTop: '8px',
                  }}
                >
                  {t.room.create}
                </button>
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
