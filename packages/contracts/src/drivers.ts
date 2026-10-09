import { z } from 'zod'

export const CreateDriverSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  cnh: z.string().optional(),
  cnhCategory: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']).optional(),
})
