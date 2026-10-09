import {
  startOfMonth,
  endOfMonth,
  differenceInCalendarDays,
  differenceInBusinessDays,
  startOfDay as dateFnsStartOfDay,
} from 'date-fns'
import { statusConfig, type Quote, type QuotePayment } from './registro'

// ─── Date utilities ──────────────────────────────────────────────

/** Converte string yyyy-MM-dd em Date no fuso local (evita dia anterior por UTC). */
export function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-').map(Number)
  const y = parts[0] ?? 0
  const m = parts[1] ?? 0
  const d = parts[2] ?? 0
  return new Date(y, m - 1, d)
}

/** Calcula dias entre duas datas (inclusive). Se includeWeekends=false, conta apenas dias úteis. */
export function countDaysBetween(
  startDate: Date,
  endDate: Date,
  includeWeekends: boolean
): number {
  const start = dateFnsStartOfDay(startDate)
  const end = dateFnsStartOfDay(endDate)
  if (end < start) return 0
  if (includeWeekends) return differenceInCalendarDays(end, start) + 1
  return Math.max(1, differenceInBusinessDays(end, start) + 1)
}

// ─── Document formatting ─────────────────────────────────────────

/** Formata CPF durante digitação (xxx.xxx.xxx-xx) */
export function formatCPFInput(value: string): string {
  const numbers = value.replace(/\D/g, '')
  if (numbers.length <= 3) return numbers
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`
  if (numbers.length <= 9)
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`
}

/** Formata CNPJ durante digitação (xx.xxx.xxx/xxxx-xx) */
export function formatCNPJInput(value: string): string {
  const numbers = value.replace(/\D/g, '')
  if (numbers.length <= 2) return numbers
  if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`
  if (numbers.length <= 8)
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`
  if (numbers.length <= 12)
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`
  return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`
}

// ─── Quote date helpers ──────────────────────────────────────────

export function getQuoteReferenceDate(
  quote: Pick<Quote, 'startDate' | 'createdAt'>
): Date | null {
  const referenceRaw =
    typeof quote.startDate === 'string' && quote.startDate.trim() !== ''
      ? quote.startDate
      : quote.createdAt

  const referenceDate = new Date(referenceRaw)
  if (Number.isNaN(referenceDate.getTime())) {
    return null
  }

  return referenceDate
}

export function hasQuotesInMonth(quotesList: Quote[], month: Date): boolean {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)

  return quotesList.some((quote) => {
    const referenceDate = getQuoteReferenceDate(quote)
    if (!referenceDate) {
      return false
    }

    return referenceDate >= monthStart && referenceDate <= monthEnd
  })
}

export function findFirstMonthWithQuotes(quotesList: Quote[]): Date | null {
  let firstMonthTime: number | null = null

  quotesList.forEach((quote) => {
    const referenceDate = getQuoteReferenceDate(quote)
    if (!referenceDate) {
      return
    }

    const monthTime = startOfMonth(referenceDate).getTime()
    if (firstMonthTime === null || monthTime < firstMonthTime) {
      firstMonthTime = monthTime
    }
  })

  return firstMonthTime === null ? null : new Date(firstMonthTime)
}

// ─── Status helpers ─────────────────────────────────────────────

/** Normaliza o status do orçamento para lowercase. */
export function normalizeStatus(
  status: Quote['status'] | string | undefined
): string {
  return typeof status === 'string' ? status.toLowerCase() : ''
}

/** Normaliza um orçamento: corrige status legado, unifica totalPrice. */
export function normalizeQuote(quote: Quote): Quote {
  const normalizedStatus = normalizeStatus(quote.status) || 'pending'
  const approvedAtValueRaw = quote.approvedAt
  const approvedAtValue =
    approvedAtValueRaw === undefined ||
    approvedAtValueRaw === null ||
    (typeof approvedAtValueRaw === 'string' &&
      (approvedAtValueRaw.trim() === '' ||
        approvedAtValueRaw.trim() === 'null' ||
        approvedAtValueRaw.trim() === 'undefined'))
      ? null
      : approvedAtValueRaw
  const rejectedAtValueRaw = quote.rejectedAt
  const rejectedAtValue =
    rejectedAtValueRaw === undefined ||
    rejectedAtValueRaw === null ||
    (typeof rejectedAtValueRaw === 'string' &&
      (rejectedAtValueRaw.trim() === '' ||
        rejectedAtValueRaw.trim() === 'null' ||
        rejectedAtValueRaw.trim() === 'undefined'))
      ? null
      : rejectedAtValueRaw

  const hasApprovedAt =
    approvedAtValue != null &&
    (typeof approvedAtValue !== 'string' ||
      (approvedAtValue.trim() !== '' &&
        approvedAtValue.trim() !== 'null' &&
        approvedAtValue.trim() !== 'undefined'))
  const effectiveStatus =
    normalizedStatus === 'pending' && hasApprovedAt && !rejectedAtValue
      ? ('approved' as const)
      : (normalizedStatus as Quote['status'])

  const totalPrice =
    typeof (quote as Quote & { total?: number }).total === 'number'
      ? (quote as Quote & { total?: number }).total
      : quote.totalPrice
  return {
    ...quote,
    totalPrice: totalPrice ?? 0,
    status: effectiveStatus,
    approvedAt: approvedAtValue,
    rejectedAt: rejectedAtValue,
  }
}

// ─── Display formatting ──────────────────────────────────────────

/** Format date for display in pt-BR. Returns 'Não definido' for null, 'Data inválida' for invalid dates. */
export function formatDate(dateString: string | null | undefined) {
  if (!dateString) return 'Não definido'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Data inválida'
    return date.toLocaleDateString('pt-BR')
  } catch {
    return 'Data inválida'
  }
}

/** Formata o status de pagamento para exibição. */
export function formatPaymentStatus(status: string): string {
  switch (status) {
    case 'PAID':
      return 'Pago'
    case 'OVERDUE':
      return 'Vencido'
    case 'PENDING':
      return 'Pendente'
    default:
      return status
  }
}

// ─── Boleto helpers ─────────────────────────────────────────────

/** Classes Tailwind da badge de status do boleto. */
export function getBoletoStatusBadgeClassName(status: string): string {
  const upper = status?.toUpperCase()
  const base = 'transition-colors duration-200'
  if (upper === 'PAID')
    return `${base} bg-emerald-500 text-white hover:bg-emerald-600`
  if (upper === 'OVERDUE')
    return `${base} bg-red-500 text-white hover:bg-red-600`
  if (upper === 'CANCELLED' || upper === 'REFUNDED')
    return `${base} bg-slate-500 text-white hover:bg-slate-600`
  return `${base} bg-orange-500 text-white shadow-sm hover:bg-orange-600`
}

/** Retorna o último pagamento do tipo BOLETO do orçamento. */
export function getBoletoPayment(quote: Quote | null): QuotePayment | null {
  if (!quote?.payments || quote.payments.length === 0) return null
  const boletos = quote.payments.filter(
    (payment) => payment.method === 'BOLETO'
  )
  if (boletos.length === 0) return null
  return boletos[boletos.length - 1] ?? null
}

// ─── Badge helpers ──────────────────────────────────────────────

/** Badge de canto flutuante para o card do Kanban: prioriza status de pagamento, senão status do orçamento. */
export function getCardStatusBadge(quote: Quote): {
  label: string
  className: string
} {
  const status = normalizeStatus(quote.status)
  const payment = getBoletoPayment(quote)
  const paymentStatus = payment?.status?.toUpperCase()

  if (status === 'rejected') {
    return {
      label: 'Rejeitado',
      className: 'bg-rose-500 text-white shadow-sm',
    }
  }
  if (status === 'pending') {
    return {
      label: 'Aprovação Pendente',
      className: 'bg-blue-500 text-white shadow-sm',
    }
  }
  if (payment) {
    if (paymentStatus === 'PAID') {
      return {
        label: 'Pago',
        className: 'bg-emerald-500 text-white shadow-sm',
      }
    }
    if (paymentStatus === 'OVERDUE') {
      return {
        label: 'Vencido',
        className: 'bg-amber-500 text-white shadow-sm',
      }
    }
    return {
      label: 'Pagamento Pendente',
      className: 'bg-orange-500 text-white shadow-sm',
    }
  }
  const config = statusConfig[status] ?? statusConfig.pending
  const solidMap: Record<string, string> = {
    pending: 'bg-orange-500 text-white shadow-sm',
    approved: 'bg-emerald-500 text-white shadow-sm',
    completed: 'bg-blue-500 text-white shadow-sm',
  }
  return {
    label: config?.label ?? 'Pendente',
    className: solidMap[status] ?? 'bg-gray-500 text-white shadow-sm',
  }
}
