import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ArrowLeft,
  MoreVertical,
  Handshake,
  ShieldCheck,
  KeyRound,
  Timer,
  Copy,
  LogOut,
  Check,
} from 'lucide-react'
import type { Message, BurnConfig } from '../../core/types'
import { BurnMode } from '../../core/types'
import { messageManager } from '../../core/message'
import { roomManager } from '../../core/room'
import { peerManager } from '../../communication/peer'
import { useRoom } from '../hooks/useRoom'
import { useI18n } from '../../i18n'
import { useKeyboard } from '../../App'
import { error } from '../../utils/logger'
import { e2eeManager, type VerificationState } from '../../security/e2eeManager'
import GlassCard from './GlassCard'
import MessageBubble from './MessageBubble'
import SafetyCheckDialog from './SafetyCheckDialog'
import OutOfBandVerify from './OutOfBandVerify'
import BottomSheet from './BottomSheet'
import { useToast } from './Toast'
import { useConfirm } from './useConfirm'

export default function ChatView() {
  const { status, room } = useRoom()
  const { t } = useI18n()
  const { keyboardOpen, viewportHeight } = useKeyboard()
  const { confirm, ConfirmDialog } = useConfirm()
  const { show: showToast } = useToast()
  const [messages, setMessages] = useState<Message[]>(() =>
    messageManager.getMessages(),
  )
  const [input, setInput] = useState('')
  const [burnMode, setBurnMode] = useState<BurnMode>(BurnMode.PERSIST)
  const [burnAfter, setBurnAfter] = useState(60)
  const [menuOpen, setMenuOpen] = useState(false)
  const [burnOpen, setBurnOpen] = useState(false)
  const [safetyOpen, setSafetyOpen] = useState(false)
  const [oobOpen, setOobOpen] = useState(false)
  const [verifyState, setVerifyState] = useState<VerificationState>('unverified')
  const [rotateState, setRotateState] = useState<'idle' | 'busy' | 'success' | 'fail'>('idle')
  const rotateTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const readMsgIdsRef = useRef<Set<string>>(new Set())
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // 防止 changed 状态重复自动弹窗
  const autoOpenedRef = useRef(false)

  useEffect(() => {
    const unsub = messageManager.onMessage(() => {
      setMessages(messageManager.getMessages())
    })
    return unsub
  }, [])

  // 仅在用户位于底部附近时自动滚动，避免打断历史浏览
  useEffect(() => {
    const el = messagesEndRef.current
    if (!el) return
    const distToBottom = el.getBoundingClientRect().bottom - window.innerHeight
    if (distToBottom < 150) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Mark messages as read when they appear (deduplicated)
  useEffect(() => {
    for (const msg of messages) {
      if (msg.sender !== peerManager.id && !readMsgIdsRef.current.has(msg.id)) {
        readMsgIdsRef.current.add(msg.id)
        messageManager.markRead(msg.id)
      }
    }
    // 限制 Set 大小，防止长会话内存持续增长
    const ids = Array.from(readMsgIdsRef.current)
    if (ids.length > 500) {
      readMsgIdsRef.current = new Set(ids.slice(-500))
    }
  }, [messages])

  // 双人场景：对端即 peers[0]
  const peerId = room?.peers?.[0] ?? null

  // 对端出现后，查询带外验证状态；公钥交换是异步的，稍后再补查一次
  useEffect(() => {
    autoOpenedRef.current = false
    if (!peerId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVerifyState('unverified')
      return
    }
    let cancelled = false
    const check = async () => {
      const st = await e2eeManager.getVerificationState(peerId)
      if (cancelled) return
      setVerifyState(st)
      // 上次核对过但当前指纹变了：自动弹窗警告，不静默放过
      if (st === 'changed' && !autoOpenedRef.current) {
        autoOpenedRef.current = true
        setSafetyOpen(true)
      }
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

  // 可验证密钥轮换：确认后生成新钥对并安全广播，对端验签通过才 re-pin
  const handleRotateKeys = useCallback(async () => {
    const ok = await confirm(t.keyRotation.confirmMsg)
    if (!ok) return
    if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current)
    setRotateState('busy')
    try {
      const rotated = await messageManager.rotateKeys()
      setRotateState(rotated ? 'success' : 'fail')
    } catch {
      setRotateState('fail')
    }
    rotateTimerRef.current = setTimeout(() => setRotateState('idle'), 4000)
  }, [confirm, t])

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [])

  const handleLeaveConfirm = useCallback(async () => {
    setMenuOpen(false)
    const ok = await confirm(t.chat.leaveConfirm)
    if (ok) roomManager.leaveRoom()
  }, [confirm, t])

  const handleCopyCode = useCallback(async () => {
    const roomId = roomManager.room?.id
    if (!roomId) return
    try {
      await navigator.clipboard.writeText(roomId)
      showToast(t.room.copied, 'success')
    } catch {
      // Clipboard API not available (non-secure context)
    }
  }, [showToast, t])

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
          <button
            onClick={handleLeaveConfirm}
            className="chat-icon-btn"
            aria-label={t.chat.back}
            title={t.chat.back}
          >
            <ArrowLeft aria-hidden="true" />
          </button>
          <div className="chat-header-left">
            <div className="chat-header-name">{room?.name ?? t.room.join}</div>
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
          </div>
          <div className="chat-header-right">
            {/* 带外核对：不依赖对端在线，未连接时也应可用（ADR-0009） */}
            <button
              onClick={() => setOobOpen(true)}
              className="chat-icon-btn chat-oob-btn"
              aria-label={t.oob.title}
              title={t.oob.title}
            >
              <Handshake aria-hidden="true" />
            </button>
            <button
              onClick={() => setMenuOpen(true)}
              className="chat-icon-btn"
              aria-label={t.chat.menuTitle}
              title={t.chat.menuTitle}
            >
              <MoreVertical aria-hidden="true" />
            </button>
          </div>
        </div>
      </GlassCard>

      {/* 对话操作菜单 */}
      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title={t.chat.menuTitle}>
        <div className="sheet-menu">
          {room?.id && (
            <button className="settings-row" onClick={handleCopyCode}>
              <Copy className="settings-row-icon" aria-hidden="true" />
              <span className="settings-row-label">{t.room.roomCode}</span>
              <span className="menu-code-value">{room.id}</span>
            </button>
          )}
          {peerId && (
            <button
              className="settings-row"
              aria-label={t.safety.title}
              onClick={() => {
                setMenuOpen(false)
                setSafetyOpen(true)
              }}
            >
              <ShieldCheck
                className={`settings-row-icon ${verifyState === 'changed' ? 'danger' : ''}`}
                aria-hidden="true"
              />
              <span className="settings-row-label">{t.safety.title}</span>
              <span className={`settings-row-value ${verifyState === 'changed' ? 'danger' : ''}`}>
                {verifyState === 'verified'
                  ? t.chat.verifyOk
                  : verifyState === 'changed'
                    ? t.chat.verifyChanged
                    : t.safety.unconfirmed}
              </span>
            </button>
          )}
          {peerId && (
            <button
              className="settings-row"
              aria-label={t.keyRotation.title}
              onClick={() => {
                setMenuOpen(false)
                handleRotateKeys()
              }}
            >
              <KeyRound className="settings-row-icon" aria-hidden="true" />
              <span className="settings-row-label">{t.keyRotation.title}</span>
              <span className="settings-row-value">
                {rotateState === 'busy' ? t.keyRotation.busy : ''}
              </span>
            </button>
          )}
          <button className="settings-row settings-row-danger" onClick={handleLeaveConfirm}>
            <LogOut className="settings-row-icon" aria-hidden="true" />
            <span className="settings-row-label">{t.room.leave}</span>
          </button>
        </div>
      </BottomSheet>

      {/* 未核对安全码时的黄色提示条（可点击直接打开核对弹窗） */}
      {peerId && verifyState === 'unverified' && (
        <div
          className="safety-banner"
          role="button"
          tabIndex={0}
          onClick={() => setSafetyOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setSafetyOpen(true)
            }
          }}
        >
          <span aria-hidden="true">⚠️</span>
          <span>{t.safety.unverifiedBanner}</span>
        </div>
      )}

      {/* 密钥轮换结果横幅 */}
      {(rotateState === 'success' || rotateState === 'fail') && (
        <div
          className={`rotate-banner ${rotateState === 'success' ? 'rotate-banner-ok' : 'rotate-banner-fail'}`}
          role="status"
        >
          <span aria-hidden="true">{rotateState === 'success' ? '✅' : '❌'}</span>
          <span>
            {rotateState === 'success' ? t.keyRotation.success : t.keyRotation.fail}
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
          {/* Input row */}
          <div className="chat-input-row">
            <button
              type="button"
              onClick={() => setBurnOpen(true)}
              className={`chat-burn-btn burn-${burnMode}`}
              aria-label={t.burn.title}
              title={
                burnMode === BurnMode.TIMED
                  ? `${t.burn.timed} · ${
                      burnAfter >= 60 ? `${burnAfter / 60} min` : `${burnAfter} s`
                    }`
                  : burnMode === BurnMode.READ_ONCE
                    ? t.burn.readOnce
                    : t.burn.persist
              }
            >
              <Timer aria-hidden="true" />
              {burnMode === BurnMode.TIMED && (
                <span className="chat-burn-duration">
                  {burnAfter >= 60 ? `${burnAfter / 60}m` : `${burnAfter}s`}
                </span>
              )}
            </button>
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

      {/* 阅后即焚模式选择 */}
      <BottomSheet open={burnOpen} onClose={() => setBurnOpen(false)} title={t.burn.title}>
        <div className="burn-sheet" role="radiogroup" aria-label={t.burn.title}>
          {[
            { mode: BurnMode.PERSIST, label: t.burn.persist, desc: t.burn.persistDesc },
            { mode: BurnMode.READ_ONCE, label: t.burn.readOnce, desc: t.burn.readOnceDesc },
            { mode: BurnMode.TIMED, label: t.burn.timed, desc: t.burn.timedDesc },
          ].map(({ mode, label, desc }) => (
            <button
              key={mode}
              onClick={() => setBurnMode(mode)}
              className={`burn-option ${burnMode === mode ? 'active' : ''}`}
              role="radio"
              aria-checked={burnMode === mode}
            >
              <span className="burn-option-text">
                <span className="burn-option-label">{label}</span>
                <span className="burn-option-desc">{desc}</span>
              </span>
              {burnMode === mode && <Check className="burn-option-check" aria-hidden="true" />}
            </button>
          ))}
          {burnMode === BurnMode.TIMED && (
            <div className="burn-duration-row">
              <span>{t.burn.duration}</span>
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
            </div>
          )}
        </div>
      </BottomSheet>

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
            e2eeManager
              .getVerificationState(peerId)
              .then(setVerifyState)
              .catch(() => {
                /* 状态查询失败不打扰用户 */
              })
          }
        }}
      />

      {/* 带外身份核对抽屉 */}
      <OutOfBandVerify
        open={oobOpen}
        peerId={peerId}
        onClose={() => setOobOpen(false)}
      />

      {/* 密钥轮换确认弹窗 */}
      <ConfirmDialog />
    </div>
  )
}
