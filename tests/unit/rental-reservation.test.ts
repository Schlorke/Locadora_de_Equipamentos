import { describe, expect, it } from 'vitest'
import {
  blocksRentalInventory,
  hasCheckoutPayment,
  isObligationSettled,
  peakReservedQuantity,
} from '@gb-locacoes/domain/locacao'
const date = (day: number) => new Date(Date.UTC(2030, 0, day))
describe('rental reservation policy', () => {
  it('reserves manual and approved AT_END before checkout', () => {
    expect(
      blocksRentalInventory({ status: 'PENDING', total: 30, payments: [] })
    ).toBe(true)
    expect(
      blocksRentalInventory({
        status: 'PENDING',
        total: 30,
        quote: { status: 'COMPLETED', paymentTerms: 'AT_END' },
        payments: [],
      })
    ).toBe(true)
  })
  it.each(['UPFRONT', 'ON_DELIVERY'])(
    'requires full base payment for %s',
    (paymentTerms) => {
      const rental = {
        status: 'PENDING',
        total: 30,
        quote: { status: 'COMPLETED', paymentTerms },
        payments: [{ type: 'DEPOSIT', status: 'PENDING', amount: 30 }],
      }
      expect(blocksRentalInventory(rental)).toBe(false)
      expect(hasCheckoutPayment(rental)).toBe(false)
      rental.payments[0]!.status = 'PAID'
      expect(blocksRentalInventory(rental)).toBe(true)
      expect(hasCheckoutPayment(rental)).toBe(true)
      rental.payments.push({ type: 'RENTAL', status: 'PENDING', amount: 30 })
      expect(blocksRentalInventory(rental)).toBe(false)
    }
  )
  it('does not count fines as rental settlement and releases cancellation', () => {
    expect(
      blocksRentalInventory({
        status: 'PENDING',
        total: 30,
        quote: { status: 'APPROVED', paymentTerms: 'UPFRONT' },
        payments: [{ type: 'LATE_FEE', status: 'PAID', amount: 30 }],
      })
    ).toBe(false)
    expect(
      blocksRentalInventory({
        status: 'CANCELLED',
        total: 30,
        payments: [{ type: 'RENTAL', status: 'PAID', amount: 30 }],
      })
    ).toBe(false)
  })
  it.each([
    ['REFUNDED', 'PAID'],
    ['CANCELLED', 'PAID'],
    ['PAID', 'CANCELLED'],
  ])(
    'settles over current charges only: voided history [%s, %s] does not block',
    (first, second) => {
      const rental = {
        status: 'PENDING',
        total: '30.00',
        quote: { status: 'COMPLETED', paymentTerms: 'UPFRONT' },
        payments: [
          { type: 'DEPOSIT', status: first, amount: '30.00' },
          { type: 'DEPOSIT', status: second, amount: '30.00' },
        ],
      }
      expect(isObligationSettled(rental.total, rental.payments)).toBe(true)
      expect(blocksRentalInventory(rental)).toBe(true)
      expect(hasCheckoutPayment(rental)).toBe(true)
    }
  )
  it.each([[['CANCELLED']], [['REFUNDED']], [['CANCELLED', 'REFUNDED']]])(
    'voided charges alone never settle the obligation (%j)',
    (statuses) => {
      const rental = {
        status: 'PENDING',
        total: 30,
        quote: { status: 'COMPLETED', paymentTerms: 'UPFRONT' },
        payments: statuses.map((status) => ({
          type: 'DEPOSIT',
          status,
          amount: 30,
        })),
      }
      expect(isObligationSettled(rental.total, rental.payments)).toBe(false)
      expect(blocksRentalInventory(rental)).toBe(false)
      expect(hasCheckoutPayment(rental)).toBe(false)
    }
  )
  it('requires the paid sum to reach the total in Decimal, not just a PAID row', () => {
    const payments = [
      { type: 'DEPOSIT', status: 'PAID', amount: '0.10' },
      { type: 'RENTAL', status: 'PAID', amount: '0.20' },
    ]
    expect(isObligationSettled('0.30', payments)).toBe(true)
    expect(isObligationSettled('0.31', payments)).toBe(false)
    expect(
      isObligationSettled(30, [
        { type: 'DEPOSIT', status: 'PAID', amount: 29.99 },
      ])
    ).toBe(false)
    expect(isObligationSettled(0, [])).toBe(false)
    expect(
      hasCheckoutPayment({
        status: 'PENDING',
        total: 30,
        quote: { status: 'COMPLETED', paymentTerms: 'UPFRONT' },
        payments: [{ type: 'DEPOSIT', status: 'PAID', amount: 15 }],
      })
    ).toBe(false)
  })
  it('settles a fractional total paid by the charged cents balance (128.5714… paid 128.57)', () => {
    // Total gravado em DECIMAL(65,30) por um orçamento de 9 dias com semana direta de R$ 100.
    const total = '128.571428571428580000000000000'
    const payments = [{ type: 'DEPOSIT', status: 'PAID', amount: '128.57' }]
    expect(isObligationSettled(total, payments)).toBe(true)
    const rental = {
      status: 'PENDING',
      total,
      quote: { status: 'COMPLETED', paymentTerms: 'UPFRONT' },
      payments,
    }
    // A locação PENDING paga continua reservando o estoque e libera o check-out.
    expect(blocksRentalInventory(rental)).toBe(true)
    expect(hasCheckoutPayment(rental)).toBe(true)
    // Um centavo a menos continua em aberto.
    expect(
      isObligationSettled(total, [
        { type: 'DEPOSIT', status: 'PAID', amount: '128.56' },
      ])
    ).toBe(false)
  })
  it('counts the maximum concurrent quantity, not disjoint reservations together', () => {
    expect(
      peakReservedQuantity(
        [
          { startDate: date(1), endDate: date(2), quantity: 2 },
          { startDate: date(4), endDate: date(5), quantity: 3 },
        ],
        date(1),
        date(5)
      )
    ).toBe(3)
    expect(
      peakReservedQuantity(
        [
          { startDate: date(1), endDate: date(3), quantity: 2 },
          { startDate: date(3), endDate: date(5), quantity: 3 },
        ],
        date(1),
        date(5)
      )
    ).toBe(5)
  })
  it('rejects invalid windows and clips reservations to requested dates', () => {
    expect(() => peakReservedQuantity([], date(5), date(1))).toThrow('Período')
    expect(
      peakReservedQuantity(
        [{ startDate: date(1), endDate: date(2), quantity: 3 }],
        date(3),
        date(5)
      )
    ).toBe(0)
  })
})
