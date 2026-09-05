import { useMemo, useEffect, useState, memo } from 'react'
import { STAR_COUNT_LOW, STAR_COUNT_HIGH, SHOOTING_STAR_REMOVAL_MS, SHOOTING_STAR_INTERVAL_MIN_MS, SHOOTING_STAR_INTERVAL_MAX_MS } from '../../constants'
import '../styles/starfield.css'

interface Star {
  id: number
  x: number
  y: number
  size: number
  duration: number
  delay: number
}

interface ShootingStar {
  id: number
  x: number
  y: number
  dx: number
  dy: number
  duration: number
}

function generateStars(count: number): Star[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() > 0.9 ? 3 : Math.random() > 0.7 ? 2 : 1,
    duration: 2 + Math.random() * 4,
    delay: Math.random() * 5,
  }))
}

/**
 * 检测是否为低端设备（简化判断）
 */
function isLowEndDevice(): boolean {
  // 检查硬件并发数（CPU 核心数）
  const cores = navigator.hardwareConcurrency ?? 2
  if (cores <= 2) return true

  // 检查设备内存（仅 Chrome 支持）
  const memory = (navigator as { deviceMemory?: number }).deviceMemory
  if (memory !== undefined && memory < 4) return true

  return false
}

export default memo(function Starfield() {
  const starCount = isLowEndDevice() ? STAR_COUNT_LOW : STAR_COUNT_HIGH
  const stars = useMemo(() => generateStars(starCount), [starCount])
  const [shootingStars, setShootingStars] = useState<ShootingStar[]>([])

  useEffect(() => {
    let nextId = 0
    let cancelled = false
    const spawn = () => {
      if (cancelled) return
      const id = nextId++
      const startX = Math.random() * 80 + 10
      const startY = Math.random() * 40
      const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.5
      const dist = 150 + Math.random() * 200

      setShootingStars((prev) => [
        ...prev.slice(-3),
        {
          id,
          x: startX,
          y: startY,
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          duration: 0.6 + Math.random() * 0.6,
        },
      ])

      setTimeout(() => {
        if (!cancelled) {
          setShootingStars((prev) => prev.filter((s) => s.id !== id))
        }
      }, SHOOTING_STAR_REMOVAL_MS)
    }

    const interval = setInterval(spawn, SHOOTING_STAR_INTERVAL_MIN_MS + Math.random() * SHOOTING_STAR_INTERVAL_MAX_MS)
    const initialTimeout = setTimeout(spawn, 2000)

    return () => {
      cancelled = true
      clearInterval(interval)
      clearTimeout(initialTimeout)
    }
  }, [])

  return (
    <div className="starfield-container">
      {stars.map((star) => (
        <div
          key={star.id}
          className={`star ${star.size > 2 ? 'star-bright' : ''}`}
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            '--duration': `${star.duration}s`,
            '--delay': `${star.delay}s`,
          } as React.CSSProperties}
        />
      ))}
      {shootingStars.map((s) => (
        <div
          key={s.id}
          className="shooting-star"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            '--dx': `${s.dx}px`,
            '--dy': `${s.dy}px`,
            animationDuration: `${s.duration}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
})
