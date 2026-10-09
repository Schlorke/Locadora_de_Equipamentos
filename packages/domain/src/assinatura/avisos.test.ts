import { expect, it } from 'vitest'
import { planejarAvisos } from './avisos'
import { somarDias } from './dia-civil'
import type { FatosDaAssinatura, FaturaDaAssinatura } from './estado'

const invoice = (
  status: FaturaDaAssinatura['status'] = 'PENDING'
): FaturaDaAssinatura => ({
  id: 'invoice',
  kind: 'CYCLE',
  status,
  amount: '149.90',
  dueDate: '2026-10-03',
  periodEnd: '2026-11-02',
  paidAt: null,
  chargebackAt: null,
  voluntaryRefund: false,
  settlesInvoiceId: null,
  debtWaivedAt: null,
})
const facts = (extra: Partial<FatosDaAssinatura> = {}): FatosDaAssinatura => ({
  createdAt: new Date('2026-09-01T15:00:00Z'),
  billingMode: 'ASAAS',
  complimentaryUntil: null,
  trialEndsAt: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  canceledAt: null,
  invoices: [
    {
      ...invoice('PAID'),
      id: 'prior',
      dueDate: '2026-09-03',
      periodEnd: '2026-10-02',
      paidAt: new Date('2026-09-03T15:00:00Z'),
    },
    invoice(),
  ],
  ...extra,
})
const at = (date: string) => new Date(date + 'T15:00:00Z')
it.each([-5, 0, 1, 3, 6, 14, 21, 30])(
  'schedules only invoice step %s and keeps decimal money',
  (day) => {
    const planned = planejarAvisos(facts(), at(somarDias('2026-10-03', day)))
    expect(planned).toHaveLength(1)
    expect(planned[0]).toMatchObject({
      tipo: 'FATURA',
      faturaId: 'invoice',
      valor: '149.90',
      passo: day > 0 ? 'D+' + day : 'D' + day,
    })
  }
)
it.each([7, 3, 1, 0])('schedules trial warning with %s days left', (days) => {
  const f = facts({
    createdAt: at('2026-09-15'),
    trialEndsAt: '2026-10-10',
    invoices: [],
  })
  expect(planejarAvisos(f, at(somarDias('2026-10-10', -days)))).toMatchObject([
    {
      tipo: 'TESTE',
      passo: days ? 'D-' + days : 'D0',
      vencimento: '2026-10-10',
    },
  ])
})
it.each([-4, -1, 2, 5, 7, 8, 15, 31, 37])(
  'does not create an extra invoice reminder on day %s',
  (day) => {
    expect(planejarAvisos(facts(), at(somarDias('2026-10-03', day)))).toEqual(
      []
    )
  }
)
it.each(['PAID', 'CANCELED', 'REFUNDED', 'CHARGEBACK'] as const)(
  'never sends an old payment link for %s',
  (status) => {
    expect(
      planejarAvisos(facts({ invoices: [invoice(status)] }), at('2026-10-06'))
    ).toEqual([])
  }
)
it('uses the already established policy for pause/closure, without hardcoding D+7', () => {
  expect(planejarAvisos(facts(), at('2026-10-09'))[0]).toMatchObject({
    pausaEm: '2026-10-11',
    encerramentoEm: '2026-11-09',
  })
  expect(
    planejarAvisos(facts(), at('2026-10-06'), {
      graceDays: 3,
      suspendDays: 14,
      incompleteDays: 30,
    })[0]
  ).toMatchObject({ pausaEm: '2026-10-07', encerramentoEm: '2026-10-20' })
})
it('counts the São Paulo day across midnight, not the UTC day', () => {
  expect(
    planejarAvisos(facts(), new Date('2026-10-04T02:59:59Z'))[0]?.passo
  ).toBe('D0')
  expect(
    planejarAvisos(facts(), new Date('2026-10-04T03:00:00Z'))[0]?.passo
  ).toBe('D+1')
})
it('does not remind canceled, complimentary or already paid trials', () => {
  expect(
    planejarAvisos(facts({ canceledAt: at('2026-10-02') }), at('2026-10-03'))
  ).toEqual([])
  expect(
    planejarAvisos(facts({ billingMode: 'COMPLIMENTARY' }), at('2026-10-03'))
  ).toEqual([])
  expect(
    planejarAvisos(
      facts({ trialEndsAt: '2026-10-10', invoices: [invoice('PAID')] }),
      at('2026-10-03')
    )
  ).toEqual([])
})
it.each(['old-cycle', 'pending-cycle'])(
  'keeps the trial warning when %s does not fund the period after the trial',
  (scenario) => {
    const f = {
      ...invoice(scenario === 'pending-cycle' ? 'PENDING' : 'PAID'),
      periodEnd: scenario === 'old-cycle' ? '2026-10-02' : '2026-11-02',
      dueDate: scenario === 'pending-cycle' ? '2026-10-11' : '2026-10-03',
    }
    expect(
      planejarAvisos(
        facts({ trialEndsAt: '2026-10-10', invoices: [f] }),
        at('2026-10-03')
      )
    ).toMatchObject([{ tipo: 'TESTE', passo: 'D-7' }])
  }
)
