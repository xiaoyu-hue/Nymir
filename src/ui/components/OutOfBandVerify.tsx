import { useState, useEffect, useCallback, useRef } from 'react'
import BottomSheet from './BottomSheet'
import { useI18n } from '../../i18n'
import { e2eeManager } from '../../security/e2eeManager'
import { serializeIdentity, parseIdentity, computeFingerprintOutOfBand, type IdentityKeys } from '../../security/outOfBand'
import { generateQRCodeSVG } from '../../utils/qr'
import type { Fingerprint } from '../../security/fingerprint'

type Props = {
  open: boolean
  /** 当前在线的对端 peerId；提供时「核对」可顺带把指纹钉住 */
  peerId?: string | null
  onClose: () => void
}

export default function OutOfBandVerify({ open, peerId, onClose }: Props) {
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

  // 生成"我的身份"串与二维码（打开时生成，关闭时回收）
  useEffect(() => {
    if (!open) return
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
      blobRef.current = ''
    }
  }, [open])

  // 若已连上对端，预填对方身份串（带外核对可与在线核对互补）
  useEffect(() => {
    if (open && peerId) {
      const peer = e2eeManager.getPeerIdentityExport(peerId)
      if (peer) setPeerInput(serializeIdentity(peer))
    }
  }, [open, peerId])

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

  return (
    <BottomSheet open={open} onClose={onClose} title={t.oob.title}>
      <div className="oob-body">
        <p className="oob-desc">{t.oob.desc}</p>

        <div className="oob-tabs">
          <button
            onClick={() => setTab('share')}
            className={`oob-tab ${tab === 'share' ? 'active' : ''}`}
          >
            {t.oob.shareTab}
          </button>
          <button
            onClick={() => setTab('verify')}
            className={`oob-tab ${tab === 'verify' ? 'active' : ''}`}
          >
            {t.oob.verifyTab}
          </button>
        </div>

        {tab === 'share' ? (
          <>
            <div className="oob-qr-wrap">
              {svgUrl ? (
                <img src={svgUrl} alt="My identity QR" className="oob-qr" />
              ) : (
                <div className="oob-qr oob-qr-placeholder">...</div>
              )}
              <button onClick={handleCopy} className="oob-copy-btn">
                {copied ? t.oob.copiedMine : t.oob.copyMine}
              </button>
            </div>
            <div className="oob-field">
              <label className="oob-label">{t.oob.myIdentity}</label>
              <textarea
                readOnly
                value={myString}
                rows={3}
                spellCheck={false}
                onFocus={(e) => e.currentTarget.select()}
                className="oob-textarea"
              />
            </div>
            <p className="oob-scan-hint">{t.oob.scanHint}</p>
          </>
        ) : (
          <>
            <div className="oob-field">
              <label className="oob-label">{t.oob.pastePeer}</label>
              <textarea
                value={peerInput}
                onChange={(e) => { setPeerInput(e.target.value); setFingerprint(null); setInvalid(false); setMatched(false) }}
                placeholder={t.oob.pastePlaceholder}
                rows={3}
                spellCheck={false}
                className={`oob-textarea ${invalid ? 'invalid' : ''}`}
              />
            </div>
            <button
              onClick={handleCompute}
              disabled={!peerInput.trim()}
              className="oob-compute-btn"
            >
              {t.oob.compute}
            </button>

            {invalid && <p className="oob-invalid">{t.oob.invalidPeer}</p>}

            {fingerprint && !invalid && (
              <div className="oob-result">
                <label className="oob-label">{t.oob.fingerprint}</label>
                <div className="oob-fingerprint">{fingerprint.decimal}</div>
                <div className="safety-emojis" aria-label="emoji fingerprint">
                  {fingerprint.emojis.map((e, i) => <span key={i}>{e}</span>)}
                </div>
                {peerId ? (
                  <button
                    onClick={handleMatch}
                    disabled={matched}
                    className="oob-match-btn"
                  >
                    {matched ? `✓ ${t.oob.match}` : t.oob.match}
                  </button>
                ) : (
                  <p className="oob-match-hint">{t.oob.match}</p>
                )}
              </div>
            )}

            {!fingerprint && !invalid && <p className="oob-waiting">{t.oob.waitingPeer}</p>}
          </>
        )}

        <button onClick={onClose} className="oob-close-btn">
          {t.backup.close}
        </button>
      </div>
    </BottomSheet>
  )
}
