import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import '../styles/sheet.css'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/**
 * 移动端友好的底部抽屉（bottom sheet）。
 *
 * - 手机端从屏幕底部滑出，桌面端（≥768px）自动转为居中模态卡片。
 * - 支持：点击遮罩关闭、Esc 关闭、从顶部把手向下拖拽关闭、焦点还原。
 * - 尊重 safe-area-inset（刘海/灵动岛/底部小白条）。
 * - 复用全局设计令牌（--bg-secondary / --glass-border / --glass-shadow）。
 */
export default function BottomSheet({ open, onClose, title, children }: Props) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const dragStartY = useRef<number | null>(null)

  // 挂载/卸载伴随动画；关闭时还原触发元素焦点
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement
      setMounted(true)
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
      const t = setTimeout(() => {
        setMounted(false)
        if (triggerRef.current instanceof HTMLElement) {
          triggerRef.current.focus()
          triggerRef.current = null
        }
      }, 250)
      return () => clearTimeout(t)
    }
  }, [open])

  // Esc 关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!mounted) return null

  // 从把手向下拖拽关闭
  const onHandleDown = (e: ReactPointerEvent) => {
    dragStartY.current = e.clientY
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    if (panelRef.current) panelRef.current.style.transition = 'none'
  }
  const onHandleMove = (e: ReactPointerEvent) => {
    if (dragStartY.current == null || !panelRef.current) return
    const dy = Math.max(0, e.clientY - dragStartY.current)
    panelRef.current.style.transform = `translateY(${dy}px)`
  }
  const onHandleUp = () => {
    const panel = panelRef.current
    dragStartY.current = null
    if (!panel) return
    const dy = panel.style.transform ? parseInt(panel.style.transform.replace(/[^0-9]/g, ''), 10) || 0 : 0
    panel.style.transition = ''
    panel.style.transform = ''
    if (dy > 120) onClose()
  }

  return createPortal(
    <div
      className={`sheet-backdrop ${visible ? 'is-open' : ''}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        className={`sheet-panel ${visible ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sheet-handle"
          aria-hidden="true"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
        />
        {title && (
          <div className="sheet-header">
            <h3 className="sheet-title">{title}</h3>
          </div>
        )}
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
