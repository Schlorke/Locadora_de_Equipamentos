import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))
const web = path.join(root, 'apps', 'clients', 'web')
const requireFromWeb = createRequire(path.join(web, 'package.json'))
const serverOnlyEmpty = path.join(
  path.dirname(requireFromWeb.resolve('server-only')),
  'empty.js'
)

// Testes do host web (proxy, árvore de rotas por host, gateway server-only e arquitetura; ADR adr-tenant-hosts).
// O e2e tests/e2e/tenant-hosts.spec.ts roda com a mesma configuração quando TENANT_HOSTS_E2E=1 (servidores no ar), e as
// jornadas no navegador tests/e2e/journeys.spec.ts quando JOURNEYS_E2E=1 (o spec sobe a API e o web compilados).
export default defineConfig({
  resolve: {
    alias: {
      // `server-only` falha fora de um componente de servidor; no teste vale o módulo vazio do próprio pacote.
      'server-only': serverOnlyEmpty,
    },
  },
  test: {
    root,
    environment: 'node',
    include: [
      'apps/clients/web/src/**/*.test.{ts,tsx}',
      'tests/e2e/tenant-hosts.spec.ts',
      'tests/e2e/journeys.spec.ts',
    ],
    setupFiles: [path.join(web, 'test', 'setup.ts')],
    testTimeout: 30000,
    hookTimeout: 120000,
  },
})
