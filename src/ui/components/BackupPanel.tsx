import { useState } from 'react'
import { exportBackup, downloadBackup, importBackup, verifyBackupPassword } from '../../persistence/backup'
import { useI18n } from '../../i18n'
import GlassCard from './GlassCard'

type Props = {
  onClose: () => void
}

export default function BackupPanel({ onClose }: Props) {
  const { t } = useI18n()
  const [status, setStatus] = useState('')
  const [hasError, setHasError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'export' | 'import'>('export')

  const isBusy = loading || importing

  const handleExport = async () => {
    if (!password || password.length < 6) {
      setStatus(t.backup.passwordRequired)
      return
    }

    setLoading(true)
    setStatus('')
    setHasError(false)
    try {
      const json = await exportBackup(password)
      downloadBackup(json)
      setStatus(t.backup.exportSuccess)
      setPassword('')
    } catch (e) {
      setStatus(`${t.backup.exportFailed}: ${e}`)
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!password) {
      setStatus(t.backup.passwordRequired)
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.nymir'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      setImporting(true)
      setStatus('')
      setHasError(false)

      try {
        const text = await file.text()

        setStatus(t.backup.verifying)
        const valid = await verifyBackupPassword(text, password)
        if (!valid) {
          setStatus(t.backup.wrongPassword)
          setHasError(true)
          setImporting(false)
          return
        }

        setStatus(t.backup.importing)
        const result = await importBackup(text, password)
        setStatus(`${t.backup.importSuccess} ${result.rooms} ${t.backup.rooms}, ${result.messages} ${t.backup.messages}`)
        setPassword('')
      } catch (err) {
        setStatus(`${t.backup.importFailed}: ${err}`)
        setHasError(true)
      } finally {
        setImporting(false)
      }
    }
    input.click()
  }

  return (
    <div className="overlay-enter backup-overlay" onClick={onClose}>
      <GlassCard
        variant="strong"
        className="backup-panel modal-enter"
        onClick={(e) => e?.stopPropagation()}
      >
        <div className="backup-card">
          <h2 className="backup-heading">{t.backup.title}</h2>

          <div className="backup-mode-tabs">
            <button
              onClick={() => setMode('export')}
              className={`backup-mode-tab ${mode === 'export' ? 'active' : ''}`}
            >
              {t.backup.export}
            </button>
            <button
              onClick={() => setMode('import')}
              className={`backup-mode-tab ${mode === 'import' ? 'active' : ''}`}
            >
              {t.backup.import}
            </button>
          </div>

          <div className="backup-password-group">
            <label htmlFor="backup-password" className="backup-label">
              {t.backup.backupPassword}
            </label>
            <input
              id="backup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.backup.passwordPlaceholder}
              className="backup-input"
            />
          </div>

          <div className="backup-actions">
            {mode === 'export' ? (
              <button
                onClick={handleExport}
                disabled={isBusy || !password}
                className={`backup-submit ${password ? 'ready' : ''}`}
                style={{ opacity: loading ? 0.7 : 1 }}
              >
                {loading ? t.backup.exporting : t.backup.export}
              </button>
            ) : (
              <button
                onClick={handleImport}
                disabled={isBusy || !password}
                className={`backup-submit ${password ? 'ready' : ''}`}
                style={{ opacity: importing ? 0.7 : 1 }}
              >
                {importing ? t.backup.importing : t.backup.import}
              </button>
            )}

            {status && (
              <p className={`pop-in backup-status ${hasError ? 'error' : 'success'}`}>
                {status}
              </p>
            )}
          </div>

          <button onClick={onClose} className="backup-close">
            {t.backup.close}
          </button>
        </div>
      </GlassCard>
    </div>
  )
}
