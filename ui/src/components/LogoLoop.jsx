import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// LogoLoop — infinite logo marquee (ported from @react-bits/LogoLoop to plain
// React/CSS, no Tailwind). Supports horizontal/vertical scroll, hover
// decelerate/stop, edge fade-out, and scale-on-hover. Pass logos as
// { node } (rendered element) or { src, alt } (image).

const SMOOTH_TAU = 0.25
const MIN_COPIES = 2
const COPY_HEADROOM = 2

// Inject styles once.
const STYLE_ID = 'logoloop-styles'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .ll-root {
      position: relative;
      overflow: hidden;
      width: 100%;
      --ll-gap: 32px;
      --ll-logoHeight: 28px;
      --ll-fadeColor: #0b0b0b;
    }
    .ll-root.ll-vertical { overflow: hidden; display: inline-block; height: 100%; }
    .ll-root.ll-scale { padding: calc(var(--ll-logoHeight) * 0.1) 0; }
    .ll-track {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      width: max-content;
      will-change: transform;
      user-select: none;
      position: relative;
      z-index: 0;
    }
    .ll-root.ll-vertical .ll-track { flex-direction: column; height: max-content; width: 100%; }
    .ll-list { display: flex; align-items: center; list-style: none; margin: 0; padding: 0; }
    .ll-root.ll-vertical .ll-list { flex-direction: column; }
    .ll-item {
      flex: none;
      font-size: var(--ll-logoHeight);
      line-height: 1;
    }
    .ll-root:not(.ll-vertical) .ll-item { margin-right: var(--ll-gap); }
    .ll-root.ll-vertical .ll-item { margin-bottom: var(--ll-gap); }
    .ll-item.ll-scale { overflow: visible; }
    .ll-logo {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-dim);
      white-space: nowrap;
      transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), color 0.2s linear, opacity 0.2s linear;
    }
    .ll-item.ll-scale:hover .ll-logo { transform: scale(1.2); color: var(--text); }
    .ll-link { display: inline-flex; align-items: center; text-decoration: none; border-radius: 6px; }
    .ll-link:hover .ll-logo { opacity: 0.85; }
    .ll-fade {
      position: absolute; pointer-events: none; z-index: 10;
    }
    .ll-root:not(.ll-vertical) .ll-fade-left {
      top: 0; bottom: 0; left: 0; width: clamp(24px, 8%, 120px);
      background: linear-gradient(to right, var(--ll-fadeColor) 0%, rgba(0,0,0,0) 100%);
    }
    .ll-root:not(.ll-vertical) .ll-fade-right {
      top: 0; bottom: 0; right: 0; width: clamp(24px, 8%, 120px);
      background: linear-gradient(to left, var(--ll-fadeColor) 0%, rgba(0,0,0,0) 100%);
    }
    .ll-root.ll-vertical .ll-fade-top {
      left: 0; right: 0; top: 0; height: clamp(24px, 8%, 120px);
      background: linear-gradient(to bottom, var(--ll-fadeColor) 0%, rgba(0,0,0,0) 100%);
    }
    .ll-root.ll-vertical .ll-fade-bottom {
      left: 0; right: 0; bottom: 0; height: clamp(24px, 8%, 120px);
      background: linear-gradient(to top, var(--ll-fadeColor) 0%, rgba(0,0,0,0) 100%);
    }
  `
  document.head.appendChild(style)
}

export default function LogoLoop({
  logos = [],
  speed = 120,
  direction = 'left',
  width = '100%',
  logoHeight = 28,
  gap = 32,
  pauseOnHover = false,
  hoverSpeed,
  fadeOut = false,
  fadeOutColor,
  backgroundColor,
  scaleOnHover = false,
  ariaLabel = 'Partner logos',
}) {
  const containerRef = useRef(null)
  const trackRef = useRef(null)
  const seqRef = useRef(null)

  const [seqWidth, setSeqWidth] = useState(0)
  const [seqHeight, setSeqHeight] = useState(0)
  const [copyCount, setCopyCount] = useState(MIN_COPIES)
  const [isHovered, setIsHovered] = useState(false)

  const isVertical = direction === 'up' || direction === 'down'

  const effectiveHoverSpeed = useMemo(() => {
    if (hoverSpeed !== undefined) return hoverSpeed
    if (pauseOnHover === true) return 0
    return undefined
  }, [hoverSpeed, pauseOnHover])

  const targetVelocity = useMemo(() => {
    const magnitude = Math.abs(speed)
    const dirMul = isVertical ? (direction === 'up' ? 1 : -1) : (direction === 'left' ? 1 : -1)
    const speedMul = speed < 0 ? -1 : 1
    return magnitude * dirMul * speedMul
  }, [speed, direction, isVertical])

  // RAF animation loop.
  const rafRef = useRef(null)
  const lastTsRef = useRef(null)
  const offsetRef = useRef(0)
  const velRef = useRef(0)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const seqSize = isVertical ? seqHeight : seqWidth
    if (seqSize > 0) {
      offsetRef.current = ((offsetRef.current % seqSize) + seqSize) % seqSize
      track.style.transform = isVertical
        ? `translate3d(0, ${-offsetRef.current}px, 0)`
        : `translate3d(${-offsetRef.current}px, 0, 0)`
    }
    if (prefersReduced) {
      track.style.transform = isVertical ? 'translate3d(0,0,0)' : 'translate3d(0,0,0)'
      return () => { lastTsRef.current = null }
    }
    const animate = (ts) => {
      if (lastTsRef.current === null) lastTsRef.current = ts
      const dt = Math.max(0, ts - lastTsRef.current) / 1000
      lastTsRef.current = ts
      const target = isHovered && effectiveHoverSpeed !== undefined ? effectiveHoverSpeed : targetVelocity
      const k = 1 - Math.exp(-dt / SMOOTH_TAU)
      velRef.current += (target - velRef.current) * k
      if (seqSize > 0) {
        let next = offsetRef.current + velRef.current * dt
        next = ((next % seqSize) + seqSize) % seqSize
        offsetRef.current = next
        track.style.transform = isVertical
          ? `translate3d(0, ${-next}px, 0)`
          : `translate3d(${-next}px, 0, 0)`
      }
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lastTsRef.current = null
    }
  }, [targetVelocity, seqWidth, seqHeight, isHovered, effectiveHoverSpeed, isVertical])

  // Measure sequence size + compute copy count.
  const updateDimensions = useCallback(() => {
    const container = containerRef.current
    const seqRect = seqRef.current?.getBoundingClientRect?.()
    if (isVertical) {
      const seqH = seqRect?.height ?? 0
      if (seqH > 0) {
        setSeqHeight(Math.ceil(seqH))
        const viewport = container?.clientHeight ?? seqH
        const copies = Math.ceil(viewport / seqH) + COPY_HEADROOM
        setCopyCount(Math.max(MIN_COPIES, copies))
      }
    } else {
      const seqW = seqRect?.width ?? 0
      if (seqW > 0) {
        setSeqWidth(Math.ceil(seqW))
        const copies = Math.ceil((container?.clientWidth ?? 0) / seqW) + COPY_HEADROOM
        setCopyCount(Math.max(MIN_COPIES, copies))
      }
    }
  }, [isVertical])

  useEffect(() => {
    const cb = () => updateDimensions()
    window.addEventListener('resize', cb)
    // Wait a frame for layout/fonts.
    const id = requestAnimationFrame(cb)
    return () => { window.removeEventListener('resize', cb); cancelAnimationFrame(id) }
  }, [updateDimensions])

  const renderItem = useCallback((item, key) => {
    const isNode = 'node' in item
    const content = isNode ? (
      <span className="ll-logo">{item.node}</span>
    ) : (
      <img
        className="ll-logo-img"
        src={item.src}
        alt={item.alt ?? ''}
        title={item.title}
        loading="lazy"
        style={{ height: 'var(--ll-logoHeight)', width: 'auto', display: 'block', objectFit: 'contain', pointerEvents: 'none' }}
      />
    )
    const inner = item.href ? (
      <a className="ll-link" href={item.href} target="_blank" rel="noreferrer noopener" aria-label={item.ariaLabel || item.alt || item.title || 'logo link'}>
        {content}
      </a>
    ) : content
    return (
      <li className={`ll-item ${scaleOnHover ? 'll-scale' : ''}`} key={key} role="listitem">
        {inner}
      </li>
    )
  }, [scaleOnHover])

  const logoLists = useMemo(
    () => Array.from({ length: copyCount }, (_, ci) => (
      <ul className="ll-list" key={`copy-${ci}`} role="list" aria-hidden={ci > 0} ref={ci === 0 ? seqRef : undefined}>
        {logos.map((item, ii) => renderItem(item, `${ci}-${ii}`))}
      </ul>
    )),
    [copyCount, logos, renderItem]
  )

  const rootClass = [
    'll-root',
    isVertical ? 'll-vertical' : '',
    scaleOnHover ? 'll-scale' : '',
  ].filter(Boolean).join(' ')

  const containerStyle = {
    width: isVertical && width === '100%' ? undefined : (typeof width === 'number' ? `${width}px` : width),
    '--ll-gap': `${gap}px`,
    '--ll-logoHeight': `${logoHeight}px`,
    ...(fadeOutColor && { '--ll-fadeColor': fadeOutColor }),
    ...(backgroundColor ? { background: backgroundColor, borderRadius: '12px' } : null),
  }

  return (
    <div ref={containerRef} className={rootClass} style={containerStyle} role="region" aria-label={ariaLabel}>
      {fadeOut && (
        isVertical ? (
          <>
            <div className="ll-fade ll-fade-top" aria-hidden />
            <div className="ll-fade ll-fade-bottom" aria-hidden />
          </>
        ) : (
          <>
            <div className="ll-fade ll-fade-left" aria-hidden />
            <div className="ll-fade ll-fade-right" aria-hidden />
          </>
        )
      )}
      <div
        className="ll-track"
        ref={trackRef}
        onMouseEnter={() => effectiveHoverSpeed !== undefined && setIsHovered(true)}
        onMouseLeave={() => effectiveHoverSpeed !== undefined && setIsHovered(false)}
      >
        {logoLists}
      </div>
    </div>
  )
}
