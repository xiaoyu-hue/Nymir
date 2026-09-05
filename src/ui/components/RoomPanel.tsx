import { useState } from 'react'
import { useI18n } from '../../i18n'
import GlassCard from './GlassCard'

type Props = {
  onCreateRoom: (name: string) => void
  onJoinRoom: (code: string) => void
}

export default function RoomPanel({ onCreateRoom, onJoinRoom }: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<'create' | 'join'>('create')
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
    <div className="page-enter room-panel-container">
      <GlassCard variant="strong" className="room-panel-card" onClick={(e) => e?.stopPropagation()}>
        <div className="room-panel-inner">
          <div className="room-panel-title">
            <h1 className="room-panel-heading">{t.app.title}</h1>
            <p className="room-panel-subtitle">{t.app.subtitle}</p>
          </div>

          <div className="room-panel-tabs">
            {(['create', 'join'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`room-panel-tab ${tab === key ? 'active' : ''}`}
              >
                {key === 'join' ? t.room.joinTitle : t.room.createTitle}
              </button>
            ))}
          </div>

          <div className="room-panel-form">
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
                  className="room-panel-input room-panel-input-name"
                />
                <button
                  onClick={handleCreate}
                  disabled={!name.trim()}
                  className={`room-panel-submit ${name.trim() ? 'ready' : ''}`}
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
