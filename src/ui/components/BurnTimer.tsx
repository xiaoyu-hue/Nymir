import { useState, useEffect, useRef } from 'react'
import type { Message } from '../../core/types'
import { getRemainingMs } from '../../core/burn'
import { formatCountdown } from '../../utils/time'
import { useI18n } from '../../i18n'

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
  onExpiredRef.current = onExpired

  useEffect(() => {
    if (remaining <= 0 || remaining === Infinity) return

    const tick = () => {
      const r = getRemainingMs(message)
      setRemaining(r)
      if (r <= 0) {
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
  }, [message, remaining <= 0])

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
