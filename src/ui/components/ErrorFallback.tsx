import { useI18n } from '../../i18n'

export default function ErrorFallback() {
  const { t } = useI18n()
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100dvh', background: '#0a0a1a',
      color: 'rgba(255,255,255,0.7)', fontFamily: 'system-ui, sans-serif',
      textAlign: 'center', padding: '20px',
    }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>Nymir</h1>
      <p style={{ marginBottom: '16px' }}>{t.error.title}</p>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '8px 24px', borderRadius: '8px', border: '1px solid rgba(124,106,239,0.3)',
          background: 'rgba(124,106,239,0.2)', color: '#7c6aef', cursor: 'pointer',
        }}
      >
        {t.error.reload}
      </button>
    </div>
  )
}
