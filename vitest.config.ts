import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    globalSetup: './tests/global-setup.ts',
    include: [
      'tests/critical/**/*.{test,spec}.{ts,tsx}',
      'tests/api/**/*.{test,spec}.{ts,tsx}',
      'tests/components/**/*.{test,spec}.{ts,tsx}',
    ],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, './'),
      '@/types': path.resolve(dirname, './types'),
    },
  },
})
