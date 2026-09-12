import { useState, useEffect, useRef, useCallback } from 'react'
import type { Message, BurnConfig } from '../../core/types'
import { BurnMode } from '../../core/types'
import { messageManager } from '../../core/message'
import { roomManager } from '../../core/room'
import { peerManager } from '../../communication/peer'
import { useRoom } from '../hooks/useRoom'
import { useI18n } from '../../i18n'
import { useKeyboard } from '../../App'
import { COPY_FEEDBACK_MS } from '../../constants'
import { error } from '../../utils/logger'
import { e2eeManager, type VerificationState } from '../../security/e2eeManager'
import GlassCard from './GlassCard'
import MessageBubble from './MessageBubble'
import SafetyCheckDialog from './SafetyCheckDialog'

export default function ChatView() {
  const { status, room } = useRoom()
  const { t } = useI18n()
  const { keyboardOpen, viewportHeight } = useKeyboard()
  const [messages, setMessages] = useState<Message[]>(() =>
    messageManager.getMessages(),
  )
  const [input, setInput] = useState('')
  const [burnMode, setBurnMode] = useState<BurnMode>(BurnMode.PERSIST)
  const [burnAfter, setBurnAfter] = useState(60)
  const [copied, setCopied] = useState(false)
  const [safetyOpen, setSafetyOpen] = useState(false)
  const [verifyState, setVerifyState] = useState<VerificationState>('unverified')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const readMsgIdsRef = useRef<Set<string>>(new Set())
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const unsub = messageManager.onMessage(() => {
      setMessages(messageManager.getMessages())
    })
    return unsub
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark messages as read when they appear (deduplicated)
  useEffect(() => {
    for (const msg of messages) {
      if (msg.sender !== peerManager.id && !readMsgIdsRef.current.has(msg.id)) {
        readMsgIdsRef.current.add(msg.id)
        messageManager.markRead(msg.id)
      }
    }
  }, [messages])

  // 双人场景：对端即 peers[0]
  const peerId = room?.peers?.[0] ?? null

  // 对端出现后，查询带外验证状态；公钥交换是异步的，稍后再补查一次
  useEffect(() => {
    if (!peerId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVerifyState('unverified')
      return
    }
    let cancelled = false
    const check = async () => {
      const st = await e2eeManager.getVerificationState(peerId)
      if (!cancelled) setVerifyState(st)
    }
    check()
    const t = setTimeout(check, 1500)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [peerId])

  const handleSend = useCallback(async () => {
    if (!input.trim()) return

    const config: BurnConfig = {
      mode: burnMode,
      ...(burnMode === 'timed' && { burnAfter }),
    }

    try {
      await messageManager.send(input.trim(), config)
      setInput('')
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
        }
        textareaRef.current?.focus()
      })
    } catch (err) {
      error('[ChatView] Send message failed:', err)
    }
  }, [input, burnMode, burnAfter])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [])

  const handleLeave = useCallback(() => {
    roomManager.leaveRoom()
  }, [])

  const handleCopyCode = useCallback(async () => {
    const roomId = roomManager.room?.id
    if (!roomId) return
    try {
      await navigator.clipboard.writeText(roomId)
      setCopied(true)
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
    } catch {
      // Clipboard API not available (non-secure context)
    }
  }, [])

  const handleDestroy = useCallback(() => {
    setMessages(messageManager.getMessages())
  }, [])


  return (
    <div
      className="page-enter chat-view"
      style={{ height: viewportHeight }}
    >
      {/* Header */}
      <GlassCard variant="strong" className="chat-header">
        <div className="chat-header-inner">
          <div className="chat-header-left">
            <div className="chat-header-name">{room?.name ?? t.room.join}</div>
          </div>
          <div className="chat-header-right">
            <div className="chat-header-status">
              <div className={`chat-status-dot ${status}`} aria-hidden="true" />
              <span className="chat-status-text">
                {status === 'connected'
                  ? `${(room?.peers.length ?? 0) + 1} ${t.room.online}`
                  : status === 'reconnecting'
                    ? t.room.reconnecting
                    : t.room.disconnected}
              </span>
            </div>
            {peerId && (
              <button
                onClick={() => setSafetyOpen(true)}
                className="chat-safety-btn"
                aria-label={t.safety.title}
                title={
                  verifyState === 'verified'
                    ? t.safety.verified
                    : verifyState === 'changed'
                      ? t.safety.changed
                      : t.safety.unconfirmed
                }
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  filter:
                    verifyState === 'verified'
                      ? 'grayscale(0)'
                      : verifyState === 'changed'
                        ? 'hue-rotate(-40deg) saturate(3)'
                        : 'grayscale(1) opacity(0.6)',
                }}
              >
                {verifyState === 'changed' ? '⚠️' : '🛡️'}
              </button>
            )}
            <button
              onClick={handleLeave}
              className="chat-leave-btn"
            >
              {t.room.leave}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Room code - hidden when keyboard open */}
      {room?.id && !keyboardOpen && (
        <div
          className="room-code-bar"
          onClick={handleCopyCode}
          role="button"
          tabIndex={0}
          aria-label={t.room.copy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleCopyCode()
            }
          }}
        >
          <span className="room-code-label">{t.room.roomCode}</span>
          <span className="room-code-value">{room.id}</span>
          <span className={`pop-in room-code-status ${copied ? 'copied' : 'default'}`}>
            {copied ? t.room.copied : t.room.copy}
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <span>{t.room.empty}</span>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} roomId={room?.id ?? ''} onDestroy={handleDestroy} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <GlassCard variant="strong" className="chat-input-area">
        <div className={`chat-input-inner ${keyboardOpen ? 'compressed' : ''}`}>
          {/* Burn mode selector - hidden when keyboard is open */}
          {!keyboardOpen && (
            <div className="burn-mode-row">
              {[
                { mode: BurnMode.PERSIST, label: t.burn.persist },
                { mode: BurnMode.READ_ONCE, label: t.burn.readOnce },
                { mode: BurnMode.TIMED, label: t.burn.timed },
              ].map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => setBurnMode(mode)}
                  className={`burn-mode-btn ${burnMode === mode ? 'active' : ''}`}
                >
                  {label}
                </button>
              ))}
              {burnMode === BurnMode.TIMED && (
                <select
                  value={burnAfter}
                  onChange={(e) => setBurnAfter(Number(e.target.value))}
                  className="burn-timer-select"
                >
                  <option value={10}>{t.burn.timer10s}</option>
                  <option value={30}>{t.burn.timer30s}</option>
                  <option value={60}>{t.burn.timer1m}</option>
                  <option value={300}>{t.burn.timer5m}</option>
                  <option value={600}>{t.burn.timer10m}</option>
                </select>
              )}
            </div>
          )}

          {/* Input row */}
          <div className="chat-input-row">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={t.message.placeholder}
              rows={1}
              className="chat-textarea"
              maxLength={10000}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={`chat-send-btn ${input.trim() ? 'active' : ''}`}
            >
              {t.message.send}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* 离线/重连提示 */}
      {(status === 'reconnecting' || status === 'disconnected') && (
        <div
          className="overlay-enter chat-reconnect-overlay"
        >
          <div className="chat-reconnect-spinner" />
          <span className="chat-reconnect-text">
            {status === 'reconnecting' ? t.room.reconnecting : t.room.disconnected}
          </span>
        </div>
      )}

      {/* 安全码核对弹窗 */}
      <SafetyCheckDialog
        open={safetyOpen}
        peerId={peerId}
        onClose={() => {
          setSafetyOpen(false)
          // 关闭后刷新一次按钮状态（用户可能刚点了"我已核对一致"）
          if (peerId) {
            e2eeManager.getVerificationState(peerId).then(setVerifyState)
          }
        }}
      />
    </div>
  )
}
