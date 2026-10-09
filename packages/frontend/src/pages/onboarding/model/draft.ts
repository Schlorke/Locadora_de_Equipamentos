import { z } from 'zod'
import {
  CreateOrganizationInputSchema,
  IdempotencyKeySchema,
} from '@gb-locacoes/contracts/onboarding'

const input = z.string().max(200)
export const CompanyFormSchema = z.strictObject({
  cnpj: input,
  legalName: input,
  tradeName: input,
  companyType: input,
  phone: input,
  postalCode: input,
  addressLine: input,
  addressNumber: input,
  addressComplement: input,
  district: input,
  city: input,
  state: input,
  representationDeclared: z.boolean(),
})
export type CompanyForm = z.infer<typeof CompanyFormSchema>
export const emptyCompany: CompanyForm = {
  cnpj: '',
  legalName: '',
  tradeName: '',
  companyType: '',
  phone: '',
  postalCode: '',
  addressLine: '',
  addressNumber: '',
  addressComplement: '',
  district: '',
  city: '',
  state: '',
  representationDeclared: false,
}
const DraftSchema = z.strictObject({
  version: z.literal(1),
  company: CompanyFormSchema,
  slug: z.string().max(63),
  planVersionId: z.string().max(200),
  pending: z
    .strictObject({
      key: IdempotencyKeySchema,
      input: CreateOrganizationInputSchema,
    })
    .nullable(),
})
export type OnboardingDraft = z.infer<typeof DraftSchema>
export interface DraftStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
const keyFor = (userId: string) =>
  'locadora.onboarding.v1.' + encodeURIComponent(userId)
export function readDraft(
  storage: DraftStorage,
  userId: string
): OnboardingDraft | null {
  try {
    const raw = storage.getItem(keyFor(userId))
    if (!raw || raw.length > 16384) return null
    const parsed = DraftSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
export function writeDraft(
  storage: DraftStorage,
  userId: string,
  draft: OnboardingDraft
): boolean {
  try {
    const parsed = DraftSchema.parse(draft)
    storage.setItem(keyFor(userId), JSON.stringify(parsed))
    return true
  } catch {
    return false
  }
}
export function clearDraft(storage: DraftStorage, userId: string): void {
  try {
    storage.removeItem(keyFor(userId))
  } catch {
    /* Storage may be unavailable. */
  }
}
