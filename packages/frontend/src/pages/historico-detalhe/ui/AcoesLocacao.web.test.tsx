import { calculateRentalLateFee } from '../../../entities/locacao'
import { calculateLateFee } from '../../../entities/orcamento'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('fatia 303 — AcoesLocacao (rental-actions)', () => {
  const source = readFileSync(
    new URL('./AcoesLocacao.web.tsx', import.meta.url),
    'utf8'
  )
  const model = readFileSync(
    new URL('../model/use-rental-actions.ts', import.meta.url),
    'utf8'
  )
  const index = readFileSync(new URL('../index.ts', import.meta.url), 'utf8')
  const multaOrcamento = readFileSync(
    new URL('../../../entities/orcamento/model/multa.ts', import.meta.url),
    'utf8'
  )
  const legado = resolve(process.cwd(), 'components/client/rental-actions.tsx')

  it('preserva textos e endpoints de cliente em .web (next/navigation)', () => {
    expect(source).toContain("from 'next/navigation'")
    expect(source).toContain('export function RentalActions')
    expect(source).toContain('Ver Boleto')
    expect(source).toContain('Solicitar Prorrogação')
    expect(source).toContain('Informe quantos dias adicionais você precisa')
    expect(source).toContain('Dias Adicionais')
    expect(source).toContain('Solicitar Coleta')
    expect(source).toContain(
      'Solicite a coleta do equipamento no endereço da obra'
    )
    expect(source).toContain('Confirmar Solicitação')
    expect(model).toContain('Solicitação de prorrogação enviada!')
    expect(model).toContain('Solicitação de coleta enviada!')
    expect(model).toContain(
      'rentalApi.requestExtension(rentalId, extensionDays)'
    )
    expect(model).toContain('rentalApi.requestPickup(rentalId)')
    expect(source).toContain('`/area-cliente/pagamentos/${boletoPaymentId}`')
    expect(source).not.toContain('await fetch(')
    expect(index).toContain('RentalActions')
    expect(index).toContain('AcoesLocacao')
    const facade = readFileSync(
      new URL('./AcoesLocacao.tsx', import.meta.url),
      'utf8'
    )
    expect(facade).toContain('AcoesLocacao.web')
  })

  it('não mistura multa de locação (5%) com multa de orçamento (2% ao dia)', () => {
    expect(source).not.toContain('calculateLateFee')
    expect(source).not.toContain('calculateRentalLateFee')
    expect(source).not.toContain('0.05')
    expect(source).not.toContain('0.02')
    expect(
      calculateRentalLateFee({
        total: 1000,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-11T00:00:00Z'),
        currentDate: new Date('2026-01-13T00:00:00Z'),
      })
    ).toEqual({ lateFee: 10, daysOverdue: 2, overdue: true })
    expect(
      calculateLateFee(
        1000,
        new Date('2026-01-11T00:00:00Z'),
        new Date('2026-01-13T00:00:00Z')
      ).fee.toNumber()
    ).toBe(40)
    expect(multaOrcamento).toContain('DEFAULT_LATE_FEE_CONFIG')
    expect(existsSync(legado)).toBe(false)
  })
})
