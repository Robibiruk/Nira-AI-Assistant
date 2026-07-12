// Responsive Nira favicon mark. Uses the on-brand SVG (cyan→purple neon
// orb) with raster fallbacks via srcSet for older browsers.
export default function Favicon({ className = '', alt = '' }) {
  return (
    <img
      className={`na-favicon ${className}`.trim()}
      src="/favicon.svg"
      srcSet="/favicon-16.png 16w, /favicon-32.png 32w, /favicon-70.png 70w, /favicon-96.png 96w, /favicon.svg 96w"
      sizes="(max-width: 560px) 56px, (max-width: 1024px) 96px, 140px"
      alt={alt}
      aria-hidden={alt ? undefined : 'true'}
      draggable={false}
      loading="lazy"
    />
  )
}
