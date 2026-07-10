import { useEffect, useRef } from 'react'

const STATE_COLORS = {
  idle: '#49E6FF',
  listening: '#49E6FF',
  thinking: '#49E6FF',
  searching: '#49E6FF',
  executing: '#FFC247',
  speaking: '#00FF99',
  error: '#FF5D73',
}

function hexA(hex, a) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function stateLabel(state, tool) {
  const map = {
    idle: 'Idle',
    listening: 'Listening',
    thinking: 'Thinking',
    searching: 'Searching',
    speaking: 'Speaking',
    error: 'Error',
  }
  if (state === 'executing') return `Executing · ${tool || ''}`.trim()
  return map[state] || state
}

export default function AICore({ state = 'idle', activeTool = null }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(state)
  const toolRef = useRef(activeTool)
  stateRef.current = state
  toolRef.current = activeTool

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    let raf
    let t = 0

    function resize() {
      const size = canvas.clientWidth
      canvas.width = size * dpr
      canvas.height = size * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // Orbiting particles for subtle life.
    const particles = Array.from({ length: 30 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 0.3 + Math.random() * 0.16,
      s: (0.0006 + Math.random() * 0.0012) * (Math.random() < 0.5 ? -1 : 1),
      size: 0.6 + Math.random() * 1.4,
    }))

    function ring(cx, cy, r, color, width, rot, alpha, dash) {
      ctx.save()
      ctx.strokeStyle = hexA(color, alpha)
      ctx.lineWidth = width
      ctx.setLineDash(dash ? [4, 10] : [])
      ctx.lineDashOffset = -rot * 30
      ctx.beginPath()
      ctx.arc(cx, cy, r, rot, rot + Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    function draw() {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const cx = w / 2
      const cy = h / 2
      const R = Math.min(w, h) * 0.36
      const st = stateRef.current
      const color = STATE_COLORS[st] || STATE_COLORS.idle
      t += 0.016

      ctx.clearRect(0, 0, w, h)

      // Breathing core scale.
      const breathe = 1 + Math.sin(t * 1.6) * 0.04
      const coreR = R * 0.34 * breathe

      // Soft outer bloom.
      const glow = ctx.createRadialGradient(cx, cy, coreR * 0.2, cx, cy, R * 1.35)
      glow.addColorStop(0, hexA(color, 0.32))
      glow.addColorStop(1, hexA(color, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2)
      ctx.fill()

      // Two rotating blueprint rings (opposite directions).
      ring(cx, cy, R, color, 1.2, t * 0.4, 0.5, true)
      ring(cx, cy, R * 0.82, color, 1.4, -t * 0.7, 0.45, false)

      if (st === 'thinking') {
        ring(cx, cy, R * 1.08, color, 1, -t * 1.6, 0.7, true)
      } else if (st === 'searching') {
        // Particles orbit faster + a thin sweeping scanner.
        const a0 = (t * 1.4) % (Math.PI * 2)
        ctx.save()
        ctx.strokeStyle = hexA(color, 0.6)
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(a0) * R * 0.95, cy + Math.sin(a0) * R * 0.95)
        ctx.stroke()
        ctx.restore()
      } else if (st === 'executing') {
        const a0 = (t * 2.2) % (Math.PI * 2)
        ctx.save()
        ctx.strokeStyle = color
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.arc(cx, cy, R * 0.92, a0, a0 + Math.PI * 1.25)
        ctx.stroke()
        ctx.restore()
      } else if (st === 'speaking') {
        for (let i = 0; i < 3; i++) {
          const p = (t * 0.6 + i / 3) % 1
          ctx.strokeStyle = hexA(color, (1 - p) * 0.5)
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(cx, cy, R * (0.4 + p * 0.95), 0, Math.PI * 2)
          ctx.stroke()
        }
      } else if (st === 'listening') {
        for (let i = 0; i < 48; i++) {
          const ang = (i / 48) * Math.PI * 2
          const amp = 0.04 + Math.abs(Math.sin(ang * 6 + t * 4)) * 0.06
          const r1 = R * 1.02
          const r2 = R * (1.02 + amp)
          ctx.strokeStyle = hexA(color, 0.6)
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1)
          ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2)
          ctx.stroke()
        }
      }

      // Particles (orbit faster while searching).
      const speedMul = st === 'searching' ? 2.4 : 1
      for (const p of particles) {
        p.a += p.s * 60 * speedMul
        const pr = R * p.r
        const x = cx + Math.cos(p.a) * pr
        const y = cy + Math.sin(p.a) * pr
        ctx.fillStyle = hexA(color, 0.5)
        ctx.beginPath()
        ctx.arc(x, y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }

      // Core disk.
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR)
      core.addColorStop(0, hexA(color, 0.9))
      core.addColorStop(0.7, hexA(color, 0.25))
      core.addColorStop(1, hexA(color, 0))
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2)
      ctx.fill()

      if (st === 'error') {
        canvas.style.transform = `translateX(${Math.sin(t * 40) * 2}px)`
      } else {
        canvas.style.transform = 'translateX(0)'
      }

      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <div className="core-wrap">
      <canvas ref={canvasRef} className="core-canvas" />
      <div className="core-label" style={{ position: 'absolute', bottom: -18, display: 'flex', gap: 8, alignItems: 'center', fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATE_COLORS[state], boxShadow: `0 0 10px ${STATE_COLORS[state]}` }} />
        {stateLabel(state, activeTool)}
      </div>
    </div>
  )
}
