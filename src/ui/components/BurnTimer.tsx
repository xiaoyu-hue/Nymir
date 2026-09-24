import { useState, useEffect, useRef } from 'react'
import type { Message } from '../../core/types'
import { getRemainingMs } from '../../core/burn'
import { formatCountdown } from '../../utils/time'
import { useI18n } from '../../i18n'
import { BURN_URGENT_THRESHOLD_MS } from '../../constants'

type Props = {
  message: Message
  onExpired?: () => void
}

export default function BurnTimer({ message, onExpired }: Props) {
  const { t } = useI18n()
  const [remaining, setRemaining] = useState(() => getRemainingMs(message))
  const [prevMessage, setPrevMessage] = useState(message)
  const onExpiredRef = useRef(onExpired)
  const messageRef = useRef(message)
  const hasExpiredRef = useRef(false)
  // Per-instance timer: avoid global shared state
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep refs up to date
  useEffect(() => {
    onExpiredRef.current = onExpired
  }, [onExpired])

  useEffect(() => {
    messageRef.current = message
  }, [message])

  // Adjust countdown during render when the message changes
  if (prevMessage !== message) {
    setPrevMessage(message)
    setRemaining(getRemainingMs(message))
  }

  // Initial check: if already expired, fire immediately
  useEffect(() => {
    hasExpiredRef.current = false
    const r = getRemainingMs(message)
    if (r <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true
      onExpiredRef.current?.()
    }
  }, [message])

  // Per-instance countdown timer
  useEffect(() => {
    const r = getRemainingMs(messageRef.current)
    if (r <= 0) {
      // Already expired or timed-out: nothing to schedule
      return
    }

    const tick = () => {
      const remaining = getRemainingMs(messageRef.current)
      setRemaining(remaining)
      if (remaining <= 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true
        onExpiredRef.current?.()
      }
    }

    // Schedule next tick at the exact expiration time
    timerRef.current = setTimeout(tick, Math.max(r, 1000))

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [message])

  if (remaining === Infinity) return null
  if (remaining <= 0) return <span className="burn-indicator expired">{t.message.burned}</span>

  const isUrgent = remaining < BURN_URGENT_THRESHOLD_MS

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
