import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server proxies API calls to the FastAPI backend so the UI can use
// relative URLs (/chat/stream) during development.
export default defineConfig({
  plugins: [react()],
  // Guard against duplicate React copies (dual-React => "Invalid hook call").
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5173,
    proxy: {
      // Forward every backend API route to FastAPI. Vite still serves the
      // UI itself (/, /src, /assets, /@vite). Kept as explicit prefixes so
      // the dev HTML/JS/CSS are never proxied away.
      '/chat': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/models': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/prefs': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/speak': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/tools': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/features': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/sessions': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/providers': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/desktop': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/desktop/action': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      // Generated app icons (extracted at runtime into ui/public/icons).
      '/icons': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
