import type { PlatformInvoiceStatus } from '@gb-locacoes/contracts/subscription'

/** Money já validado pelo contrato: formata sem perder centavos em Number. */
export function subscriptionMoney(value: string): string {
  const [whole, fraction] = value.split('.')
  return `R$ ${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fraction}`
}
/** @db.Date é dia civil, sem conversão de fuso ou horário. */
export function subscriptionDate(value: string | null): string {
  if (!value) return 'Não informado'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}
export const invoiceLabels: Readonly<Record<PlatformInvoiceStatus, string>> = {
  PENDING: 'Pendente',
  PAID: 'Paga',
  OVERDUE: 'Vencida',
  CANCELED: 'Cancelada',
  REFUNDED: 'Estornada',
  CHARGEBACK: 'Contestada',
}
