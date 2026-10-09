import { z } from 'zod'
const requiredText = z.string().trim().min(1).max(200)
export const AddressInputSchema = z.object({
  street: requiredText, number: z.string().trim().min(1).max(30),
  complement: z.string().trim().max(200).nullable().optional(),
  neighborhood: requiredText, city: requiredText,
  state: z.string().trim().regex(/^[a-zA-Z]{2}$/).transform(value => value.toUpperCase()),
  zipCode: z.string().trim().regex(/^\d{5}-?\d{3}$/),
  isPrimary: z.boolean().optional(),
})
export const AddressPatchSchema = AddressInputSchema.partial()
export type AddressInput = z.infer<typeof AddressInputSchema>
export type AddressPatch = z.infer<typeof AddressPatchSchema>
