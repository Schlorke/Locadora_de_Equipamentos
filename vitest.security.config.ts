import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': path.dirname(fileURLToPath(import.meta.url)) } },
  test: {
    include: ['tests/security/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/helpers/no-network.ts'],
    // Mesmo prazo das suítes unitária, de contrato e de integração: o padrão de 5 s estourou sob carga paralela nas
    // varreduras do código-fonte (route-auth-inventory levou 7,9 s no checkpoint da onda 131; onda 132, achado 145).
    testTimeout: 20000,
  },
})
