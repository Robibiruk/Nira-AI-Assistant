import { DotLottieReact } from '@lottiefiles/dotlottie-react'

// Thin wrapper so each usage site stays one line and consistent.
export default function LottieBox({ src, className, style }) {
  return (
    <DotLottieReact
      src={src}
      loop
      autoplay
      className={className}
      style={style}
    />
  )
}
