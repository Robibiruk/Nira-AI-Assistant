import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server proxies API calls to the FastAPI backend so the UI can use
// relative URLs (/chat/stream) during development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/chat': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/models': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/prefs': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/speak': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
