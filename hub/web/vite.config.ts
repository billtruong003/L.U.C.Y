import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: Vite (5173) proxy /api + /login -> FastAPI (8800). Prod: vite build -> dist/ (FastAPI serve).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8800',
      '/login': 'http://127.0.0.1:8800',
    },
  },
})
