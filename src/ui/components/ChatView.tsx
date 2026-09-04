import { useState, useEffect, useRef } from 'react'
import type { Message, BurnConfig } from '../../core/types'
import { BurnMode } from '../../core/types'
import { messageManager } from '../../core/message'
import { roomManager } from '../../core/room'
import GlassCard from './GlassCard'
import MessageBubble from './MessageBubble'

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>(() =>
    messageManager.getMessages(),
  )
  const [input, setInput] = useState('')
  const [burnMode, setBurnMode] = useState<BurnMode>(BurnMode.PERSIST)
  const [burnAfter, setBurnAfter] = useState(60)
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

  const handleSend = async () => {
    if (!input.trim()) return

    const config: BurnConfig = {
      mode: burnMode,
      ...(burnMode === 'timed' && { burnAfter }),
      ...(burnMode === 'scheduled' && { burnAt: Date.now() + burnAfter * 1000 }),
    }

    await messageManager.send(input.trim(), config)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleLeave = () => {
    roomManager.leaveRoom()
  }

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
            <div style={{ fontWeight: 600, fontSize: '1rem' }}>{room?.name ?? '房间'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '1px' }}>
              {room?.id}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {roomManager.room?.peers.length ?? 0} 在线
            </span>
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
              退出
            </button>
          </div>
        </div>
      </GlassCard>

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
            还没有消息，说点什么吧
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onDestroy={() => setMessages(messageManager.getMessages())}
          />
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
              { mode: BurnMode.PERSIST, label: '永久' },
              { mode: BurnMode.READ_ONCE, label: '阅后即焚' },
              { mode: BurnMode.TIMED, label: '定时' },
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
                <option value={10}>10秒</option>
                <option value={30}>30秒</option>
                <option value={60}>1分钟</option>
                <option value={300}>5分钟</option>
                <option value={600}>10分钟</option>
              </select>
            )}
          </div>

          {/* Input row */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="说点什么..."
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
              发送
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
