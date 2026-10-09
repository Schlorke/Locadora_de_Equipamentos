import { z } from 'zod'

export const CreateEquipmentUnitSchema = z.object({
  equipmentId: z.string(),
  uniqueCode: z.string().min(1, 'Código único é obrigatório'),
  serialNumber: z.string().optional(),
  notes: z.string().optional(),
  hourMeter: z.number().min(0).optional(),
  odometer: z.number().min(0).optional(),
})

export const UpdateEquipmentUnitSchema = z.object({
  uniqueCode: z.string().min(1).optional(),
  status: z
    .enum(['AVAILABLE', 'RESERVED', 'RENTED', 'MAINTENANCE', 'RETIRED'])
    .optional(),
  hourMeter: z.number().min(0).optional(),
  odometer: z.number().min(0).optional(),
  serialNumber: z.string().optional(),
  notes: z.string().optional(),
})
