import { createHash } from 'node:crypto'
import {
  REQUIRED_SIGNUP_DOCUMENTS,
  type CreateOrganizationInput,
} from '@gb-locacoes/contracts/onboarding'

/** Synthetic acceptance fingerprints only; these are never deployable legal documents. */
export const onboardingPublication = REQUIRED_SIGNUP_DOCUMENTS.map((kind) => ({
  kind,
  version: '2026-10-01',
  textSha256: createHash('sha256')
    .update('Synthetic test only:' + kind)
    .digest('hex'),
}))

export function onboardingInput(
  planVersionId: string,
  slug: string,
  cnpj = '12ABC34501DE35'
): CreateOrganizationInput {
  return {
    planVersionId,
    slug,
    acceptances: onboardingPublication.map((row) => ({ ...row })),
    company: {
      cnpj,
      legalName: 'Synthetic Company',
      tradeName: 'Synthetic Rental',
      companyType: 'LIMITED',
      phone: '41999998888',
      postalCode: '80010000',
      addressLine: 'Test Street',
      addressNumber: '10',
      addressComplement: null,
      district: 'Center',
      city: 'Curitiba',
      state: 'PR',
      representationDeclared: true,
    },
  }
}
