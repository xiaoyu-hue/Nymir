import { useState } from 'react'
import { securityManager } from '../../security'
import { useI18n } from '../../i18n'
import { SHAKE_ANIMATION_MS, MIN_PASSWORD_LENGTH } from '../../constants'
import GlassCard from './GlassCard'
import { useConfirm } from './useConfirm'

type Props = {
  onUnlocked: () => void
}

export default function LockScreen({ onUnlocked }: Props) {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const { confirm, ConfirmDialog: ConfirmDialogEl } = useConfirm()

  const isSetup = securityManager.isSetup

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), SHAKE_ANIMATION_MS)
  }

  const handleSubmit = async () => {
    setError('')
    setLoading(true)

    try {
      if (isSetup) {
        const success = await securityManager.unlock(password)
        if (success) {
          onUnlocked()
        } else {
          setError(t.security.wrongPassword)
          triggerShake()
        }
      } else {
        if (password.length < MIN_PASSWORD_LENGTH) {
          setError(t.security.passwordTooShort)
          triggerShake()
          setLoading(false)
          return
        }

        if (password !== confirmPassword) {
          setError(t.security.passwordMismatch)
          triggerShake()
          setLoading(false)
          return
        }

        await securityManager.setupPassword(password)
        onUnlocked()
      }
    } catch (e) {
      setError(String(e))
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    const confirmed = await confirm(t.security.resetWarning)
    if (confirmed) {
      await securityManager.reset()
      setPassword('')
      setConfirmPassword('')
      setError('')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isSetup ? t.security.unlock : t.security.setupTitle}
      className="overlay-enter lock-screen"
    >
      <GlassCard variant="strong" className={shake ? 'shake' : ''}>
        <div className="lock-card">
          <div className="lock-header">
            <div className="lock-icon">🔐</div>
            <h2 className="lock-heading">
              {isSetup ? t.security.unlock : t.security.setupTitle}
            </h2>
            <p className="lock-desc">
              {isSetup ? t.security.unlockDesc : t.security.setupDesc}
            </p>
          </div>

          <div className="lock-form">
            <div>
              <label htmlFor="lock-password" className="lock-label">
                {t.security.password}
              </label>
              <input
                id="lock-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder={t.security.passwordPlaceholder}
                className="lock-input"
              />
            </div>

            {!isSetup && (
              <div className="page-enter">
                <label htmlFor="lock-confirm-password" className="lock-label">
                  {t.security.confirmPassword}
                </label>
                <input
                  id="lock-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder={t.security.confirmPasswordPlaceholder}
                  className="lock-input"
                />
              </div>
            )}

            {error && (
              <p className="shake lock-error">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !password}
              className={`lock-submit ${password ? 'ready' : ''}`}
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? t.security.processing : isSetup ? t.security.unlock : t.security.setup}
            </button>

            {isSetup && (
              <button onClick={handleReset} className="lock-forgot">
                {t.security.forgotPassword}
              </button>
            )}
          </div>

          {!isSetup && (
            <div className="lock-warning">
              <p className="lock-warning-text">
                ⚠️ {t.security.warning}
              </p>
            </div>
          )}
        </div>
      </GlassCard>
      <ConfirmDialogEl />
    </div>
  )
}
