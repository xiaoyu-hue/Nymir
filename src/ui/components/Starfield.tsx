import { useMemo, useEffect, useState } from 'react'
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

export default function Starfield() {
  const stars = useMemo(() => generateStars(120), [])
  const [shootingStars, setShootingStars] = useState<ShootingStar[]>([])

  useEffect(() => {
    let nextId = 0
    const spawn = () => {
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
        setShootingStars((prev) => prev.filter((s) => s.id !== id))
      }, 1500)
    }

    const interval = setInterval(spawn, 4000 + Math.random() * 6000)
    const initialTimeout = setTimeout(spawn, 2000)

    return () => {
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
}
