import { describe, expect, it } from 'vitest'
import type { FaturaDaAssinatura } from './estado'
import { planejarReativacao } from './reativacao'

const agora = new Date('2026-12-01T12:00:00-03:00')

function fatura(
  parcial: Partial<FaturaDaAssinatura> & { id: string }
): FaturaDaAssinatura {
  return {
    kind: 'CYCLE',
    status: 'PENDING',
    amount: '149.90',
    dueDate: '2026-10-05',
    periodEnd: null,
    paidAt: null,
    chargebackAt: null,
    voluntaryRefund: false,
    settlesInvoiceId: null,
    debtWaivedAt: null,
    ...parcial,
  }
}

describe('planejarReativacao', () => {
  it.each([
    'INCOMPLETE',
    'TRIALING',
    'ACTIVE',
    'PAST_DUE',
    'SUSPENDED',
  ] as const)('só reativa assinatura CANCELED (recusa %s)', (estado) => {
    expect(planejarReativacao({ estado, invoices: [] }, agora)).toEqual({
      reativavel: false,
      motivo: 'ASSINATURA_NAO_ENCERRADA',
    })
  })

  it('perdoa OVERDUE e PENDING vencida, uma vez cada, e soma em Decimal', () => {
    const faturas = [
      fatura({ id: 'paga', status: 'PAID', paidAt: agora }),
      fatura({ id: 'vencida', status: 'OVERDUE', amount: '0.10' }),
      fatura({
        id: 'pendente-vencida',
        status: 'PENDING',
        dueDate: '2026-11-30',
        amount: '0.20',
      }),
      fatura({ id: 'pendente-hoje', status: 'PENDING', dueDate: '2026-12-01' }),
      fatura({ id: 'cancelada', status: 'CANCELED' }),
      fatura({ id: 'estornada', status: 'REFUNDED' }),
      fatura({
        id: 'contestada',
        status: 'CHARGEBACK',
        paidAt: agora,
        chargebackAt: agora,
      }),
      fatura({ id: 'vencida', status: 'OVERDUE', amount: '0.10' }),
    ]
    const reativacao = planejarReativacao(
      { estado: 'CANCELED', invoices: faturas },
      agora
    )
    expect(reativacao).toMatchObject({
      reativavel: true,
      estadoInicial: 'INCOMPLETE',
      faturasPerdoadas: ['vencida', 'pendente-vencida'],
    })
    expect(reativacao.reativavel && reativacao.valorPerdoado.toFixed(2)).toBe(
      '0.30'
    )
  })

  it('sem vencidas, nada a perdoar', () => {
    const reativacao = planejarReativacao(
      { estado: 'CANCELED', invoices: [] },
      agora
    )
    expect(reativacao).toMatchObject({ reativavel: true, faturasPerdoadas: [] })
    expect(reativacao.reativavel && reativacao.valorPerdoado.isZero()).toBe(
      true
    )
  })

  it('recusa vencimento inexistente', () => {
    expect(() =>
      planejarReativacao(
        {
          estado: 'CANCELED',
          invoices: [fatura({ id: 'x', dueDate: '2026-02-30' })],
        },
        agora
      )
    ).toThrow(RangeError)
  })
})
