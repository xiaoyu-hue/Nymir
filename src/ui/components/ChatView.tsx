import { useState, useEffect, useRef, useCallback } from 'react'
import type { Message, BurnConfig } from '../../core/types'
import { BurnMode } from '../../core/types'
import { messageManager } from '../../core/message'
import { roomManager } from '../../core/room'
import { peerManager } from '../../communication/peer'
import { useRoom } from '../hooks/useRoom'
import { useI18n } from '../../i18n'
import GlassCard from './GlassCard'
import MessageBubble from './MessageBubble'

export default function ChatView() {
  const { status } = useRoom()
  const { t } = useI18n()
  const [messages, setMessages] = useState<Message[]>(() =>
    messageManager.getMessages(),
  )
  const [input, setInput] = useState('')
  const [burnMode, setBurnMode] = useState<BurnMode>(BurnMode.PERSIST)
  const [burnAfter, setBurnAfter] = useState(60)
  const [copied, setCopied] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const readMsgIdsRef = useRef<Set<string>>(new Set())
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 虚拟键盘检测
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const handleResize = () => {
      setKeyboardOpen(vv.height < window.innerHeight * 0.7)
    }

    vv.addEventListener('resize', handleResize)
    return () => vv.removeEventListener('resize', handleResize)
  }, [])

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

  const handleSend = useCallback(async () => {
    if (!input.trim()) return

    const config: BurnConfig = {
      mode: burnMode,
      ...(burnMode === 'timed' && { burnAfter }),
      ...(burnMode === 'scheduled' && { burnAt: Date.now() + burnAfter * 1000 }),
    }

    await messageManager.send(input.trim(), config)
    setInput('')
    // 重置输入框高度并保持光标
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
      textareaRef.current?.focus()
    })
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

  // 输入框自动增高
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
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.createElement('input')
      input.value = roomId
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [])

  const handleDestroy = useCallback(() => {
    setMessages(messageManager.getMessages())
  }, [])

  const room = roomManager.room

  return (
    <div
      className="page-enter chat-view"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        zIndex: 1,
      }}
    >
      {/* Header */}
      <GlassCard variant="strong" className="chat-header">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: '1rem' }}>{room?.name ?? t.room.join}</div>
            <div
              onClick={handleCopyCode}
              style={{
                fontSize: '0.85rem',
                color: 'var(--accent)',
                letterSpacing: '2px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '2px',
              }}
            >
              {room?.id}
              <span
                className={copied ? 'pop-in' : ''}
                style={{ fontSize: '0.7rem', color: copied ? 'var(--success)' : 'var(--text-muted)' }}
              >
                {copied ? '✓' : '📋'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background:
                    status === 'connected'
                      ? 'var(--success)'
                      : status === 'reconnecting'
                        ? 'var(--warning)'
                        : 'var(--danger)',
                  animation: status === 'reconnecting' ? 'pulse 1.5s infinite' : 'none',
                  transition: 'background 0.3s ease',
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {status === 'connected'
                  ? `${roomManager.room?.peers.length ?? 0} ${t.room.online}`
                  : status === 'reconnecting'
                    ? t.room.reconnecting
                    : t.room.disconnected}
              </span>
            </div>
            <button
              onClick={handleLeave}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                background: 'rgba(239,68,68,0.15)',
                color: 'var(--danger)',
                fontSize: '0.8rem',
              }}
            >
              {t.room.leave}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Room code - prominent display */}
      {room?.id && (
        <div
          className="room-code-bar"
          onClick={handleCopyCode}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px 16px',
            margin: '0 16px',
            borderRadius: '10px',
            background: 'rgba(124,106,239,0.12)',
            border: '1px solid rgba(124,106,239,0.25)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            userSelect: 'none',
          }}
          title={t.room.copyHint}
        >
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            {t.room.roomCode}
          </span>
          <span
            style={{
              color: 'var(--accent)',
              fontSize: '1.1rem',
              fontWeight: 700,
              letterSpacing: '3px',
              fontFamily: 'monospace',
            }}
          >
            {room.id}
          </span>
          <span
            className={copied ? 'pop-in' : ''}
            style={{ color: copied ? 'var(--success)' : 'var(--text-muted)', fontSize: '0.75rem' }}
          >
            {copied ? t.room.copied : t.room.copy}
          </span>
        </div>
      )}

      {/* Messages */}
      <div
        className="chat-messages"
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 0',
          gap: '4px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              gap: '12px',
            }}
          >
            <div
              style={{
                fontSize: '2rem',
                animation: 'breathe 3s ease-in-out infinite',
              }}
            >
              💬
            </div>
            <span style={{ fontSize: '0.9rem' }}>{t.room.empty}</span>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} roomId={room?.id ?? ''} onDestroy={handleDestroy} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <GlassCard variant="strong" className="chat-input-area">
        <div className="chat-input-inner" style={{ padding: keyboardOpen ? '8px 12px' : '12px 16px' }}>
          {/* Burn mode selector - hidden when keyboard is open */}
          {!keyboardOpen && (
          <div
            style={{
              display: 'flex',
              gap: '6px',
              marginBottom: '10px',
              flexWrap: 'wrap',
            }}
          >
            {[
              { mode: BurnMode.PERSIST, label: t.burn.persist },
              { mode: BurnMode.READ_ONCE, label: t.burn.readOnce },
              { mode: BurnMode.TIMED, label: t.burn.timed },
            ].map(({ mode, label }) => (
              <button
                key={mode}
                onClick={() => setBurnMode(mode)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  background:
                    burnMode === mode ? 'rgba(124,106,239,0.3)' : 'rgba(255,255,255,0.05)',
                  color: burnMode === mode ? 'var(--accent)' : 'var(--text-muted)',
                  border:
                    burnMode === mode
                      ? '1px solid var(--accent)'
                      : '1px solid transparent',
                }}
              >
                {label}
              </button>
            ))}
            {burnMode === BurnMode.TIMED && (
              <select
                value={burnAfter}
                onChange={(e) => setBurnAfter(Number(e.target.value))}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--glass-border)',
                  fontSize: '0.7rem',
                }}
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
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={t.message.placeholder}
              rows={1}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                resize: 'none',
                minHeight: '42px',
                maxHeight: '120px',
                lineHeight: '1.5',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              style={{
                padding: '10px 20px',
                borderRadius: '12px',
                background: input.trim()
                  ? 'linear-gradient(135deg, var(--accent), #5b4bc9)'
                  : 'rgba(255,255,255,0.05)',
                color: input.trim() ? 'white' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              {t.message.send}
            </button>
          </div>
        </div>
      </GlassCard>
      {/* 离线/重连提示 */}
      {(status === 'reconnecting' || status === 'disconnected') && (
        <div
          className="overlay-enter"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            zIndex: 40,
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid rgba(245,158,11,0.2)',
              borderTopColor: 'var(--warning)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {status === 'reconnecting' ? t.room.reconnecting : t.room.disconnected}
          </span>
        </div>
      )}
    </div>
  )
}
