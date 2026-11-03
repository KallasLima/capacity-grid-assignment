/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Docker Desktop bind mounts may not forward Windows filesystem events.
    watch: { usePolling: true, interval: 250 },
    proxy: {
      '/api': process.env.API_URL ?? 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
  },
})
