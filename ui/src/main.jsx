import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register the PWA service worker ONLY in a production web build.
// In `vite dev` a service worker intercepts/HMR requests and serves a stale
// cached bundle, which loads a *second* copy of React and triggers
// "Invalid hook call / Cannot read properties of null (reading 'useState')".
// It also breaks HMR and the dev WebSocket. So in dev we instead make sure
// any previously-registered SW (from an earlier session) is removed.
// Inside a Capacitor native app we also skip SW registration — the bundle is
// served from a local webview, not over http, and a SW would break routing.
const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform?.()
if ('serviceWorker' in navigator && !isNative) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {})
  }
}
