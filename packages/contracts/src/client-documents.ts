import { z } from 'zod'
export const ClientDocumentTypeSchema = z.enum([
  'ID_DOCUMENT',
  'SELFIE',
  'SIGNED_CONTRACT',
  'CPF_CNPJ_PROOF',
])
