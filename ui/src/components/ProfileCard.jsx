import { useEffect, useRef, useMemo, useState, useCallback } from 'react'

// ProfileCard — animated tilt + holographic glow card (ported from
// @react-bits/ProfileCard to plain React/CSS, no Tailwind needed).
// The avatar sits in the card (character-style, bottom-anchored) and reacts to
// the cursor with a 3D tilt and a moving glow.

const DEFAULT_INNER_GRADIENT = 'linear-gradient(145deg,#60496e8c 0%,#71C4FF44 100%)'

const ANIMATION_CONFIG = {
  INITIAL_DURATION: 1200,
  INITIAL_X_OFFSET: 70,
  INITIAL_Y_OFFSET: 60,
  DEVICE_BETA_OFFSET: 20,
  ENTER_TRANSITION_MS: 180,
}

const clamp = (v, min = 0, max = 100) => Math.min(Math.max(v, min), max)
const round = (v, precision = 3) => parseFloat(v.toFixed(precision))
const adjust = (v, fMin, fMax, tMin, tMax) =>
  round(tMin + ((tMax - tMin) * (v - fMin)) / (fMax - fMin))

// Inject keyframes + base styles once.
const STYLE_ID = 'pc-styles'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes pc-holo-bg {
      0% { background-position: 0 var(--background-y), 0 0, center; }
      100% { background-position: 0 var(--background-y), 90% 90%, center; }
    }
    .pc-wrap { position: relative; touch-action: none; }
    .pc-wrap.active .pc-shell { transform: translateZ(0) rotateX(var(--rotate-y)) rotateY(var(--rotate-x)); }
    .pc-glow {
      position: absolute; inset: 0; z-index: 0; pointer-events: none;
      transition: opacity 0.2s ease-out; border-radius: var(--card-radius);
      background: radial-gradient(circle at var(--pointer-x) var(--pointer-y), var(--behind-glow-color) 0%, transparent var(--behind-glow-size));
      filter: blur(50px) saturate(1.1);
      opacity: calc(0.8 * var(--card-opacity));
    }
    .pc-shell {
      position: relative; z-index: 1;
      height: 80svh; max-height: 540px; aspect-ratio: 0.718;
      border-radius: var(--card-radius);
      background-blend-mode: color-dodge, normal, normal, normal;
      box-shadow: rgba(0,0,0,0.8) calc((var(--pointer-from-left) * 10px) - 3px) calc((var(--pointer-from-top) * 20px) - 6px) 20px -5px;
      transition: transform 1s ease;
      transform: translateZ(0) rotateX(0deg) rotateY(0deg);
      background: rgba(0,0,0,0.9);
      backface-visibility: hidden;
    }
    .pc-inner {
      position: absolute; inset: 0; border-radius: var(--card-radius);
      background-image: var(--inner-gradient); background-color: rgba(0,0,0,0.9);
      display: grid; grid-area: 1 / -1; overflow: hidden;
    }
    .pc-shine {
      position: absolute; inset: 0; z-index: 3; grid-area: 1 / -1;
      border-radius: var(--card-radius); pointer-events: none; overflow: hidden;
      mix-blend-mode: color-dodge; transform: translate3d(0,0,1px);
      background-size: cover; background-position: center;
      animation: pc-holo-bg 18s linear infinite;
      filter: brightness(0.66) contrast(1.33) saturate(0.33) opacity(0.5);
    }
    .pc-glare {
      position: absolute; inset: 0; z-index: 4; grid-area: 1 / -1;
      border-radius: var(--card-radius); pointer-events: none; overflow: hidden;
      transform: translate3d(0,0,1.1px); mix-blend-mode: overlay;
      filter: brightness(0.8) contrast(1.2);
      background-image: radial-gradient(farthest-corner circle at var(--pointer-x) var(--pointer-y), hsl(248,25%,80%) 12%, hsla(207,40%,30%,0.8) 90%);
    }
    .pc-avatar-wrap {
      position: absolute; inset: 0; grid-area: 1 / -1; border-radius: var(--card-radius);
      overflow: visible; mix-blend-mode: normal; transform: translateZ(2px); pointer-events: none;
      backface-visibility: hidden;
    }
    .pc-avatar {
      position: absolute; left: 50%; bottom: -1px; width: 100%;
      transform-origin: 50% 100%; border-radius: var(--card-radius);
      transform: translateX(calc(-50% + (var(--pointer-from-left) - 0.5) * 6px)) translateZ(0) scaleY(calc(1 + (var(--pointer-from-top) - 0.5) * 0.02)) scaleX(calc(1 + (var(--pointer-from-left) - 0.5) * 0.01));
      backface-visibility: hidden; will-change: transform;
      transition: transform 120ms ease-out;
    }
    .pc-details {
      position: absolute; top: 3em; left: 0; right: 0; z-index: 5; text-align: center;
      transform: translate3d(calc(var(--pointer-from-left) * -6px + 3px), calc(var(--pointer-from-top) * -6px + 3px), 0.1px);
      mix-blend-mode: normal; pointer-events: none;
    }
    .pc-name { font-weight: 600; margin: 0; color: #fff; font-size: min(5svh, 3em); text-shadow: 0 2px 12px rgba(0,0,0,0.75); display: block; }
    .pc-title { font-weight: 600; margin: 0 auto; position: relative; top: -12px; color: #d7c4ff; font-size: 16px; text-shadow: 0 2px 10px rgba(0,0,0,0.75); display: block; }
    .pc-userinfo {
      position: absolute; z-index: 6; left: 20px; right: 20px; bottom: 20px;
      display: flex; align-items: center; justify-content: space-between;
      backdrop-filter: blur(30px); border: 1px solid rgba(255,255,255,0.15);
      background: rgba(10,10,16,0.55); border-radius: calc(max(0px, var(--card-radius) - 14px));
      padding: 12px 14px; pointer-events: auto;
    }
    .pc-contact {
      border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; padding: 12px 16px;
      font-size: 12px; font-weight: 600; color: #fff; cursor: pointer;
      backdrop-filter: blur(10px); transition: all 0.2s ease-out; pointer-events: auto;
      background: rgba(168,85,247,0.25);
    }
    .pc-contact:hover { border-color: rgba(255,255,255,0.5); transform: translateY(-1px); background: rgba(168,85,247,0.4); }
  `
  document.head.appendChild(style)
}

export default function ProfileCard({
  avatarUrl = '/Me.jpg',
  iconUrl,
  grainUrl,
  innerGradient,
  behindGlowEnabled = true,
  behindGlowColor,
  behindGlowSize,
  className = '',
  enableTilt = true,
  enableMobileTilt = false,
  mobileTiltSensitivity = 5,
  miniAvatarUrl,
  name = 'Robel Biruk',
  title = 'Creator',
  handle = 'robelbiruk',
  status = 'Online',
  contactText = 'Contact Me',
  showUserInfo = true,
  onContactClick,
}) {
  const wrapRef = useRef(null)
  const shellRef = useRef(null)
  const enterTimerRef = useRef(null)
  const leaveRafRef = useRef(null)

  const tiltEngine = useMemo(() => {
    if (!enableTilt) return null
    let rafId = null
    let running = false
    let lastTs = 0
    let currentX = 0, currentY = 0, targetX = 0, targetY = 0
    const DEFAULT_TAU = 0.14
    const INITIAL_TAU = 0.6
    let initialUntil = 0

    const setVarsFromXY = (x, y) => {
      const shell = shellRef.current
      const wrap = wrapRef.current
      if (!shell || !wrap) return
      const width = shell.clientWidth || 1
      const height = shell.clientHeight || 1
      const percentX = clamp((100 / width) * x)
      const percentY = clamp((100 / height) * y)
      const centerX = percentX - 50
      const centerY = percentY - 50
      const props = {
        '--pointer-x': `${percentX}%`,
        '--pointer-y': `${percentY}%`,
        '--background-x': `${adjust(percentX, 0, 100, 35, 65)}%`,
        '--background-y': `${adjust(percentY, 0, 100, 35, 65)}%`,
        '--pointer-from-center': `${clamp(Math.hypot(percentY - 50, percentX - 50) / 50, 0, 1)}`,
        '--pointer-from-top': `${percentY / 100}`,
        '--pointer-from-left': `${percentX / 100}`,
        '--rotate-x': `${round(-(centerX / 5))}deg`,
        '--rotate-y': `${round(centerY / 4)}deg`,
      }
      for (const [k, v] of Object.entries(props)) wrap.style.setProperty(k, v)
    }

    const step = (ts) => {
      if (!running) return
      if (lastTs === 0) lastTs = ts
      const dt = (ts - lastTs) / 1000
      lastTs = ts
      const tau = ts < initialUntil ? INITIAL_TAU : DEFAULT_TAU
      const k = 1 - Math.exp(-dt / tau)
      currentX += (targetX - currentX) * k
      currentY += (targetY - currentY) * k
      setVarsFromXY(currentX, currentY)
      const stillFar = Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05
      if (stillFar || document.hasFocus()) {
        rafId = requestAnimationFrame(step)
      } else {
        running = false
        lastTs = 0
        if (rafId) { cancelAnimationFrame(rafId); rafId = null }
      }
    }
    const start = () => {
      if (running) return
      running = true
      lastTs = 0
      rafId = requestAnimationFrame(step)
    }
    return {
      setImmediate(x, y) { currentX = x; currentY = y; setVarsFromXY(currentX, currentY) },
      setTarget(x, y) { targetX = x; targetY = y; start() },
      toCenter() { const shell = shellRef.current; if (!shell) return; this.setTarget(shell.clientWidth / 2, shell.clientHeight / 2) },
      beginInitial(durationMs) { initialUntil = performance.now() + durationMs; start() },
      getCurrent() { return { x: currentX, y: currentY, tx: targetX, ty: targetY } },
      cancel() { if (rafId) cancelAnimationFrame(rafId); rafId = null; running = false; lastTs = 0 },
    }
  }, [enableTilt])

  const getOffsets = (evt, el) => {
    const rect = el.getBoundingClientRect()
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top }
  }

  const handlePointerMove = useCallback((event) => {
    const shell = shellRef.current
    if (!shell || !tiltEngine) return
    const { x, y } = getOffsets(event, shell)
    tiltEngine.setTarget(x, y)
  }, [tiltEngine])

  const handlePointerEnter = useCallback((event) => {
    const shell = shellRef.current
    if (!shell || !tiltEngine) return
    shell.classList.add('active')
    shell.classList.add('entering')
    if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current)
    enterTimerRef.current = window.setTimeout(() => shell.classList.remove('entering'), ANIMATION_CONFIG.ENTER_TRANSITION_MS)
    const { x, y } = getOffsets(event, shell)
    tiltEngine.setTarget(x, y)
  }, [tiltEngine])

  const handlePointerLeave = useCallback(() => {
    const shell = shellRef.current
    if (!shell || !tiltEngine) return
    tiltEngine.toCenter()
    const checkSettle = () => {
      const { x, y, tx, ty } = tiltEngine.getCurrent()
      const settled = Math.hypot(tx - x, ty - y) < 0.6
      if (settled) { shell.classList.remove('active'); leaveRafRef.current = null }
      else leaveRafRef.current = requestAnimationFrame(checkSettle)
    }
    if (leaveRafRef.current) cancelAnimationFrame(leaveRafRef.current)
    leaveRafRef.current = requestAnimationFrame(checkSettle)
  }, [tiltEngine])

  useEffect(() => {
    if (!enableTilt || !tiltEngine) return
    const shell = shellRef.current
    if (!shell) return
    const pm = handlePointerMove, pe = handlePointerEnter, pl = handlePointerLeave
    shell.addEventListener('pointerenter', pe)
    shell.addEventListener('pointermove', pm)
    shell.addEventListener('pointerleave', pl)
    const initialX = (shell.clientWidth || 0) - ANIMATION_CONFIG.INITIAL_X_OFFSET
    const initialY = ANIMATION_CONFIG.INITIAL_Y_OFFSET
    tiltEngine.setImmediate(initialX, initialY)
    tiltEngine.toCenter()
    tiltEngine.beginInitial(ANIMATION_CONFIG.INITIAL_DURATION)
    return () => {
      shell.removeEventListener('pointerenter', pe)
      shell.removeEventListener('pointermove', pm)
      shell.removeEventListener('pointerleave', pl)
      if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current)
      if (leaveRafRef.current) cancelAnimationFrame(leaveRafRef.current)
      tiltEngine.cancel()
      shell.classList.remove('entering', 'active')
    }
  }, [enableTilt, tiltEngine, handlePointerMove, handlePointerEnter, handlePointerLeave])

  const cardRadius = '30px'
  const cardStyle = {
    perspective: '500px',
    transform: 'translate3d(0,0,0.1px)',
    '--icon': iconUrl ? `url(${iconUrl})` : 'none',
    '--grain': grainUrl ? `url(${grainUrl})` : 'none',
    '--inner-gradient': innerGradient ?? DEFAULT_INNER_GRADIENT,
    '--behind-glow-color': behindGlowColor ?? 'rgba(125, 190, 255, 0.67)',
    '--behind-glow-size': behindGlowSize ?? '50%',
    '--pointer-x': '50%',
    '--pointer-y': '50%',
    '--pointer-from-center': '0',
    '--pointer-from-top': '0.5',
    '--pointer-from-left': '0.5',
    '--card-opacity': '1',
    '--rotate-x': '0deg',
    '--rotate-y': '0deg',
    '--background-x': '50%',
    '--background-y': '50%',
    '--card-radius': cardRadius,
  }

  const handleContactClick = () => onContactClick?.()

  const shineBg = `
    repeating-linear-gradient(0deg, var(--sun-clr-1) 5%, var(--sun-clr-2) 10%, var(--sun-clr-3) 15%, var(--sun-clr-4) 20%, var(--sun-clr-5) 25%, var(--sun-clr-6) 30%, var(--sun-clr-1) 35%),
    repeating-linear-gradient(-45deg, #0e152e 0%, hsl(180,10%,60%) 3.8%, hsl(180,29%,66%) 4.5%, hsl(180,10%,60%) 5.2%, #0e152e 10%, #0e152e 12%),
    radial-gradient(farthest-corner circle at var(--pointer-x) var(--pointer-y), hsla(0,0%,0%,0.1) 12%, hsla(0,0%,0%,0.15) 20%, hsla(0,0%,0%,0.25) 120%)
  `.replace(/\s+/g, ' ')

  return (
    <div ref={wrapRef} className={`pc-wrap ${className}`} style={cardStyle}>
      {behindGlowEnabled && <div className="pc-glow" />}
      <div ref={shellRef} className="pc-shell">
        <div className="pc-inner">
          <div className="pc-shine" style={{ backgroundImage: shineBg, ['--sun-clr-1']: 'hsl(2,100%,73%)', ['--sun-clr-2']: 'hsl(53,100%,69%)', ['--sun-clr-3']: 'hsl(93,100%,69%)', ['--sun-clr-4']: 'hsl(176,100%,76%)', ['--sun-clr-5']: 'hsl(228,100%,74%)', ['--sun-clr-6']: 'hsl(283,100%,73%)' }} />
          <div className="pc-glare" />
          <div className="pc-avatar-wrap">
            <img className="pc-avatar" src={avatarUrl} alt={`${name} avatar`} loading="lazy"
              onError={(e) => { e.target.style.display = 'none' }} />
            {showUserInfo && (
              <div className="pc-userinfo">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                    <img src={miniAvatarUrl || avatarUrl} alt={`${name} mini`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                      onError={(e) => { e.target.style.opacity = '0.5'; e.target.src = avatarUrl }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>@{handle}</div>
                    <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>{status}</div>
                  </div>
                </div>
                <button className="pc-contact" type="button" onClick={handleContactClick} aria-label={`Contact ${name}`}>{contactText}</button>
              </div>
            )}
          </div>
          <div className="pc-details">
            <h3 className="pc-name" style={{ fontSize: 'min(5svh, 3em)' }}>{name}</h3>
            <p className="pc-title" style={{ fontSize: '16px' }}>{title}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
