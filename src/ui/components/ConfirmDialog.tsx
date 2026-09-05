import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import GlassCard from './GlassCard'

type Props = {
  open: boolean
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ open, message, onConfirm, onCancel }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [open])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    },
    [onCancel],
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleKeyDown])

  if (!open) return null

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-message"
      className={`overlay-enter ${visible ? '' : 'confirm-hidden'}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}
      onClick={onCancel}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <GlassCard variant="strong" className="modal-enter">
          <div style={{ padding: '24px', minWidth: 'min(300px, 85vw)', maxWidth: '400px' }}>
            <p
              id="confirm-dialog-message"
              style={{
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                lineHeight: 1.5,
                marginBottom: '20px',
                textAlign: 'center',
              }}
            >
              {message}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={onCancel}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                }}
              >
                取消
              </button>
              <button
                onClick={onConfirm}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: 'var(--danger)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                确认
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>,
    document.body,
  )
}

export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean
    message: string
    resolve: ((value: boolean) => void) | null
  }>({ open: false, message: '', resolve: null })

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ open: true, message, resolve })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    state.resolve?.(true)
    setState({ open: false, message: '', resolve: null })
  }, [state])

  const handleCancel = useCallback(() => {
    state.resolve?.(false)
    setState({ open: false, message: '', resolve: null })
  }, [state])

  const ConfirmDialogElement = useCallback(
    () => (
      <ConfirmDialog
        open={state.open}
        message={state.message}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
    [state.open, state.message, handleConfirm, handleCancel],
  )

  return { confirm, ConfirmDialog: ConfirmDialogElement }
}
