import { z } from 'zod'
export const RequestPaymentSchema = z.object({
  rentalId: z.string().min(1).optional(),
  quoteId: z.string().min(1).optional(),
  amount: z.number().positive().finite(),
  dueDate: z
    .union([z.iso.date(), z.iso.datetime({ offset: true })])
    .transform((value) => new Date(value)),
})

export const PixWebhookEventSchema = z.object({
  amount: z.number().finite().nonnegative().optional(),
  paymentId: z.string().min(1),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']),
  transactionId: z.string().min(1).optional(),
  paidAt: z
    .string()
    .refine((value) => Number.isFinite(Date.parse(value)))
    .optional(),
})
const eventDate = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)))
  .nullable()
  .optional()
export const BoletoWebhookEventSchema = z
  .object({
    event: z.string().optional(),
    payment: z
      .object({
        id: z.string().min(1),
        status: z.string().optional(),
        paymentDate: eventDate,
        clientPaymentDate: eventDate,
        value: z.number().finite().nonnegative().optional(),
      })
      .passthrough(),
  })
  .passthrough()
export const VerifyBoletoSchema = z.object({ paymentId: z.string().min(1) })
