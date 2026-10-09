import {
  LegalAcceptanceInputSchema,
  REQUIRED_SIGNUP_DOCUMENTS,
  type LegalAcceptanceInput,
} from '@gb-locacoes/contracts/onboarding'
import { z } from 'zod'
import { OnboardingError } from './errors'

const publicationSchema = z
  .array(LegalAcceptanceInputSchema)
  .min(4)
  .max(5)
  .refine((rows) => new Set(rows.map((row) => row.kind)).size === rows.length)
  .refine((rows) =>
    REQUIRED_SIGNUP_DOCUMENTS.every((kind) =>
      rows.some((row) => row.kind === kind)
    )
  )

/** Trusted publication metadata, supplied by the operator, never by the signup body. */
export function publishedSignupDocuments(
  value: unknown,
  today: string
): LegalAcceptanceInput[] {
  const publication = publicationSchema.safeParse(value)
  if (
    !publication.success ||
    publication.data.some((row) => row.version > today)
  )
    throw new OnboardingError(503, 'LEGAL_PUBLICATION_UNAVAILABLE')
  return publication.data
}

export function assertPublishedAcceptances(
  accepted: readonly LegalAcceptanceInput[],
  publication: readonly LegalAcceptanceInput[]
) {
  if (
    accepted.some(
      (row) =>
        !publication.some(
          (current) =>
            current.kind === row.kind &&
            current.version === row.version &&
            current.textSha256 === row.textSha256
        )
    )
  )
    throw new OnboardingError(409, 'LEGAL_DOCUMENT_CHANGED')
}
