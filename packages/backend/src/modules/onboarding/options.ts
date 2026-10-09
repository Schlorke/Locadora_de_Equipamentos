import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  LEGAL_DOCUMENT_KINDS,
  OnboardingOptionsResponseSchema,
  type OnboardingOptionsResponse,
} from '@gb-locacoes/contracts/onboarding'
import { publishedSignupDocuments } from './legal-publication'
import { OnboardingError } from './errors'

const contentsSchema = z.partialRecord(
  z.enum(LEGAL_DOCUMENT_KINDS),
  z.string().min(1).max(32768)
)

/** Only the operator's current publication authorizes exact text; no URL, HTML execution or normalization. */
export function readPublishedOnboardingOptions(input: {
  publication: unknown
  contents: unknown
  today: string
  rootDomain: string
  captchaSiteKey: string
}): OnboardingOptionsResponse {
  const publication = publishedSignupDocuments(input.publication, input.today)
  const contents = contentsSchema.safeParse(input.contents)
  if (!contents.success)
    throw new OnboardingError(503, 'LEGAL_PUBLICATION_UNAVAILABLE')
  const kinds = Object.keys(contents.data)
  if (
    kinds.length !== publication.length ||
    kinds.some((kind) => !publication.some((row) => row.kind === kind))
  )
    throw new OnboardingError(503, 'LEGAL_PUBLICATION_UNAVAILABLE')
  const documents = publication.map((row) => {
    const text = contents.data[row.kind]
    if (
      !text ||
      createHash('sha256').update(text, 'utf8').digest('hex') !== row.textSha256
    )
      throw new OnboardingError(503, 'LEGAL_PUBLICATION_UNAVAILABLE')
    return { ...row, text }
  })
  const parsed = OnboardingOptionsResponseSchema.safeParse({
    mode: 'on',
    rootDomain: input.rootDomain,
    captchaSiteKey: input.captchaSiteKey,
    documents,
  })
  if (!parsed.success)
    throw new OnboardingError(503, 'ONBOARDING_CONFIGURATION_INVALID')
  return parsed.data
}
