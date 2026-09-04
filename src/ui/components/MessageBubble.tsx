import type { Message } from '../../core/types'
import { peerManager } from '../../communication/peer'
import { formatTime } from '../../utils/time'
import { getBurnModeLabel } from '../../core/burn'
import BurnTimer from './BurnTimer'

type Props = {
  message: Message
  onDestroy?: () => void
}

export default function MessageBubble({ message, onDestroy }: Props) {
  const isSelf = message.sender === peerManager.id

  if (message.destroyed) {
    return (
      <div className={`message-bubble destroyed ${isSelf ? 'self' : 'other'}`}>
        <div className="message-ghost">已焚毁</div>
      </div>
    )
  }

  return (
    <div
      className={`message-bubble ${isSelf ? 'self' : 'other'}`}
      onClick={() => {
        if (message.burnMode === 'read_once' && !isSelf) {
          onDestroy?.()
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isSelf ? 'flex-end' : 'flex-start',
        margin: '8px 16px',
        maxWidth: '75%',
        alignSelf: isSelf ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          borderRadius: isSelf ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isSelf
            ? 'linear-gradient(135deg, var(--accent), #5b4bc9)'
            : 'var(--glass-bg)',
          border: isSelf ? 'none' : '1px solid var(--glass-border)',
          backdropFilter: 'blur(12px)',
          wordBreak: 'break-word',
          position: 'relative',
        }}
      >
        <div style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>{message.content}</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '4px',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
          }}
        >
          <span>{formatTime(message.timestamp)}</span>
          {message.burnMode !== 'persist' && (
            <span style={{ color: 'var(--warning)', opacity: 0.7 }}>
              {getBurnModeLabel(message.burnMode)}
            </span>
          )}
          <BurnTimer message={message} onExpired={onDestroy} />
        </div>
      </div>
    </div>
  )
}
