import { z } from 'zod'

/** Existing wire contract; commercial normalization belongs to the backend. */
export const CustomerProfileUpdateSchema = z
  .object({
    phone: z.string().max(30).optional(),
    cnpj: z.string().max(20).optional(),
    cpf: z.string().max(20).optional(),
    company: z.string().max(200).optional(),
  })
  .strict()
