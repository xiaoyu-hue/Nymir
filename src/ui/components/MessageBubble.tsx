import { memo, useState, useEffect } from 'react'
import type { Message } from '../../core/types'
import { peerManager } from '../../communication/peer'
import { formatTime } from '../../utils/time'
import { useI18n } from '../../i18n'
import { messageManager } from '../../core/message'
import { getRoomDisplayName } from '../../security/pseudonym'
import BurnTimer from './BurnTimer'

type Props = {
  message: Message
  roomId: string
  onDestroy?: () => void
}

function MessageBubbleInner({ message, roomId, onDestroy }: Props) {
  const { t } = useI18n()
  const isSelf = message.sender === peerManager.id
  const [showRecall, setShowRecall] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [visible, setVisible] = useState(!message.destroyed)

  // 获取显示名称
  const displayName = getRoomDisplayName(roomId, message.sender, isSelf)

  // 销毁淡出动画
  useEffect(() => {
    if (message.destroyed && visible) {
      setExiting(true)
      const timer = setTimeout(() => setVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [message.destroyed, visible])

  if (!visible) return null

  if (message.destroyed) {
    return (
      <div className={`message-bubble destroyed ${isSelf ? 'self' : 'other'} ${exiting ? 'msg-exit' : ''}`}>
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
      className={`message-bubble ${isSelf ? 'self' : 'other'} msg-enter`}
      onClick={() => {
        if (isSelf) {
          setShowRecall(!showRecall)
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isSelf ? 'flex-end' : 'flex-start',
        margin: '8px 16px',
        maxWidth: 'min(75%, 500px)',
        alignSelf: isSelf ? 'flex-end' : 'flex-start',
      }}
    >
      {/* 发送者名称 */}
      <div
        style={{
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          marginBottom: '2px',
          paddingLeft: isSelf ? 0 : '4px',
          paddingRight: isSelf ? '4px' : 0,
          textAlign: isSelf ? 'right' : 'left',
        }}
      >
        {isSelf ? '' : displayName}
      </div>

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
              {message.burnMode === 'read_once' ? t.burn.readOnce : t.burn.timed}
            </span>
          )}
          {isSelf && readCount > 0 && (
            <span className="pop-in" style={{ color: 'var(--accent)', opacity: 0.8 }}>
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
