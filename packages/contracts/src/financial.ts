import { z } from 'zod'
const TAX_REGIMES = [
  'SIMPLES_NACIONAL',
  'LUCRO_PRESUMIDO',
  'LUCRO_REAL',
] as const

export const UpdateFinancialSettingsSchema = z.object({
  // Campos legados (obrigatórios para retrocompatibilidade)
  cpfRate: z.number().min(0).max(100),
  cnpjRate: z.number().min(0).max(100),
  cniRate: z.number().min(0).max(100),
  // Novos campos (opcionais)
  taxRegime: z.enum(TAX_REGIMES).optional(),
  issRate: z.number().min(0).max(100).optional(),
  issExemptRental: z.boolean().optional(),
  irpjPresumidoRate: z.number().min(0).max(100).nullable().optional(),
  csllPresumidoRate: z.number().min(0).max(100).nullable().optional(),
  pisCofinsRate: z.number().min(0).max(100).nullable().optional(),
  simplesAnexo: z.string().nullable().optional(),
  simplesAliquota: z.number().min(0).max(100).nullable().optional(),
  ibsCbsRate: z.number().min(0).max(100).nullable().optional(),
  ibsCbsActive: z.boolean().optional(),
})

export const UpdateFinancialStatusSchema = z.object({
  billingStatus: z.enum(['PAID', 'UNPAID', 'AWAITING_PAYMENT', 'SETTLED']),
  invoiceNumber: z.string().trim().max(120).optional().nullable(),
  invoiceIssuedAt: z.coerce.date().optional().nullable(),
  boletoIssuedAt: z.coerce.date().optional().nullable(),
  paidAt: z.coerce.date().optional().nullable(),
})
export const UpdateFinancialDueDateSchema = z.object({
  dueDate: z.coerce.date(),
})

export type FinancialSettingsInput = z.infer<
  typeof UpdateFinancialSettingsSchema
>
export type FinancialStatusInput = z.infer<typeof UpdateFinancialStatusSchema>
