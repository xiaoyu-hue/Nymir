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

// Shared tick: single interval for all BurnTimer instances
let tickListeners: Set<() => void> = new Set()
let tickInterval: ReturnType<typeof setInterval> | null = null

function ensureTick() {
  if (tickInterval) return
  tickInterval = setInterval(() => {
    tickListeners.forEach((fn) => fn())
  }, 1000)
}

function stopTick() {
  if (tickListeners.size === 0 && tickInterval) {
    clearInterval(tickInterval)
    tickInterval = null
  }
}

export default function BurnTimer({ message, onExpired }: Props) {
  const { t } = useI18n()
  const [remaining, setRemaining] = useState(() => getRemainingMs(message))
  const onExpiredRef = useRef(onExpired)
  const messageRef = useRef(message)
  const hasExpiredRef = useRef(false)

  // Keep refs up to date
  useEffect(() => {
    onExpiredRef.current = onExpired
  }, [onExpired])

  useEffect(() => {
    messageRef.current = message
  }, [message])

  // Initial check: if already expired, fire immediately
  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    const r = getRemainingMs(message)
    setRemaining(r)
    if (r <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true
      onExpiredRef.current?.()
    }
  }, [message])

  // Set up shared tick listener
  useEffect(() => {
    const tick = () => {
      const r = getRemainingMs(messageRef.current)
      setRemaining(r)
      if (r <= 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true
        tickListeners.delete(tick)
        stopTick()
        onExpiredRef.current?.()
      }
    }

    tickListeners.add(tick)
    ensureTick()

    return () => {
      tickListeners.delete(tick)
      stopTick()
    }
  }, [])

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
