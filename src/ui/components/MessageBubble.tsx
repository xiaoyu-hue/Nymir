import { memo, useState } from 'react'
import type { Message } from '../../core/types'
import { peerManager } from '../../communication/peer'
import { formatTime } from '../../utils/time'
import { getBurnModeLabel } from '../../core/burn'
import { useI18n } from '../../i18n'
import { messageManager } from '../../core/message'
import BurnTimer from './BurnTimer'

type Props = {
  message: Message
  onDestroy?: () => void
}

function MessageBubbleInner({ message, onDestroy }: Props) {
  const { t } = useI18n()
  const isSelf = message.sender === peerManager.id
  const [showRecall, setShowRecall] = useState(false)

  if (message.destroyed) {
    return (
      <div className={`message-bubble destroyed ${isSelf ? 'self' : 'other'}`}>
        <div className="message-ghost">{t.message.destroyed}</div>
      </div>
    )
  }

  const readCount = message.readBy.length

  const handleRecall = async () => {
    await messageManager.recall(message.id)
    setShowRecall(false)
    onDestroy?.()
  }

  return (
    <div
      className={`message-bubble ${isSelf ? 'self' : 'other'}`}
      onClick={() => {
        if (message.burnMode === 'read_once' && !isSelf) {
          onDestroy?.()
        } else if (isSelf) {
          setShowRecall(!showRecall)
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
          {isSelf && readCount > 0 && (
            <span style={{ color: 'var(--accent)', opacity: 0.8 }}>
              ✓✓ {readCount}
            </span>
          )}
          <BurnTimer message={message} onExpired={onDestroy} />
        </div>
      </div>

      {/* Recall button */}
      {isSelf && showRecall && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleRecall()
          }}
          style={{
            marginTop: '4px',
            padding: '4px 10px',
            borderRadius: '6px',
            background: 'rgba(239,68,68,0.2)',
            color: 'var(--danger)',
            fontSize: '0.7rem',
            border: '1px solid rgba(239,68,68,0.3)',
          }}
        >
          {t.message.recall}
        </button>
      )}
    </div>
  )
}

const MessageBubble = memo(MessageBubbleInner, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.destroyed === next.message.destroyed &&
    prev.message.readBy.length === next.message.readBy.length &&
    prev.message.content === next.message.content
  )
})

export default MessageBubble
