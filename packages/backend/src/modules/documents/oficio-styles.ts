import { documentTokens } from '@gb-locacoes/design-tokens/documents'
const c = documentTokens.colors
export const OFICIO_COLORS = {
  headerBg: c.brand,
  headerText: c.onBrand,
  sectionBg: c.strong,
  sectionText: c.onStrong,
  textPrimary: c.text,
  textSecondary: c.textSecondary,
  textMuted: c.textMuted,
  border: c.border,
  borderLight: c.borderLight,
  clientInfoBg: c.surface,
  altRow: c.surface,
  statusPago: c.success,
  statusNaoPago: c.danger,
  statusAguardando: c.warning,
  totalHighlight: c.strong,
} as const
export const OFICIO_LAYOUT = documentTokens.layout

export const PAYMENT_TERMS_LABELS: Record<string, string> = {
  UPFRONT: 'Pagamento Antecipado',
  ON_DELIVERY: 'Pagamento na Entrega',
  AT_END: 'Pagamento no Final',
}

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  COMPLETED: 'Concluído',
}

export const ADJUSTMENT_CATEGORY_LABELS: Record<string, string> = {
  LABOR: 'Mão de Obra',
  TRAVEL: 'Deslocamento/Frete',
  MAINTENANCE: 'Manutenção',
  OTHER: 'Outros',
}
