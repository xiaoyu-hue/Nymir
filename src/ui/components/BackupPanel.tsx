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
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'export' | 'import'>('export')

  const handleExport = async () => {
    if (!password || password.length < 6) {
      setStatus(t.backup.passwordRequired)
      return
    }

    setLoading(true)
    setStatus('')
    try {
      const json = await exportBackup(password)
      downloadBackup(json)
      setStatus(t.backup.exportSuccess)
      setPassword('')
    } catch (e) {
      setStatus(`${t.backup.exportFailed}: ${e}`)
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

      try {
        const text = await file.text()

        // 验证密码
        setStatus(t.backup.verifying)
        const valid = await verifyBackupPassword(text, password)
        if (!valid) {
          setStatus(t.backup.wrongPassword)
          setImporting(false)
          return
        }

        // 导入
        setStatus(t.backup.importing)
        const result = await importBackup(text, password)
        setStatus(`${t.backup.importSuccess} ${result.rooms} ${t.backup.rooms}, ${result.messages} ${t.backup.messages}`)
        setPassword('')
      } catch (err) {
        setStatus(`${t.backup.importFailed}: ${err}`)
      } finally {
        setImporting(false)
      }
    }
    input.click()
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <GlassCard
        variant="strong"
        className="backup-panel"
        onClick={(e) => e?.stopPropagation()}
      >
        <div style={{ padding: '24px', minWidth: '320px' }}>
          <h2
            style={{
              fontSize: '1.2rem',
              fontWeight: 600,
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            {t.backup.title}
          </h2>

          {/* 模式切换 */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--glass-border)',
              marginBottom: '16px',
            }}
          >
            <button
              onClick={() => setMode('export')}
              style={{
                flex: 1,
                padding: '10px',
                background: mode === 'export' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: mode === 'export' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.85rem',
                borderBottom: mode === 'export' ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              {t.backup.export}
            </button>
            <button
              onClick={() => setMode('import')}
              style={{
                flex: 1,
                padding: '10px',
                background: mode === 'import' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: mode === 'import' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.85rem',
                borderBottom: mode === 'import' ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              {t.backup.import}
            </button>
          </div>

          {/* 密码输入 */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '6px',
              }}
            >
              {t.backup.backupPassword}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.backup.passwordPlaceholder}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {mode === 'export' ? (
              <button
                onClick={handleExport}
                disabled={loading || !password}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: password
                    ? 'linear-gradient(135deg, var(--accent), #5b4bc9)'
                    : 'rgba(255,255,255,0.05)',
                  color: password ? 'white' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? t.backup.exporting : t.backup.export}
              </button>
            ) : (
              <button
                onClick={handleImport}
                disabled={importing || !password}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: password
                    ? 'linear-gradient(135deg, var(--accent), #5b4bc9)'
                    : 'rgba(255,255,255,0.05)',
                  color: password ? 'white' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  opacity: importing ? 0.7 : 1,
                }}
              >
                {importing ? t.backup.importing : t.backup.import}
              </button>
            )}

            {status && (
              <p
                style={{
                  textAlign: 'center',
                  color: status.includes('failed') || status.includes('失败') || status.includes('Wrong')
                    ? 'var(--danger)' : 'var(--success)',
                  fontSize: '0.85rem',
                  marginTop: '4px',
                }}
              >
                {status}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              width: '100%',
              marginTop: '16px',
              padding: '10px',
              borderRadius: '8px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
            }}
          >
            {t.backup.close}
          </button>
        </div>
      </GlassCard>
    </div>
  )
}
