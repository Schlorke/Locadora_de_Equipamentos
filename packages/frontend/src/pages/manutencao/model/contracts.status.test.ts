import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Tipos de manutenção', () => {
  it('mantém os rótulos de status e de tipo', () => {
    const source =
      readFileSync(new URL('./contracts.ts', import.meta.url), 'utf8') +
      readFileSync(new URL('./tipos.web.ts', import.meta.url), 'utf8')
    expect(source).toContain("label: 'Agendada'")
    expect(source).toContain("label: 'Em Andamento'")
    expect(source).toContain("label: 'Concluída'")
    expect(source).toContain("label: 'Cancelada'")
    expect(source).toContain("PREVENTIVE: 'Preventiva'")
    expect(source).toContain("CORRECTIVE: 'Corretiva'")
    expect(source).toContain("INSPECTION: 'Inspeção'")
    // Achado 148: "Em Andamento" usa os tokens semânticos de aviso (os tons amarelos 100/800/200 da produção,
    // conferidos em tipos.palette.web.test.ts), não a paleta escrita como classe.
    expect(source).toContain(
      'bg-[var(--status-warning-surface)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]'
    )
    expect(source).not.toMatch(/--color-[a-z]+-\d/)
  })
})
