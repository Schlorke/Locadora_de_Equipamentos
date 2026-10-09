import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('contrato notificacoes', () => {
  it('exporta NotificacoesPage pelo index público do slice', () => {
    const index = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
    expect(index).toMatch(
      /export \{ NotificacoesPage \} from ['"]\.\/ui\/NotificacoesPage['"]/
    )
  })
})
