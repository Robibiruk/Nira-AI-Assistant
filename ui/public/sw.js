/* NIRA service worker — minimal offline-capable PWA cache.

   IMPORTANT (dev safety): when served from the Vite dev server (port 5173,
   or any localhost:5173 dev origin), the SW must NOT intercept or cache ANY
   request. A cached build in dev loads a *second* copy of React and triggers
   "Invalid hook call / Cannot read properties of null (reading 'useState')",
   and it also breaks HMR. So in dev the SW is a pure pass-through.

   The cache name is bumped whenever the caching policy changes so that any
   previously-cached bundle (e.g. a stale dev build) is orphaned and deleted
   on the next activate. */
const CACHE = 'nira-v3'
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  // In dev we skip precaching entirely; just activate fast.
  if (self.location && self.location.port === '5173') {
    self.skipWaiting()
    return
  }
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE).catch(() => {})),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

// Network-first for navigation/API, cache-first for static assets.
const API_PREFIXES = ['/chat', '/models', '/speak', '/prefs', '/providers', '/tools', '/sessions', '/features', '/status']

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // DEV: never intercept/cache. Serve straight from the network so Vite's
  // freshly-injected modules (and a single copy of React) always win.
  if (url.port === '5173' || url.hostname === 'localhost') return

  // Only handle http(s) — never chrome-extension://, moz-extension://,
  // file://, etc. Caching those throws "Request scheme ... is unsupported".
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  // Never intercept cross-origin requests (cdnjs Font Awesome, Google Fonts,
  // the Render API). Wrapping a third-party request in caches.match/fetch can
  // return an "opaque" response and trip "opaque response used for a non
  // no-cors request". Let the browser fetch those directly.
  if (url.origin !== self.location.origin) return

  // Never cache API responses (they are dynamic / may be empty).
  if (API_PREFIXES.some((p) => url.pathname.startsWith(p))) return

  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
        return res
      }).catch(() => caches.match(req)),
    )
    return
  }
  event.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
        return res
      }).catch(() => cached),
    ),
  )
})
