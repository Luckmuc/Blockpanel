import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // default build configuration - leave chunking to Vite/Rollup to avoid
  // module initialization order problems that can arise from aggressive manualChunks.
  server: {
    proxy: {
      '/login': 'http://localhost:8000',
      '/change_user': 'http://localhost:8000',
      '/get_security_question': 'http://localhost:8000',
      '/reset_password': 'http://localhost:8000',
      '/change_password': 'http://localhost:8000',
      '/change_username': 'http://localhost:8000',
      '/me': 'http://localhost:8000',
      // ggf. weitere Endpunkte
      '/api/head': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/head/uuid': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    }
  }
})