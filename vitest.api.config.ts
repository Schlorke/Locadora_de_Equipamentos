import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // O registrador da paridade (onda 135, B3/B11) vem depois do no-network: grava método, caminho e status de cada
    // requisição aos hosts da rodada e as asserções de cada caso, fora do repositório (tests/api-host/parity-report.mjs).
    setupFiles: ['tests/helpers/no-network.ts', 'tests/api-host/parity-setup.ts'],
    globalSetup: ['tests/api-host/global-setup.ts'],
    include: ['tests/api-host/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Os arquivos de paridade compartilham os dois servidores, o papel de runtime e as fixtures, e vários alteram esse
    // estado no meio do teste: um arquivo por vez, mesmo com --maxWorkers na linha de comando (o Vitest força um
    // worker sem paralelismo de arquivos; onda 132, achado 145). Quem reativar com --file-parallelism e mais de um
    // worker é recusado pelo global-setup antes de qualquer escrita no banco (onda 131, achado 138).
    fileParallelism: false,
    maxWorkers: 1,
  },
})
