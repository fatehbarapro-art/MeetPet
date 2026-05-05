import { useEffect, useRef } from 'react'
import type { BlopState } from '../../types/index.ts'

const MOOD_COLORS: Record<string, string> = {
  euphoric:   '#7B2FBE',
  happy:      '#5B8DEF',
  stressed:   '#FF8C00',
  sad:        '#FF4444',
  distressed: '#FF3333',
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function lerpColor(a: string, b: string, t: number) {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  return `rgb(${Math.round(ca.r + (cb.r - ca.r) * t)},${Math.round(ca.g + (cb.g - ca.g) * t)},${Math.round(ca.b + (cb.b - ca.b) * t)})`
}

export default function BlopCanvas({ state }: { state: BlopState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<{ jump: number; shake: number; prevMood: string; colorT: number }>({
    jump: 0, shake: 0, prevMood: state.mood, colorT: 1
  })
  const frameRef = useRef<number>(0)

  // Déclencher animations sur changement de mood
  useEffect(() => {
    const anim = animRef.current
    if (state.mood === 'euphoric' || state.happiness > 80) {
      // Saut
      let f = 0
      const jump = () => {
        anim.jump = -Math.sin((f / 20) * Math.PI) * 30
        f++
        if (f < 20) requestAnimationFrame(jump)
        else anim.jump = 0
      }
      requestAnimationFrame(jump)
    }
    if (state.happiness < 40) {
      // Tremblement
      let f = 0
      const shake = () => {
        anim.shake = (Math.random() - 0.5) * 6
        f++
        if (f < 30) requestAnimationFrame(shake)
        else anim.shake = 0
      }
      requestAnimationFrame(shake)
    }
    anim.prevMood = state.mood
    anim.colorT = 0
  }, [state.mood, state.happiness])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width
    const H = canvas.height
    const cx = W / 2
    const cy = H / 2

    let t = 0

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      const anim = animRef.current
      anim.colorT = Math.min(1, anim.colorT + 0.02)

      const targetColor = MOOD_COLORS[state.mood] ?? '#5B8DEF'
      const fromColor = MOOD_COLORS[anim.prevMood] ?? targetColor
      const color = lerpColor(fromColor, targetColor, anim.colorT)

      const breathY = Math.sin(t * 0.04) * 3
      const x = cx + anim.shake
      const y = cy + anim.jump + breathY

      const bw = 60 + Math.sin(t * 0.04) * 2
      const bh = 70 - Math.sin(t * 0.04) * 2

      // Corps
      ctx.beginPath()
      ctx.ellipse(x, y, bw, bh, 0, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()

      // Oreilles
      ctx.beginPath()
      ctx.ellipse(x - bw + 8, y - 22, 12, 18, -0.4, 0, Math.PI * 2)
      ctx.ellipse(x + bw - 8, y - 22, 12, 18, 0.4, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()

      // Yeux
      const eyeY = y - 10 + Math.sin(t * 0.03) * 1.5
      const blink = Math.sin(t * 0.01) > 0.95
      if (blink) {
        ctx.beginPath()
        ctx.moveTo(x - 20, eyeY)
        ctx.lineTo(x - 10, eyeY)
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x + 10, eyeY)
        ctx.lineTo(x + 20, eyeY)
        ctx.stroke()
      } else {
        [x - 15, x + 15].forEach(ex => {
          ctx.beginPath()
          ctx.arc(ex, eyeY, 8, 0, Math.PI * 2)
          ctx.fillStyle = '#fff'
          ctx.fill()
          ctx.beginPath()
          ctx.arc(ex + 2, eyeY + 1, 4, 0, Math.PI * 2)
          ctx.fillStyle = '#1a1a2e'
          ctx.fill()
        })
      }

      // Bouche
      const smileAmt = (state.happiness - 50) / 50  // -1 à 1
      const mouthY = y + 25
      ctx.beginPath()
      ctx.moveTo(x - 18, mouthY)
      ctx.quadraticCurveTo(x, mouthY + smileAmt * 16, x + 18, mouthY)
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.stroke()

      // Larme si triste
      if (state.happiness < 40) {
        const tearY = eyeY + 10 + ((t * 2) % 20)
        ctx.beginPath()
        ctx.arc(x - 15, tearY, 3, 0, Math.PI * 2)
        ctx.fillStyle = '#60a5fa'
        ctx.fill()
      }

      t++
      frameRef.current = requestAnimationFrame(draw)
    }

    frameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frameRef.current)
  }, [state])

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={200}
      className="drop-shadow-[0_0_20px_rgba(123,47,190,0.4)]"
    />
  )
}
