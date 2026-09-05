import { useState, useCallback } from 'react'
import ConfirmDialog from './ConfirmDialog'

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
