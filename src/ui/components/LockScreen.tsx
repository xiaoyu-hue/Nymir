import { useState } from 'react'
import { securityManager } from '../../security'
import { useI18n } from '../../i18n'
import GlassCard from './GlassCard'

type Props = {
  onUnlocked: () => void
}

export default function LockScreen({ onUnlocked }: Props) {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isSetup = securityManager.isSetup

  const handleSubmit = async () => {
    setError('')
    setLoading(true)

    try {
      if (isSetup) {
        // 解锁
        const success = await securityManager.unlock(password)
        if (success) {
          onUnlocked()
        } else {
          setError(t.security.wrongPassword)
        }
      } else {
        // 设置新密码
        if (password.length < 6) {
          setError(t.security.passwordTooShort)
          setLoading(false)
          return
        }

        if (password !== confirmPassword) {
          setError(t.security.passwordMismatch)
          setLoading(false)
          return
        }

        await securityManager.setupPassword(password)
        onUnlocked()
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    if (confirm(t.security.resetWarning)) {
      securityManager.reset()
      setPassword('')
      setConfirmPassword('')
      setError('')
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(180deg, #0a0a1a 0%, #12122a 50%, #0a0a1a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
      }}
    >
      <GlassCard variant="strong">
        <div style={{ padding: '32px', minWidth: '300px', maxWidth: '400px' }}>
          {/* 标题 */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔐</div>
            <h2
              style={{
                fontSize: '1.3rem',
                fontWeight: 600,
                marginBottom: '8px',
              }}
            >
              {isSetup ? t.security.unlock : t.security.setupTitle}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {isSetup ? t.security.unlockDesc : t.security.setupDesc}
            </p>
          </div>

          {/* 密码输入 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                {t.security.password}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder={t.security.passwordPlaceholder}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* 确认密码（仅设置时显示） */}
            {!isSetup && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                  }}
                >
                  {t.security.confirmPassword}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder={t.security.confirmPasswordPlaceholder}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid var(--glass-border)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* 错误信息 */}
            {error && (
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center' }}>
                {error}
              </p>
            )}

            {/* 按钮 */}
            <button
              onClick={handleSubmit}
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
                transition: 'all 0.2s',
              }}
            >
              {loading ? t.security.processing : isSetup ? t.security.unlock : t.security.setup}
            </button>

            {/* 忘记密码（仅解锁时显示） */}
            {isSetup && (
              <button
                onClick={handleReset}
                style={{
                  padding: '10px',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                }}
              >
                {t.security.forgotPassword}
              </button>
            )}
          </div>

          {/* 安全提示 */}
          {!isSetup && (
            <div
              style={{
                marginTop: '20px',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <p style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: 0 }}>
                ⚠️ {t.security.warning}
              </p>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  )
}
