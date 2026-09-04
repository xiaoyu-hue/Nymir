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

  useEffect(() => {
    const unsub = messageManager.onMessage(() => {
      setMessages(messageManager.getMessages())
    })
    return unsub
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark messages as read when they appear
  useEffect(() => {
    for (const msg of messages) {
      if (msg.sender !== peerManager.id) {
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
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
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
          <span style={{ color: copied ? 'var(--success)' : 'var(--text-muted)', fontSize: '0.75rem' }}>
            {copied ? t.room.copied : t.room.copy}
          </span>
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 0',
          gap: '4px',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
            }}
          >
            {t.room.empty}
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} roomId={room?.id ?? ''} onDestroy={handleDestroy} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <GlassCard variant="strong" className="chat-input-area">
        <div style={{ padding: '12px 16px' }}>
          {/* Burn mode selector */}
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
                  transition: 'all 0.2s',
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

          {/* Input row */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
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
                transition: 'all 0.2s',
              }}
            >
              {t.message.send}
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
