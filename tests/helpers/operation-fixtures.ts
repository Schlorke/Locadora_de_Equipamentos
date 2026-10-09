import type { Delivery } from '../../packages/frontend/src/pages/logistica/model/contracts'
import type { Maintenance } from '../../packages/frontend/src/pages/manutencao/model/contracts'
export function delivery(index: number): Delivery {
  const day = new Date()
  day.setHours(12, 0, 0, 0)
  return {
    id: 'entrega ' + index,
    rentalId: 'rental',
    type: index === 1 ? 'PICKUP' : 'DELIVERY',
    status: index === 1 ? 'IN_TRANSIT' : 'SCHEDULED',
    scheduledAt: day.toISOString(),
    completedAt: null,
    address: {
      street: 'Rua de teste',
      number: '1',
      city: 'Cidade',
      state: 'SP',
      zipCode: '01001000',
    },
    distance: 0,
    vehicleId: null,
    driverId: null,
    driverName: null,
    photos: [],
    checklist: null,
    notes: null,
    rental: {
      id: 'rental',
      users: {
        name: 'Cliente ' + index,
        email: 'cliente@example.test',
        phone: 'telefone',
      },
    },
  }
}
export function maintenance(index: number): Maintenance {
  const day = new Date()
  day.setHours(12, 0, 0, 0)
  return {
    id: 'manutenção ' + index,
    equipmentId: 'equipment' + index,
    type: index === 1 ? 'CORRECTIVE' : 'PREVENTIVE',
    status: index === 1 ? 'IN_PROGRESS' : 'SCHEDULED',
    scheduledAt: day.toISOString(),
    completedAt: null,
    cost: 30,
    laborCost: 10,
    partsCost: 20,
    description: 'Revisão de teste',
    notes: 'Nota de teste',
    technician: 'Técnico ' + index,
    equipment: {
      id: 'equipment' + index,
      name: 'Equipamento ' + index,
      images: [],
      category: { id: 'cat', name: 'Categoria' },
    },
  }
}
export const operationsTenant = (id: string) => ({
  tenant: { id, slug: id, name: id, status: 'ACTIVE' as const },
  membershipId: id,
  role: 'ADMIN' as const,
})
