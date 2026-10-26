import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import GlassCard from './GlassCard'
import { useI18n } from '../../i18n'
import {
  loadSignalingConfig,
  saveSignalingConfig,
  resetSignalingConfig,
  DEFAULT_SIGNALING,
  type SignalingStrategy,
  type SignalingConfig,
} from '../../config/signaling'

type Props = {
  onClose: () => void
}

interface StrategyState {
  urls: string
  redundancy: number
}

function configToState(cfg: SignalingConfig) {
  return {
    defaultStrategy: cfg.defaultStrategy,
    mqtt: { urls: cfg.mqtt.urls.join('\n'), redundancy: cfg.mqtt.redundancy },
    nostr: { urls: cfg.nostr.urls.join('\n'), redundancy: cfg.nostr.redundancy },
    torrent: { urls: cfg.torrent.urls.join('\n'), redundancy: cfg.torrent.redundancy },
  }
}

const STRATEGIES: { key: SignalingStrategy; labelKey: 'strategyMqtt' | 'strategyNostr' | 'strategyTorrent' }[] = [
  { key: 'mqtt', labelKey: 'strategyMqtt' },
  { key: 'nostr', labelKey: 'strategyNostr' },
  { key: 'torrent', labelKey: 'strategyTorrent' },
]

export default function SignalingSettings({ onClose }: Props) {
  const { t } = useI18n()
  const [defaultStrategy, setDefaultStrategy] = useState<SignalingStrategy>('mqtt')
  const [strategies, setStrategies] = useState<Record<SignalingStrategy, StrategyState>>({
    mqtt: { urls: '', redundancy: 5 },
    nostr: { urls: '', redundancy: 5 },
    torrent: { urls: '', redundancy: 5 },
  })
  const [status, setStatus] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const cfg = loadSignalingConfig()
    const s = configToState(cfg)
    setDefaultStrategy(s.defaultStrategy)
    setStrategies({ mqtt: s.mqtt, nostr: s.nostr, torrent: s.torrent })
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const setStrategy = (key: SignalingStrategy, patch: Partial<StrategyState>) => {
    setStrategies((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
    setSaved(false)
  }

  const handleSave = useCallback(() => {
    const build = (key: SignalingStrategy) => {
      const urls = strategies[key].urls
        .split('\n')
        .map((u) => u.trim())
        .filter(Boolean)
      return { urls, redundancy: strategies[key].redundancy }
    }
    const cleaned = saveSignalingConfig({
      defaultStrategy,
      mqtt: build('mqtt'),
      nostr: build('nostr'),
      torrent: build('torrent'),
    })
    // 回显清洗后的真实值（非法 URL 已被丢弃）
    const s = configToState(cleaned)
    setDefaultStrategy(s.defaultStrategy)
    setStrategies({ mqtt: s.mqtt, nostr: s.nostr, torrent: s.torrent })
    setStatus(t.signaling.saved)
    setSaved(true)
  }, [strategies, defaultStrategy, t])

  const handleReset = useCallback(() => {
    resetSignalingConfig()
    const s = configToState(DEFAULT_SIGNALING)
    setDefaultStrategy(s.defaultStrategy)
    setStrategies({ mqtt: s.mqtt, nostr: s.nostr, torrent: s.torrent })
    setStatus('')
    setSaved(false)
  }, [t])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.signaling.title}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <GlassCard variant="strong" className="modal-enter">
          <div style={{ padding: '24px', minWidth: 'min(360px, 90vw)', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 600 }}>{t.signaling.title}</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.5 }}>{t.signaling.desc}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="signaling-default" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t.signaling.defaultStrategy}</label>
              <select
                id="signaling-default"
                value={defaultStrategy}
                onChange={(e) => { setDefaultStrategy(e.target.value as SignalingStrategy); setSaved(false) }}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.25)',
                  color: 'var(--text-primary)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '10px',
                  fontSize: '0.85rem',
                }}
              >
                {STRATEGIES.map((s) => (
                  <option key={s.key} value={s.key}>{t.signaling[s.labelKey]}</option>
                ))}
              </select>
            </div>

            {STRATEGIES.map((s) => (
              <div key={s.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>{t.signaling[s.labelKey]}</label>
                <textarea
                  value={strategies[s.key].urls}
                  onChange={(e) => setStrategy(s.key, { urls: e.target.value })}
                  placeholder={`wss://...\nwss://...`}
                  rows={Math.min(3, Math.max(2, strategies[s.key].urls.split('\n').filter(Boolean).length || 2))}
                  spellCheck={false}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.25)',
                    color: 'var(--text-primary)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    padding: '10px',
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '0.8rem',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t.signaling.redundancyLabel}</label>
                  <input
                    type="number"
                    min={1}
                    value={strategies[s.key].redundancy}
                    onChange={(e) => setStrategy(s.key, { redundancy: Math.max(1, Number(e.target.value) || 1) })}
                    style={{
                      width: '70px',
                      background: 'rgba(0,0,0,0.25)',
                      color: 'var(--text-primary)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      padding: '6px',
                      fontSize: '0.8rem',
                    }}
                  />
                </div>
              </div>
            ))}

            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.72rem', lineHeight: 1.4, opacity: 0.8 }}>{t.signaling.emptyUrlsHint}</p>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.72rem', lineHeight: 1.4, opacity: 0.8 }}>{t.signaling.noteCsp}</p>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleReset}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                }}
              >
                {t.signaling.reset}
              </button>
              <button
                onClick={handleSave}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'rgba(52,211,153,0.2)',
                  color: 'var(--success, #34d399)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  border: '1px solid rgba(52,211,153,0.3)',
                }}
              >
                {t.signaling.save}
              </button>
            </div>

            {status && (
              <p style={{ margin: 0, textAlign: 'center', color: saved ? 'var(--success, #34d399)' : 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {status}
              </p>
            )}

            <button onClick={onClose} style={{ padding: '10px', borderRadius: '12px', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {t.backup.close}
            </button>
          </div>
        </GlassCard>
      </div>
    </div>,
    document.body,
  )
}
