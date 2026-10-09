export type { ClientRentalDetail } from '../../../entities/locacao'
export type { ClientQuoteDetail } from '../../../entities/orcamento'
export interface TimelineStep {
  id: string
  label: string
  status: 'completed' | 'current' | 'pending'
  date?: Date
  description?: string
}
