import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/** Testes das ferramentas da linha de base visual (sem navegador): pnpm exec vitest run --config tests/visual/vitest.config.ts */
export default defineConfig({
  root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'),
  test: {
    environment: 'node',
    include: ['tests/visual/**/*.test.ts'],
    testTimeout: 20000,
  },
})
