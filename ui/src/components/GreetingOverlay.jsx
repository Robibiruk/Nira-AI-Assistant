import React, { useRef, useEffect, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText as GSAPSplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, GSAPSplitText, useGSAP)

// Animated "Hello, <name>!" overlay shown briefly right after the boot loading screen.
// Adapted from the react-bits SplitText pattern, themed to Nira (dark, glow accent).
export default function GreetingOverlay({ name, onDone }) {
  const ref = useRef(null)
  const [text, setText] = useState('')

  // Compose the greeting line from the user's name.
  useEffect(() => {
    setText(name ? `Hello, ${name}!` : 'Hello, you!')
  }, [name])

  useGSAP(
    () => {
      if (!ref.current || !text) return
      const el = ref.current
      const split = new GSAPSplitText(el, {
        type: 'chars',
        charsClass: 'split-char',
      })
      gsap.fromTo(
        split.chars,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 1.25,
          ease: 'power3.out',
          stagger: 0.05,
          onComplete: () => {
            // hold a beat, then fade the whole overlay out and notify parent
            gsap.to(el, {
              opacity: 0,
              y: -16,
              duration: 0.6,
              delay: 0.9,
              ease: 'power2.in',
              onComplete: () => onDone && onDone(),
            })
          },
        },
      )
      return () => split.revert()
    },
    { dependencies: [text], scope: ref },
  )

  return (
    <div className="greeting-overlay" aria-hidden="true">
      <p ref={ref} className="greeting-text">
        {text}
      </p>
    </div>
  )
}
