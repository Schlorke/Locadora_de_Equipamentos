import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Contract suites (tests/contract/**): provider adapters checked against their fakes (and, later, the sandboxes).
export default defineConfig({
  resolve: { alias: { '@': path.dirname(fileURLToPath(import.meta.url)) } },
  test: {
    include: ['tests/contract/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/helpers/no-network.ts'],
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 20000,
  },
})
