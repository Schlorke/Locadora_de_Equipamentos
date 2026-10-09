export interface Maintenance {
  id: string
  equipmentId: string
  type: string
  scheduledAt: string
  completedAt: string | null
  cost: number | null
  laborCost: number | null
  partsCost: number | null
  description: string | null
  notes: string | null
  technician: string | null
  status: string
  equipment: {
    id: string
    name: string
    images: string[]
    category?: {
      id: string
      name: string
    }
  }
}

export const statusLabels: Record<string, { label: string }> = {
  SCHEDULED: { label: 'Agendada' },
  IN_PROGRESS: { label: 'Em Andamento' },
  COMPLETED: { label: 'Concluída' },
  CANCELLED: { label: 'Cancelada' },
}

export const typeConfig: Record<string, string> = {
  PREVENTIVE: 'Preventiva',
  CORRECTIVE: 'Corretiva',
  INSPECTION: 'Inspeção',
}
