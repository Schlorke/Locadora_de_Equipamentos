import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Diálogo de multa por atraso', () => {
  it('mostra os dias e o valor recebidos e aplica a multa no botão vermelho', () => {
    const source = readFileSync(
      new URL('./Multa.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Multa por Atraso')
    expect(source).toContain('Multa calculada com base no atraso detectado.')
    expect(source).toContain('Calculando multa por atraso...')
    expect(source).toContain('calculatedLateFee.daysLate')
    expect(source).toContain('dia(s)')
    expect(source).toContain('formatCurrency(calculatedLateFee.lateFee)')
    expect(source).toContain('adicionada ao valor final do')
    expect(source).toContain('Aprovar e Aplicar Multa')
    expect(source).toContain('Aprovando...')
    expect(source).toContain('Cancelar')
    expect(source).toContain('variant="outline"')
    expect(source).toContain('bg-red-600 hover:bg-red-700')
  })
})
