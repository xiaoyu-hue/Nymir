import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../../i18n'
import {
  loadSignalingConfig,
  saveSignalingConfig,
  resetSignalingConfig,
  DEFAULT_SIGNALING,
  type SignalingStrategy,
  type SignalingConfig,
} from '../../config/signaling'
import BottomSheet from './BottomSheet'

type Props = {
  open: boolean
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

export default function SignalingSettings({ open, onClose }: Props) {
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
    if (!open) return
    const cfg = loadSignalingConfig()
    const s = configToState(cfg)
    setDefaultStrategy(s.defaultStrategy)
    setStrategies({ mqtt: s.mqtt, nostr: s.nostr, torrent: s.torrent })
  }, [open])

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

  return (
    <BottomSheet open={open} onClose={onClose} title={t.signaling.title}>
      <div className="signaling-body">
        <p className="signaling-desc">{t.signaling.desc}</p>

        <div className="signaling-field">
          <label htmlFor="signaling-default" className="signaling-label">{t.signaling.defaultStrategy}</label>
          <select
            id="signaling-default"
            value={defaultStrategy}
            onChange={(e) => { setDefaultStrategy(e.target.value as SignalingStrategy); setSaved(false) }}
            className="signaling-select"
          >
            {STRATEGIES.map((s) => (
              <option key={s.key} value={s.key}>{t.signaling[s.labelKey]}</option>
            ))}
          </select>
        </div>

        {STRATEGIES.map((s) => (
          <div key={s.key} className="signaling-field">
            <label className="signaling-label">{t.signaling[s.labelKey]}</label>
            <textarea
              value={strategies[s.key].urls}
              onChange={(e) => setStrategy(s.key, { urls: e.target.value })}
              placeholder={`wss://...\nwss://...`}
              rows={Math.min(3, Math.max(2, strategies[s.key].urls.split('\n').filter(Boolean).length || 2))}
              spellCheck={false}
              className="signaling-textarea"
            />
            <div className="signaling-redundancy">
              <label className="signaling-label">{t.signaling.redundancyLabel}</label>
              <input
                type="number"
                min={1}
                value={strategies[s.key].redundancy}
                onChange={(e) => setStrategy(s.key, { redundancy: Math.max(1, Number(e.target.value) || 1) })}
                className="signaling-number"
              />
            </div>
          </div>
        ))}

        <p className="signaling-hint">{t.signaling.emptyUrlsHint}</p>
        <p className="signaling-hint">{t.signaling.noteCsp}</p>

        <div className="signaling-actions">
          <button onClick={handleReset} className="signaling-btn signaling-btn-secondary">
            {t.signaling.reset}
          </button>
          <button onClick={handleSave} className="signaling-btn signaling-btn-primary">
            {t.signaling.save}
          </button>
        </div>

        {status && (
          <p className={`signaling-status ${saved ? 'success' : ''}`}>
            {status}
          </p>
        )}

        <button onClick={onClose} className="signaling-close">
          {t.backup.close}
        </button>
      </div>
    </BottomSheet>
  )
}
