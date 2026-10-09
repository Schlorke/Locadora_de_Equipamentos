import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Cartão de boleto do orçamento', () => {
  it('só aparece em pendente, aprovado ou concluído e gera boleto só se aprovado', () => {
    const source = readFileSync(
      new URL('./Boleto.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain("selectedQuoteStatus === 'pending'")
    expect(source).toContain("selectedQuoteStatus === 'approved'")
    expect(source).toContain("selectedQuoteStatus === 'completed'")
    expect(source).toContain('return null')
    expect(source).toContain('Gerar Boleto')
    expect(source).toContain('Gerando Boleto...')
    expect(source).toContain('Nenhum boleto gerado ainda.')
    expect(source).toContain('quando o orçamento estiver aprovado')
    expect(source).toContain('Antecipado')
    expect(source).toContain('Na entrega')
    expect(source).toContain('No fim da locação')
    expect(source).toContain("format(date, 'yyyy-MM-dd')")
    expect(source).toContain("from '../../../shared/lib/formatting'")
    expect(source).toContain("from '../../../widgets/seletor-data'")
    expect(source).not.toContain('equipamento-detalhe/ui/Calendario')
  })
})
