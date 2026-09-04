import type { ReactNode, MouseEvent } from 'react'
import '../styles/glass.css'

type Props = {
  children: ReactNode
  variant?: 'default' | 'strong' | 'subtle'
  className?: string
  onClick?: (e?: MouseEvent) => void
}

export default function GlassCard({
  children,
  variant = 'default',
  className = '',
  onClick,
}: Props) {
  const variantClass =
    variant === 'strong'
      ? 'glass-strong'
      : variant === 'subtle'
        ? 'glass-subtle'
        : 'glass'

  return (
    <div
      className={`${variantClass} ${className}`}
      onClick={onClick ? (e) => onClick(e) : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick()
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}
