import { useState } from 'react'
import { exportBackup, downloadBackup, importBackup } from '../../persistence/backup'
import GlassCard from './GlassCard'

type Props = {
  onClose: () => void
}

export default function BackupPanel({ onClose }: Props) {
  const [status, setStatus] = useState('')
  const [importing, setImporting] = useState(false)

  const handleExport = async () => {
    try {
      setStatus('导出中...')
      const json = await exportBackup()
      downloadBackup(json)
      setStatus('导出成功！文件已下载')
    } catch (e) {
      setStatus(`导出失败: ${e}`)
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
      setStatus('导入中...')
      try {
        const text = await file.text()
        const result = await importBackup(text)
        setStatus(`导入成功！${result.rooms} 个房间, ${result.messages} 条消息`)
      } catch (err) {
        setStatus(`导入失败: ${err}`)
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
            数据备份
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
              导出备份
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
              {importing ? '导入中...' : '导入备份'}
            </button>

            {status && (
              <p
                style={{
                  textAlign: 'center',
                  color: status.includes('失败') ? 'var(--danger)' : 'var(--success)',
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
            关闭
          </button>
        </div>
      </GlassCard>
    </div>
  )
}
