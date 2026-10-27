import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import '../styles/sheet.css'

export type ToastType = 'success' | 'error' | 'info'

type ToastItem = { id: number; message: string; type: ToastType }

type ToastCtx = {
  show: (message: string, type?: ToastType, duration?: number) => void
}

const Ctx = createContext<ToastCtx>({ show: () => {} })

export const useToast = () => useContext(Ctx)

/**
 * 轻提示 Provider：替代各处 ad-hoc 的"已复制/成功"反馈。
 * 用法：const { show } = useToast(); show('已复制', 'success')
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const show = useCallback((message: string, type: ToastType = 'info', duration = 2200) => {
    const id = ++idRef.current
    setItems((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id))
    }, duration)
  }, [])

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`toast toast-${i.type}`}>
            {i.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
