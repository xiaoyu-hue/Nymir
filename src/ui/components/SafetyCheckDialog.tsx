import { useState, useEffect, useCallback } from 'react'
import BottomSheet from './BottomSheet'
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
 * 安全码核对抽屉。
 *
 * 显示双方共同的 15 位数字 + 7 个 emoji，提示用户用另一条渠道（电话/当面/微信）
 * 和对方比对。一致后点"我已核对一致"，把当前指纹钉住。
 *
 * 这一步本身不提升密码学强度——它只是让"中间人替换公钥"这件事可被人眼发现。
 */
export default function SafetyCheckDialog({ open, peerId, onClose }: Props) {
  const { t } = useI18n()
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
      refresh()
    } else {
      // 关闭后重置状态，下次打开重新计算
      setFingerprint(null)
      setState('unverified')
    }
  }, [open, refresh])

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

  return (
    <BottomSheet open={open} onClose={onClose} title={t.safety.title}>
      <div className="safety-body">
        {!fingerprint ? (
          <p className="safety-waiting">{t.safety.waiting}</p>
        ) : (
          <>
            <div className="safety-fingerprint">{fingerprint.decimal}</div>
            <div className="safety-emojis" aria-label="emoji fingerprint">
              {fingerprint.emojis.map((e, i) => (
                <span key={i}>{e}</span>
              ))}
            </div>
            <p className="safety-hint">{t.safety.hint}</p>
            <div role="status" className="safety-banner" style={{ color: bannerColor }}>
              {bannerText}
            </div>
          </>
        )}

        <div className="safety-actions">
          <button onClick={onClose} className="safety-btn-secondary">
            {t.safety.close}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!fingerprint || busy || state === 'verified'}
            className="safety-btn-primary"
          >
            {t.safety.matchBtn}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
