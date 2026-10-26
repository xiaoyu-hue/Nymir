import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import GlassCard from './GlassCard'
import { useI18n } from '../../i18n'
import { e2eeManager } from '../../security/e2eeManager'
import { serializeIdentity, parseIdentity, computeFingerprintOutOfBand, type IdentityKeys } from '../../security/outOfBand'
import { generateQRCodeSVG } from '../../utils/qr'
import type { Fingerprint } from '../../security/fingerprint'

type Props = {
  /** 当前在线的对端 peerId；提供时「核对」可顺带把指纹钉住 */
  peerId?: string | null
  onClose: () => void
}

export default function OutOfBandVerify({ peerId, onClose }: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<'share' | 'verify'>('share')
  const [myString, setMyString] = useState('')
  const [svgUrl, setSvgUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [peerInput, setPeerInput] = useState('')
  const [fingerprint, setFingerprint] = useState<Fingerprint | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [matched, setMatched] = useState(false)
  const blobRef = useRef<string>('')

  // 生成"我的身份"串与二维码
  useEffect(() => {
    const own = e2eeManager.getOwnIdentityExport()
    if (!own) return
    const s = serializeIdentity(own)
    setMyString(s)
    generateQRCodeSVG(s, 220).then((svg) => {
      if (svg) {
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)
        if (blobRef.current) URL.revokeObjectURL(blobRef.current)
        blobRef.current = url
        setSvgUrl(url)
      }
    })
    return () => {
      if (blobRef.current) URL.revokeObjectURL(blobRef.current)
    }
  }, [])

  // 若已连上对端，预填对方身份串（带外核对可与在线核对互补）
  useEffect(() => {
    if (peerId) {
      const peer = e2eeManager.getPeerIdentityExport(peerId)
      if (peer) setPeerInput(serializeIdentity(peer))
    }
  }, [peerId])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(myString)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [myString])

  const handleCompute = useCallback(async () => {
    const own = e2eeManager.getOwnIdentityExport()
    const peer: IdentityKeys | null = parseIdentity(peerInput)
    if (!own || !peer) {
      setInvalid(true)
      setFingerprint(null)
      return
    }
    setInvalid(false)
    const fp = await computeFingerprintOutOfBand(own, peer)
    setFingerprint(fp)
    setMatched(false)
  }, [peerInput])

  const handleMatch = useCallback(async () => {
    if (!peerId || !fingerprint) return
    try {
      await e2eeManager.markPeerVerified(peerId)
      setMatched(true)
    } catch {
      setMatched(false)
    }
  }, [peerId, fingerprint])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.oob.title}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <GlassCard variant="strong" className="modal-enter">
          <div style={{ padding: '24px', minWidth: 'min(340px, 90vw)', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 600 }}>{t.oob.title}</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>{t.oob.desc}</p>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setTab('share')}
                style={{
                  flex: 1, padding: '9px', borderRadius: '10px', fontSize: '0.85rem',
                  background: tab === 'share' ? 'rgba(124,106,239,0.3)' : 'rgba(255,255,255,0.05)',
                  color: tab === 'share' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: tab === 'share' ? '1px solid rgba(124,106,239,0.6)' : '1px solid transparent',
                }}
              >
                {t.oob.shareTab}
              </button>
              <button
                onClick={() => setTab('verify')}
                style={{
                  flex: 1, padding: '9px', borderRadius: '10px', fontSize: '0.85rem',
                  background: tab === 'verify' ? 'rgba(124,106,239,0.3)' : 'rgba(255,255,255,0.05)',
                  color: tab === 'verify' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: tab === 'verify' ? '1px solid rgba(124,106,239,0.6)' : '1px solid transparent',
                }}
              >
                {t.oob.verifyTab}
              </button>
            </div>

            {tab === 'share' ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  {svgUrl ? <img src={svgUrl} alt="My identity QR" style={{ width: 200, height: 200, background: '#fff', borderRadius: 12, padding: 8 }} />
                    : <div style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>...</div>}
                  <button onClick={handleCopy} style={{ padding: '8px 16px', borderRadius: '10px', background: 'rgba(124,106,239,0.25)', color: 'var(--text-primary)', fontSize: '0.85rem', border: '1px solid rgba(124,106,239,0.4)' }}>
                    {copied ? t.oob.copiedMine : t.oob.copyMine}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t.oob.myIdentity}</label>
                  <textarea
                    readOnly
                    value={myString}
                    rows={3}
                    spellCheck={false}
                    onFocus={(e) => e.currentTarget.select()}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.25)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.75rem', resize: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: 1.4, opacity: 0.85 }}>{t.oob.scanHint}</p>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t.oob.pastePeer}</label>
                  <textarea
                    value={peerInput}
                    onChange={(e) => { setPeerInput(e.target.value); setFingerprint(null); setInvalid(false); setMatched(false) }}
                    placeholder={t.oob.pastePlaceholder}
                    rows={3}
                    spellCheck={false}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.25)', color: 'var(--text-primary)', border: invalid ? '1px solid var(--danger)' : '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.75rem', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
                <button
                  onClick={handleCompute}
                  disabled={!peerInput.trim()}
                  style={{ padding: '11px', borderRadius: '12px', background: 'rgba(124,106,239,0.25)', color: 'var(--text-primary)', fontSize: '0.9rem', border: '1px solid rgba(124,106,239,0.4)', opacity: !peerInput.trim() ? 0.5 : 1 }}
                >
                  {t.oob.compute}
                </button>

                {invalid && <p style={{ margin: 0, color: 'var(--danger)', fontSize: '0.82rem' }}>{t.oob.invalidPeer}</p>}

                {fingerprint && !invalid && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t.oob.fingerprint}</label>
                    <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '1.5rem', letterSpacing: '0.12em', color: 'var(--text-primary)' }}>{fingerprint.decimal}</div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '1.7rem' }} aria-label="emoji fingerprint">
                      {fingerprint.emojis.map((e, i) => <span key={i}>{e}</span>)}
                    </div>
                    {peerId ? (
                      <button
                        onClick={handleMatch}
                        disabled={matched}
                        style={{ padding: '10px 16px', borderRadius: '12px', background: matched ? 'rgba(52,211,153,0.15)' : 'rgba(52,211,153,0.2)', color: 'var(--success, #34d399)', fontSize: '0.88rem', border: '1px solid rgba(52,211,153,0.3)', opacity: matched ? 0.6 : 1 }}
                      >
                        {matched ? `✓ ${t.oob.match}` : t.oob.match}
                      </button>
                    ) : (
                      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.75rem', textAlign: 'center', lineHeight: 1.4 }}>{t.oob.match}</p>
                    )}
                  </div>
                )}

                {!fingerprint && !invalid && <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.78rem', textAlign: 'center' }}>{t.oob.waitingPeer}</p>}
              </>
            )}

            <button onClick={onClose} style={{ padding: '10px', borderRadius: '12px', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {t.backup.close}
            </button>
          </div>
        </GlassCard>
      </div>
    </div>,
    document.body,
  )
}
