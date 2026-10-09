import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': root,
      '@gb-locacoes/ui': path.join(root, 'packages/ui/src/index.web.ts'),
      'next/navigation': path.join(
        root,
        'packages/frontend/src/pages/equipamento-detalhe/ui/next-navigation-shim.ts'
      ),
      'next-auth/react': path.join(
        root,
        'packages/frontend/src/pages/equipamento-detalhe/ui/next-auth-shim.ts'
      ),
    },
  },
  test: {
    include: ['packages/**/*.test.{ts,tsx}'],
    // The dedicated contract suite already runs this matrix in test:all and CI.
    exclude: [
      ...configDefaults.exclude,
      'packages/contracts/src/platform.test.ts',
    ],
    environment: 'node',
    setupFiles: ['tests/helpers/no-network.ts'],
    // Mesmo prazo das suítes unitária, de contrato e de integração. O padrão de 5 s estourava sob carga: telas web com
    // formulário completo levam de 5 a 6 s sozinhas (Novo.web.test.tsx estourou com 5,5 s na medição da onda 132,
    // achado 145) e as varreduras do repositório passaram de 5 s com as suítes em paralelo (onda 131).
    testTimeout: 20000,
  },
})
