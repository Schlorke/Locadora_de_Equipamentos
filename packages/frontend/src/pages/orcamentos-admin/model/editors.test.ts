import { expect, it } from 'vitest'
import {
  quoteCustomerDraft,
  quoteDeliveryDraft,
  quoteItemDraft,
  quoteAdjustmentDraft,
} from './editors'
import type { Quote } from '../../../entities/orcamento'
it('conserva datas, frete de reajuste e parsing OTHER do formulário web', () => {
  const quote = {
    startDate: '2033-03-01T12:00:00',
    endDate: '2033-03-03T12:00:00',
    email: 'a@example.test',
    phone: '123',
    items: [{ includeWeekends: true }],
    deliveryType: 'DELIVERY',
    deliveryFee: 0,
    deliveryAddress: { zipCode: '12345678' },
  } as Quote
  const adj = {
    id: 'a',
    quoteId: 'q',
    category: 'OTHER' as const,
    amount: 10,
    justification: 'Serviço: Motivo: detalhado',
  }
  expect(quoteCustomerDraft(quote)).toMatchObject({
    startDate: '2033-03-01',
    email: 'a@example.test',
    includeWeekends: true,
  })
  expect(
    quoteDeliveryDraft(
      quote,
      [{ ...adj, category: 'TRAVEL' }],
      (s) => s.slice(0, 5) + '-' + s.slice(5)
    )
  ).toMatchObject({ deliveryFee: '10', zipCode: '12345-678' })
  expect(
    quoteItemDraft({
      startDate: '2033-03-01T12:00:00',
      endDate: '2033-03-03T12:00:00',
      includeWeekends: false,
    } as NonNullable<Quote['items']>[number])
  ).toEqual({
    startDate: '2033-03-01',
    endDate: '2033-03-03',
    includeWeekends: false,
  })
  expect(quoteAdjustmentDraft(adj)).toEqual({
    id: 'a',
    category: 'OTHER',
    categoryOther: 'Serviço',
    value: 10,
    reason: 'Motivo: detalhado',
  })
})
