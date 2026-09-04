import { useState, useEffect } from 'react'
import type { Message } from '../../core/types'
import { getRemainingMs } from '../../core/burn'
import { formatCountdown } from '../../utils/time'

type Props = {
  message: Message
  onExpired?: () => void
}

export default function BurnTimer({ message, onExpired }: Props) {
  const [remaining, setRemaining] = useState(() => getRemainingMs(message))

  useEffect(() => {
    if (remaining <= 0 || remaining === Infinity) return

    const interval = setInterval(() => {
      const r = getRemainingMs(message)
      setRemaining(r)
      if (r <= 0) {
        clearInterval(interval)
        onExpired?.()
      }
    }, 200)

    return () => clearInterval(interval)
  }, [message, onExpired, remaining])

  if (remaining === Infinity) return null
  if (remaining <= 0) return <span className="burn-indicator expired">已焚</span>

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
