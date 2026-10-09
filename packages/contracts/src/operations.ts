import { z } from 'zod'

export const CreateVehicleSchema = z.object({
  plate: z.string().min(1, 'Placa é obrigatória'),
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().positive().optional(),
  type: z.enum(['TRUCK', 'VAN', 'PICKUP', 'MOTORCYCLE']).optional(),
  status: z
    .enum(['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE'])
    .optional(),
})

export const CreateDeliverySchema = z.object({
  rentalId: z.string(),
  type: z.enum(['DELIVERY', 'PICKUP']),
  scheduledAt: z
    .string()
    .transform((str) => new Date(str))
    .refine((value) => !Number.isNaN(value.getTime()), 'Data inválida'),
  address: z.object({
    street: z.string(),
    number: z.string(),
    complement: z.string().optional(),
    neighborhood: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
  }),
  distance: z.number().finite().nonnegative().optional(),
  vehicleId: z.string().optional(),
  driverId: z.string().optional(),
  driverName: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdateDeliverySchema = z.object({
  status: z
    .enum(['SCHEDULED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED', 'FAILED'])
    .optional(),
  completedAt: z
    .string()
    .transform((str) => new Date(str))
    .refine((value) => !Number.isNaN(value.getTime()), 'Data inválida')
    .optional(),
  photos: z.array(z.string()).optional(),
  checklist: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().optional(),
  vehicleId: z.string().optional().nullable(),
  driverId: z.string().optional().nullable(),
  driverName: z.string().optional().nullable(),
  distance: z.number().finite().nonnegative().optional().nullable(),
})

export type VehicleInput = z.output<typeof CreateVehicleSchema>
export type DeliveryInput = z.output<typeof CreateDeliverySchema>
export type DeliveryPatch = z.output<typeof UpdateDeliverySchema>

export const CreateMaintenanceSchema = z.object({
  equipmentId: z.string(),
  type: z.enum(['PREVENTIVE', 'CORRECTIVE', 'INSPECTION']),
  scheduledAt: z
    .string()
    .transform((str) => new Date(str))
    .refine((value) => !Number.isNaN(value.getTime()), 'Data inválida'),
  cost: z.number().finite().nonnegative().optional(),
  laborCost: z.number().finite().nonnegative().optional(),
  partsCost: z.number().finite().nonnegative().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  technician: z.string().optional(),
})
export const UpdateMaintenanceSchema = z.object({
  status: z
    .enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
    .optional(),
  completedAt: z
    .string()
    .transform((str) => new Date(str))
    .refine((value) => !Number.isNaN(value.getTime()), 'Data inválida')
    .optional(),
  cost: z.number().finite().nonnegative().optional(),
  laborCost: z.number().finite().nonnegative().optional(),
  partsCost: z.number().finite().nonnegative().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  technician: z.string().optional(),
})
export const CompleteMaintenanceSchema = z.object({
  completedAt: z
    .string()
    .transform((str) => new Date(str))
    .refine((value) => !Number.isNaN(value.getTime()), 'Data inválida')
    .optional(),
  cost: z.number().finite().nonnegative().optional(),
  laborCost: z.number().finite().nonnegative().optional(),
  partsCost: z.number().finite().nonnegative().optional(),
  notes: z.string().optional(),
  hourMeter: z.number().finite().nonnegative().optional(), // Horímetro após manutenção
  odometer: z.number().finite().nonnegative().optional(), // Odômetro após manutenção
})
export const SchedulePreventiveSchema = z.object({
  equipmentId: z.string(),
  rules: z.object({
    daysInterval: z.number().finite().nonnegative().optional(),
    hoursInterval: z.number().finite().nonnegative().optional(),
    rentalsInterval: z.number().finite().nonnegative().optional(),
  }),
  description: z.string().optional(),
  notes: z.string().optional(),
  technician: z.string().optional(),
})
export type MaintenanceInput = z.output<typeof CreateMaintenanceSchema>
export type MaintenancePatch = z.output<typeof UpdateMaintenanceSchema>
export type MaintenanceCompletion = z.output<typeof CompleteMaintenanceSchema>
export type PreventiveMaintenanceInput = z.output<
  typeof SchedulePreventiveSchema
>

const postalCode = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .pipe(z.string().regex(/^\d{8}$/))
export const ShippingCalculationSchema = z
  .object({
    from: z.object({ postal_code: postalCode }),
    to: z.object({ postal_code: postalCode }),
    products: z
      .array(
        z.object({
          id: z.string().min(1),
          width: z.number().positive().max(5000),
          height: z.number().positive().max(5000),
          length: z.number().positive().max(5000),
          weight: z.number().positive().max(100000),
          quantity: z.number().int().positive().max(10000).default(1),
          insurance_value: z.number().nonnegative().optional(),
        })
      )
      .min(1)
      .max(100),
  })
  .strict()

export type ShippingCalculationInput = z.output<
  typeof ShippingCalculationSchema
>
