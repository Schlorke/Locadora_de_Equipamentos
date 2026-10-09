import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: { alias: {
    '@': root,
    '@gb-locacoes/ui': path.join(root, 'packages/ui/src/index.web.ts'),
  } },
  test: {
    environment: 'node',
    setupFiles: ['tests/helpers/no-network.ts'],
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}', 'lib/**/*.{test,spec}.{ts,tsx}', 'tests/pricing.intelligent.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 20000,
  },
})
