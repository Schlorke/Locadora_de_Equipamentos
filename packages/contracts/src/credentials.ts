import { z } from 'zod'
export const MAX_EMAIL_LENGTH = 254
export const registerSchema = z
  .object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Email inválido')
      .max(MAX_EMAIL_LENGTH, 'Email inválido'),
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
    phone: z.string().min(10, 'Telefone inválido'),
    cpf: z.string().optional(),
    cnpj: z.string().optional(),
    cep: z.string().optional(),
  })
  .refine((data) => data.cpf || data.cnpj, {
    message: 'CPF ou CNPJ é obrigatório',
    path: ['cpf'],
  })
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Email inválido')
    .max(MAX_EMAIL_LENGTH, 'Email inválido'),
})
export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
})
export type RegistrationInput = z.infer<typeof registerSchema>

function passwordFitsBcrypt(value: string): boolean {
  let bytes = 0
  for (const character of value) {
    const point = character.codePointAt(0)!
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4
    if (bytes > 72) return false
  }
  return true
}

/** B.8: company and personal documents do not belong to the account step. */
export const OwnerRegistrationSchema = z.strictObject({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().toLowerCase().email().max(MAX_EMAIL_LENGTH),
  password: z
    .string()
    .min(10)
    .max(128)
    .refine(passwordFitsBcrypt, 'A senha deve caber em 72 bytes UTF-8.'),
})
export type OwnerRegistrationInput = z.infer<typeof OwnerRegistrationSchema>

/** Read from the authenticated user's row; authentication alone is not verification. */
export const OwnerAccountResponseSchema = z.strictObject({
  userId: z.string().min(1).max(200),
  emailVerified: z.boolean(),
})
