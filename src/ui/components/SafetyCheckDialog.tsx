import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import GlassCard from './GlassCard'
import { useI18n } from '../../i18n'
import { e2eeManager, type VerificationState } from '../../security/e2eeManager'
import type { Fingerprint } from '../../security/fingerprint'
import { error } from '../../utils/logger'

type Props = {
  open: boolean
  /** 对端 peerId；为 null 表示当前无人在线 */
  peerId: string | null
  onClose: () => void
}

/**
 * 安全码核对弹窗。
 *
 * 显示双方共同的 15 位数字 + 7 个 emoji，提示用户用另一条渠道（电话/当面/微信）
 * 和对方比对。一致后点"我已核对一致"，把当前指纹钉住。
 *
 * 这一步本身不提升密码学强度——它只是让"中间人替换公钥"这件事可被人眼发现。
 */
export default function SafetyCheckDialog({ open, peerId, onClose }: Props) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  const [fingerprint, setFingerprint] = useState<Fingerprint | null>(null)
  const [state, setState] = useState<VerificationState>('unverified')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!peerId) {
      setFingerprint(null)
      setState('unverified')
      return
    }
    const fp = await e2eeManager.computePeerFingerprint(peerId)
    const st = await e2eeManager.getVerificationState(peerId)
    setFingerprint(fp)
    setState(st)
  }, [peerId])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true))
      // eslint-disable-next-line react-hooks/set-state-in-effect
      refresh()
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false)
    }
  }, [open, refresh])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleKeyDown])

  const handleConfirm = useCallback(async () => {
    if (!peerId || !fingerprint) return
    setBusy(true)
    try {
      await e2eeManager.markPeerVerified(peerId)
    } catch (e) {
      // localStorage 写失败（隐私模式/配额满）等情况：不卡死按钮，让用户可关闭
      error('[SafetyCheck] markPeerVerified failed:', e)
    } finally {
      setBusy(false)
    }
    onClose()
  }, [peerId, fingerprint, onClose])

  if (!open) return null

  const bannerColor =
    state === 'changed'
      ? 'var(--danger)'
      : state === 'verified'
        ? 'var(--success, #34d399)'
        : 'var(--text-secondary)'
  const bannerText =
    state === 'changed'
      ? t.safety.changed
      : state === 'verified'
        ? t.safety.verified
        : t.safety.unconfirmed

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="safety-dialog-title"
      className={`overlay-enter ${visible ? '' : 'confirm-hidden'}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <GlassCard variant="strong" className="modal-enter">
          <div
            style={{
              padding: '24px',
              minWidth: 'min(320px, 88vw)',
              maxWidth: '420px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h3
              id="safety-dialog-title"
              style={{
                margin: 0,
                color: 'var(--text-primary)',
                fontSize: '1.05rem',
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              {t.safety.title}
            </h3>

            {!fingerprint ? (
              <p
                style={{
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                  margin: '12px 0',
                }}
              >
                {t.safety.waiting}
              </p>
            ) : (
              <>
                <div
                  style={{
                    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                    fontSize: '1.6rem',
                    letterSpacing: '0.15em',
                    textAlign: 'center',
                    color: 'var(--text-primary)',
                    padding: '12px 0',
                  }}
                >
                  {fingerprint.decimal}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '1.8rem',
                  }}
                  aria-label="emoji fingerprint"
                >
                  {fingerprint.emojis.map((e, i) => (
                    <span key={i}>{e}</span>
                  ))}
                </div>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    textAlign: 'center',
                    margin: 0,
                  }}
                >
                  {t.safety.hint}
                </p>
                <div
                  role="status"
                  style={{
                    color: bannerColor,
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    textAlign: 'center',
                  }}
                >
                  {bannerText}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={onClose}
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
                {t.safety.close}
              </button>
              <button
                onClick={handleConfirm}
                disabled={!fingerprint || busy || state === 'verified'}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  background:
                    state === 'verified'
                      ? 'rgba(52, 211, 153, 0.15)'
                      : 'rgba(52, 211, 153, 0.2)',
                  color: 'var(--success, #34d399)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  opacity: !fingerprint || busy || state === 'verified' ? 0.5 : 1,
                }}
              >
                {t.safety.matchBtn}
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>,
    document.body,
  )
}
