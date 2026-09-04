import { useState, useEffect, useRef } from 'react'
import type { Message } from '../../core/types'
import { getRemainingMs } from '../../core/burn'
import { formatCountdown } from '../../utils/time'
import { useI18n } from '../../i18n'

type Props = {
  message: Message
  onExpired?: () => void
}

export default function BurnTimer({ message, onExpired }: Props) {
  const { t } = useI18n()
  const [remaining, setRemaining] = useState(() => getRemainingMs(message))
  const onExpiredRef = useRef(onExpired)
  onExpiredRef.current = onExpired

  useEffect(() => {
    if (remaining <= 0 || remaining === Infinity) return

    const interval = setInterval(() => {
      const r = getRemainingMs(message)
      setRemaining(r)
      if (r <= 0) {
        clearInterval(interval)
        onExpiredRef.current?.()
      }
    }, 1000) // 降至 1000ms，减少渲染次数

    return () => clearInterval(interval)
  }, [message]) // 仅依赖 message，不依赖 remaining

  if (remaining === Infinity) return null
  if (remaining <= 0) return <span className="burn-indicator expired">{t.message.burned}</span>

  const isUrgent = remaining < 10000

  return (
    <span
      className={`burn-indicator ${isUrgent ? 'urgent' : ''}`}
      style={{
        color: isUrgent ? 'var(--danger)' : 'var(--text-muted)',
        fontSize: '0.75rem',
        fontFamily: 'monospace',
      }}
    >
      {formatCountdown(remaining)}
    </span>
  )
}
