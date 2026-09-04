import { useState } from 'react'
import { exportBackup, downloadBackup, importBackup } from '../../persistence/backup'
import { useI18n } from '../../i18n'
import GlassCard from './GlassCard'

type Props = {
  onClose: () => void
}

export default function BackupPanel({ onClose }: Props) {
  const { t } = useI18n()
  const [status, setStatus] = useState('')
  const [importing, setImporting] = useState(false)

  const handleExport = async () => {
    try {
      setStatus(t.backup.exporting)
      const json = await exportBackup()
      downloadBackup(json)
      setStatus(t.backup.exportSuccess)
    } catch (e) {
      setStatus(`${t.backup.exportFailed}: ${e}`)
    }
  }

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      setImporting(true)
      setStatus(t.backup.importing)
      try {
        const text = await file.text()
        const result = await importBackup(text)
        setStatus(`${t.backup.importSuccess} ${result.rooms} ${t.backup.rooms}, ${result.messages} ${t.backup.messages}`)
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handleExport}
              style={{
                padding: '14px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--accent), #5b4bc9)',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.95rem',
              }}
            >
              {t.backup.export}
            </button>

            <button
              onClick={handleImport}
              disabled={importing}
              style={{
                padding: '14px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.08)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '0.95rem',
                opacity: importing ? 0.5 : 1,
              }}
            >
              {importing ? t.backup.importing : t.backup.import}
            </button>

            {status && (
              <p
                style={{
                  textAlign: 'center',
                  color: status.includes('failed') || status.includes('失败') ? 'var(--danger)' : 'var(--success)',
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
