import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

/**
 * eslint.config.js: import, variável e função privada sem uso são sobra que nenhum outro gate vê (o knip só olha
 * export, o TypeScript do projeto não liga noUnusedLocals). O `pnpm lint` roda com --quiet, que esconde aviso:
 * a regra só barra de verdade como erro.
 */
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)
const eslint = new ESLint({ cwd: repoRoot })

async function errors(file: string, code: string) {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(repoRoot, file),
  })
  return ESLint.getErrorResults([result!]).flatMap((item) =>
    item.messages.map((message) => `${message.ruleId}: ${message.message}`)
  )
}

// Os casos leem o eslint.config.js real (parser e plugins de TypeScript, React, Storybook...), e o primeiro paga a
// carga da configuração: isolado, até 1,5 s com cache quente e 19,5 s na primeira execução fria (medido em
// 2026-10-07); sob a carga do pnpm test:unit completo, passava dos 20 s do padrão (arquivo de 23 a 30 s).
const REAL_ESLINT = { timeout: 60_000 }

describe(
  'eslint.config.js: sobra de código local reprova no pnpm lint (--quiet)',
  REAL_ESLINT,
  () => {
    it('TypeScript: import sem uso e função privada morta são erro', async () => {
      const found = await errors(
        'packages/frontend/src/shared/lib/sonda-sobra.ts',
        [
          "import { useMemo } from 'react'",
          'function morta(valor: number) {',
          '  return valor * 2',
          '}',
          'export const viva = 1',
          '',
        ].join('\n')
      )
      expect(found).toEqual([
        expect.stringMatching(/^@typescript-eslint\/no-unused-vars: 'useMemo'/),
        expect.stringMatching(/^@typescript-eslint\/no-unused-vars: 'morta'/),
      ])
    })

    it('TypeScript: tipo importado sem uso e parâmetro de assinatura de tipo', async () => {
      // lib/sonda-sobra.ts é nome virtual de lintText no diretório antigo lib/, retirado em F; não grava fonte na raiz.
      const found = await errors(
        'lib/sonda-sobra.ts',
        [
          "import type { ReactNode } from 'react'",
          // Parâmetro nomeado numa assinatura de tipo não é variável: a regra base (que não entende tipos) fica desligada.
          'export type Callback = (valor: string) => void',
          '',
        ].join('\n')
      )
      expect(found).toEqual([
        expect.stringMatching(
          /^@typescript-eslint\/no-unused-vars: 'ReactNode'/
        ),
      ])
    })

    it('JavaScript: variável e função sem uso são erro; o prefixo _ marca o que fica de propósito', async () => {
      const found = await errors(
        'scripts/sonda-sobra.mjs',
        [
          "import { join } from 'node:path'",
          'function morta() {',
          '  return 1',
          '}',
          'export function viva(_ignorado) {',
          '  return 2',
          '}',
          '',
        ].join('\n')
      )
      expect(found).toEqual([
        expect.stringMatching(/^no-unused-vars: 'join'/),
        expect.stringMatching(/^no-unused-vars: 'morta'/),
      ])
    })
  }
)
