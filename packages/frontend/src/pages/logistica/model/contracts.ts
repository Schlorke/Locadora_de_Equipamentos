export interface Delivery {
  id: string
  rentalId: string
  type: 'DELIVERY' | 'PICKUP'
  status: string
  scheduledAt: string
  completedAt: string | null
  address: {
    street?: string
    number?: string
    city?: string
    state?: string
    zipCode?: string
  }
  distance: number | null
  vehicleId: string | null
  driverId: string | null
  driverName: string | null
  photos: string[]
  checklist: {
    [key: string]: boolean | string
  } | null
  notes: string | null
  rental: {
    id: string
    users: {
      name: string | null
      email: string
      phone: string | null
    }
  }
}

export interface Vehicle {
  id: string
  plate: string
  brand: string | null
  model: string | null
  type: string
  status: string
}

export interface Driver {
  id: string
  name: string
  phone: string
  status: string
}

export const statusLabels: Record<string, { label: string }> = {
  SCHEDULED: { label: 'Agendada' },
  IN_TRANSIT: { label: 'Em Trânsito' },
  COMPLETED: { label: 'Concluída' },
  CANCELLED: { label: 'Cancelada' },
  FAILED: { label: 'Falhou' },
}

export const typeConfig: Record<string, string> = {
  DELIVERY: 'Entrega',
  PICKUP: 'Coleta',
}
