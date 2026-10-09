import type { Quote, QuoteAdjustmentFromApi } from '../../../entities/orcamento'
import { formatDateForInput } from '../../../shared/lib/formatting'
export function quoteCustomerDraft(quote: Quote) {
  return {
    startDate: quote.startDate ? formatDateForInput(quote.startDate) : '',
    endDate: quote.endDate ? formatDateForInput(quote.endDate) : '',
    email: quote.email ?? '',
    phone: quote.phone ?? '',
    includeWeekends: quote.items?.[0]?.includeWeekends ?? false,
    cpf: quote.cpf ?? '',
    cnpj: quote.cnpj ?? '',
    company: quote.company ?? '',
  }
}
export function quoteDeliveryDraft(
  quote: Quote,
  adjustments: QuoteAdjustmentFromApi[],
  formatCEP: (value: string) => string
) {
  const addr = quote.deliveryAddress,
    travel = adjustments.find((a) => a.category === 'TRAVEL')
  const fee =
    quote.deliveryFee != null && quote.deliveryFee > 0
      ? String(quote.deliveryFee)
      : ''
  return {
    deliveryType: quote.deliveryType ?? null,
    deliveryFee: fee || (travel ? String(travel.amount) : ''),
    street: addr?.street ?? '',
    number: addr?.number ?? '',
    complement: addr?.complement ?? '',
    neighborhood: addr?.neighborhood ?? '',
    city: addr?.city ?? '',
    state: addr?.state ?? '',
    zipCode: formatCEP(addr?.zipCode ?? ''),
  }
}
export function quoteItemDraft(item: NonNullable<Quote['items']>[number]) {
  return {
    startDate: item.startDate
      ? typeof item.startDate === 'string'
        ? item.startDate.slice(0, 10)
        : formatDateForInput(item.startDate)
      : '',
    endDate: item.endDate
      ? typeof item.endDate === 'string'
        ? item.endDate.slice(0, 10)
        : formatDateForInput(item.endDate)
      : '',
    includeWeekends: item.includeWeekends ?? false,
  }
}
export function quoteAdjustmentDraft(adj: QuoteAdjustmentFromApi) {
  const idx = adj.category === 'OTHER' ? adj.justification.indexOf(': ') : -1
  return {
    id: adj.id,
    category: adj.category,
    categoryOther: idx >= 0 ? adj.justification.slice(0, idx) : undefined,
    value: adj.amount,
    reason: idx >= 0 ? adj.justification.slice(idx + 2) : adj.justification,
  }
}
