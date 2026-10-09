export type ViewMode = 'daily' | 'weekly' | 'monthly' | 'timeline'

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resourceId?: string
  color: string
  type: 'delivery' | 'pickup' | 'maintenance' | 'rental'
  status: string
  metadata?: Record<string, unknown>
  /** Data/hora de criação da solicitação (para posicionar eventos PENDING) */
  createdAt?: Date
  /** Se true, usa altura automática e posiciona pelo createdAt */
  isPendingRequest?: boolean
  /** Indica se é evento all-day */
  isAllDay?: boolean
  /** Indica se é evento multi-day (locações/orçamentos) */
  isMultiDay?: boolean
  /** Nome do cliente (para hierarquia) */
  clientName?: string
  /** Nome do equipamento (para hierarquia) */
  equipmentName?: string
  /** Nome do técnico */
  technicianName?: string
  /** Checklist de manutenção */
  checklist?: string[]
  /** Identifica o badge agregador "+N mais" */
  isAggregatedIndicator?: boolean
  /** Lista de eventos ocultos (para popover) */
  aggregatedEvents?: CalendarEvent[]
}

export interface CalendarResource {
  id: string
  name: string
}

const STATUS_LABELS: Record<string, string> = {
  // Financeiro
  PAID: 'Pago',
  UNPAID: 'Inadimplente',
  AWAITING_PAYMENT: 'Aguardando',
  SETTLED: 'Liquidado',
  // Orçamentos/Locações
  pending: 'Pendente',
  PENDING: 'Pendente',
  approved: 'Aprovado',
  ACTIVE: 'Ativa',
  rejected: 'Rejeitado',
  REJECTED: 'Rejeitado',
  completed: 'Concluído',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  OVERDUE: 'Atrasado',
  overdue: 'Atrasado',
  PENDING_RETURN: 'Devolução Pendente',
}

export function translateStatus(status: string): string {
  return STATUS_LABELS[status] || status
}
