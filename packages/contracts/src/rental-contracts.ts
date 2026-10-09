import { z } from 'zod'
export const GenerateRentalContractSchema = z.object({
  rentalId: z.string().min(1).max(128),
  template: z.literal('default').optional(),
})
export const RequestContractSignatureSchema = z.object({
  contractId: z.string().min(1).max(128),
})
export const ZapSignWebhookEventSchema = z.object({
  doc_token: z.string().min(1),
  status: z.string().min(1),
  signed_at: z
    .string()
    .refine((value) => Number.isFinite(Date.parse(value)))
    .optional(),
  pdf_url: z
    .string()
    .url()
    .refine((value) => new URL(value).protocol === 'https:')
    .optional(),
  signers: z.array(z.object({ name: z.string().optional() })).optional(),
})
