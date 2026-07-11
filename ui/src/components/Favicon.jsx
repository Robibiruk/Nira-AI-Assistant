// Responsive Nira favicon mark. Uses srcSet + sizes so the browser picks the
// right raster size for the device/DPR. aria-hidden (decorative — label nearby).
export default function Favicon({ className = '', alt = '' }) {
  return (
    <img
      className={`na-favicon ${className}`.trim()}
      src="/favicon-96.png"
      srcSet="/favicon-16.png 16w, /favicon-32.png 32w, /favicon-70.png 70w, /favicon-96.png 96w"
      sizes="(max-width: 560px) 56px, (max-width: 1024px) 96px, 140px"
      alt={alt}
      aria-hidden={alt ? undefined : 'true'}
      draggable={false}
      loading="lazy"
    />
  )
}
