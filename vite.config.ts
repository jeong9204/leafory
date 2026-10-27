import { readFileSync } from 'node:fs'
import { leaforyPwa } from './build/pwa-plugin.ts'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

const cert = process.env.LEAFORY_HTTPS_CERT
const key = process.env.LEAFORY_HTTPS_KEY
if (Boolean(cert) !== Boolean(key))
  throw new Error(
    'LEAFORY_HTTPS_CERT와 LEAFORY_HTTPS_KEY를 함께 설정해 주세요.',
  )
const https =
  cert && key ? { cert: readFileSync(cert), key: readFileSync(key) } : undefined

export default defineConfig({
  server: { https },
  preview: { https },
  plugins: [react(), tailwindcss(), leaforyPwa()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    maxWorkers: 2,
  },
})
