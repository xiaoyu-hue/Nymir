import { memo, useState, useEffect } from 'react'
import type { Message } from '../../core/types'
import { peerManager } from '../../communication/peer'
import { formatTime } from '../../utils/time'
import { useI18n } from '../../i18n'
import { messageManager } from '../../core/message'
import { getRoomDisplayName } from '../../security/pseudonym'
import { EXIT_ANIMATION_MS } from '../../constants'
import { error } from '../../utils/logger'
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

  const displayName = getRoomDisplayName(roomId, message.sender, isSelf)

  useEffect(() => {
    if (message.destroyed && visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExiting(true)
      const timer = setTimeout(() => setVisible(false), EXIT_ANIMATION_MS)
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
    try {
      await messageManager.recall(message.id)
      setShowRecall(false)
      onDestroy?.()
    } catch (err) {
      error('[MessageBubble] Recall failed:', err)
    }
  }

  return (
    <div
      className={`message-wrapper ${isSelf ? 'self' : 'other'} msg-enter`}
      onClick={() => {
        if (isSelf) {
          setShowRecall(!showRecall)
        }
      }}
    >
      <div className={`message-sender ${isSelf ? 'self' : 'other'}`}>
        {isSelf ? '' : displayName}
      </div>

      <div
        className={`message-content-box ${isSelf ? 'self' : 'other'}${
          message.verified === false ? ' message-untrusted' : ''
        }${message.decryptFailed ? ' message-decrypt-failed' : ''}`}
      >
        {message.verified === false ? (
          <div className="message-security-alert">
            <div className="message-security-title">{t.message.signatureFailed}</div>
            <div className="message-security-hint">{t.message.signatureFailedHint}</div>
          </div>
        ) : message.decryptFailed ? (
          <div className="message-security-alert">
            <div className="message-security-title">{t.message.decryptFailed}</div>
            <div className="message-security-hint">{t.message.decryptFailedHint}</div>
          </div>
        ) : (
          <div className="message-text">{message.content}</div>
        )}
        <div className="message-meta">
          <span>{formatTime(message.timestamp)}</span>
          {message.burnMode !== 'persist' && (
            <span className="message-burn-label">
              {message.burnMode === 'read_once' ? t.burn.readOnce : t.burn.timed}
            </span>
          )}
          {isSelf && readCount > 0 && (
            <span className="pop-in message-read-count">
              ✓✓ {readCount}
            </span>
          )}
          <BurnTimer message={message} onExpired={onDestroy} />
        </div>
      </div>

      {isSelf && showRecall && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleRecall()
          }}
          className="message-recall-btn"
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
    prev.message.content === next.message.content &&
    prev.message.verified === next.message.verified &&
    prev.message.decryptFailed === next.message.decryptFailed
  )
})

export default MessageBubble
