import { z } from 'zod'

/** Entrada HTTP existente; registrar pedido não altera a locação. */
export const RentalExtensionRequestSchema = z
  .object({ additionalDays: z.number().int().min(1).max(365) })
  .strict()
