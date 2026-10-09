import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  resolve: { alias: { '@': path.dirname(fileURLToPath(import.meta.url)) } },
  test: {
    include: ['tests/identity/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/helpers/no-network.ts'],
    fileParallelism: false,
    // Mesmo prazo das suítes unitária, de contrato e de integração: o padrão de 5 s estourou sob carga no login
    // multi-host (multi-host.integration.test.ts, 6,3 s na medição da onda 132, achado 145).
    testTimeout: 20000,
  },
})
