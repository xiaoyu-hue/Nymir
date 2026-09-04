import { useState } from 'react'
import { useI18n } from '../../i18n'
import { isValidRoomId } from '../../utils/id'
import GlassCard from './GlassCard'

type Props = {
  onCreateRoom: (name: string) => void
  onJoinRoom: (roomId: string) => void
}

export default function RoomPanel({ onCreateRoom, onJoinRoom }: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [error, setError] = useState('')

  const handleJoin = () => {
    const code = roomId.trim().toUpperCase()
    if (!code) return

    if (!isValidRoomId(code)) {
      setError(t.room.invalidCode)
      return
    }

    setError('')
    onJoinRoom(code)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: '24px',
        padding: '24px',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <h1
          style={{
            fontSize: '2.5rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #fff, var(--accent))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '8px',
          }}
        >
          Nymir
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
          {t.app.subtitle}
        </p>
      </div>

      <GlassCard variant="strong" className="room-panel-card">
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--glass-border)',
          }}
        >
          <button
            onClick={() => setTab('create')}
            style={{
              flex: 1,
              padding: '12px',
              background: tab === 'create' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: tab === 'create' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '0.9rem',
              borderBottom: tab === 'create' ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            {t.room.create}
          </button>
          <button
            onClick={() => setTab('join')}
            style={{
              flex: 1,
              padding: '12px',
              background: tab === 'join' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: tab === 'join' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '0.9rem',
              borderBottom: tab === 'join' ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            {t.room.join}
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {tab === 'create' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input
                type="text"
                placeholder={t.room.createName}
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                }}
              />
              <button
                onClick={() => name.trim() && onCreateRoom(name.trim())}
                disabled={!name.trim()}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: name.trim()
                    ? 'linear-gradient(135deg, var(--accent), #5b4bc9)'
                    : 'rgba(255,255,255,0.05)',
                  color: name.trim() ? 'white' : 'var(--text-muted)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                }}
              >
                {t.room.createBtn}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input
                type="text"
                placeholder={t.room.joinPlaceholder}
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value.toUpperCase())
                  setError('')
                }}
                maxLength={9}
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: error ? '1px solid var(--danger)' : '1px solid var(--glass-border)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  letterSpacing: '2px',
                  textAlign: 'center',
                }}
              />
              {error && (
                <p style={{ color: 'var(--danger)', fontSize: '0.8rem', textAlign: 'center' }}>
                  {error}
                </p>
              )}
              <button
                onClick={handleJoin}
                disabled={!roomId.trim()}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: roomId.trim()
                    ? 'linear-gradient(135deg, var(--accent), #5b4bc9)'
                    : 'rgba(255,255,255,0.05)',
                  color: roomId.trim() ? 'white' : 'var(--text-muted)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                }}
              >
                {t.room.joinBtn}
              </button>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  )
}
