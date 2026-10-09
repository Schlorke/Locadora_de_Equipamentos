import { z } from 'zod'
import Decimal from 'decimal.js'

export const CreateRentalSchema = z.object({
  userId: z.string(),
  quoteId: z.string().optional(),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)),
  items: z.array(
    z.object({
      equipmentId: z.string(),
      quantity: z.number().int().positive(),
      days: z.number().int().positive(),
      pricePerDay: z
        .number()
        .or(z.string())
        .transform((val) => new Decimal(val)),
    })
  ),
  notes: z.string().optional(),
})

export const UpdateRentalSchema = z.object({
  status: z
    .enum([
      'PENDING',
      'ACTIVE',
      'COMPLETED',
      'CANCELLED',
      'OVERDUE',
      'PENDING_RETURN',
    ])
    .optional(),
  startDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  endDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  extensionDays: z.number().int().positive().optional(),
  lateFee: z
    .number()
    .or(z.string())
    .transform((val) => new Decimal(val))
    .optional(),
  checkInAt: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  checkOutAt: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  notes: z.string().optional(),
})

export const CheckInSchema = z.object({
  damageFee: z.number().nonnegative().optional(),
  notes: z.string().optional(),
})

export const AdminExtendRentalSchema = z.object({
  additionalDays: z.number().int().positive(),
  generateBoleto: z.boolean().optional().default(true),
  boletoDueDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
})

export const ClientExtendRentalSchema = z.object({
  extensionDays: z.number().int().positive().max(30), // Máximo 30 dias
})
