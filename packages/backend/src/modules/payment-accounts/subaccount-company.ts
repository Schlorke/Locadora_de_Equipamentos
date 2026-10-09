import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { formatarCnpj } from '@gb-locacoes/domain/documento'
import {
  BillingProviderError,
  checkSubaccountCompany,
  type AsaasSubaccountCompany,
} from '../billing/index'
import {
  receivingDocument,
  type ReceivingOrganization,
} from './owner-authorization'

type CheckedCompany = ReturnType<typeof checkSubaccountCompany>

/**
 * Version of the company data the owner confirmed: SHA-256 of every field sent to the provider (site and e-mails
 * included), in a fixed order. A change after the confirmation cancels the request instead of sending other data.
 */
export function companyDataVersion(company: CheckedCompany) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        'subaccount-company/v1',
        company.name,
        company.cpfCnpj,
        company.email,
        company.loginEmail,
        company.companyType,
        company.address,
        company.addressNumber,
        company.complement ?? null,
        company.province,
        company.postalCode,
        company.site,
      ])
    )
    .digest('hex')
}

/**
 * Company data sent on creation, from the registration (precedent ADR B.6): legal name, billing e-mail or the
 * owner's, the owner's verified e-mail as login, registered address and the canonical site of the company.
 * `null` when anything is missing or fails the same local validation as POST /accounts.
 */
export function subaccountCompanyOf(
  org: ReceivingOrganization,
  loginEmail: string | null,
  site: (slug: string) => string
): { company: CheckedCompany; version: string } | null {
  const document = receivingDocument(org)
  if (!loginEmail || !document) return null
  try {
    const complement = org.addressComplement?.trim()
    const company = checkSubaccountCompany({
      name: org.legalName ?? '',
      cpfCnpj: document,
      email: org.billingEmail ?? loginEmail,
      loginEmail,
      companyType: org.companyType as AsaasSubaccountCompany['companyType'],
      site: site(org.slug),
      address: org.addressLine ?? '',
      addressNumber: org.addressNumber ?? '',
      ...(complement ? { complement } : {}),
      province: org.district ?? '',
      postalCode: (org.postalCode ?? '').replace('-', ''),
    })
    return { company, version: companyDataVersion(company) }
  } catch (error) {
    if (error instanceof BillingProviderError) return null
    throw error
  }
}

/** Same reading for the worker, by the owner recorded on the request. */
export async function readSubaccountCompany(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ownerUserId: string,
  site: (slug: string) => string
) {
  const org = await tx.organization.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      slug: true,
      ownerUserId: true,
      status: true,
      access: true,
      document: true,
      documentNormalized: true,
      legalName: true,
      companyType: true,
      phone: true,
      billingEmail: true,
      addressLine: true,
      addressNumber: true,
      addressComplement: true,
      district: true,
      postalCode: true,
    },
  })
  if (!org) return null
  const contact = (
    await tx.$queryRaw<{ email: string | null; authEmailVerified: boolean }[]>`
      SELECT email, "authEmailVerified" FROM platform_user_contacts WHERE id=${ownerUserId}
    `
  )[0]
  return subaccountCompanyOf(
    org,
    contact?.authEmailVerified ? contact.email : null,
    site
  )
}

/**
 * Ownership of the CNPJ across companies (ADR SaaS, "posse do CNPJ"): another company verified this document, or
 * another company already has a current receiving account for it. The worker, under the CNPJ lock, ignores other
 * companies' requests that never reached the provider: the first durable intent wins.
 */
export async function documentInUse(
  tx: Prisma.TransactionClient,
  tenantId: string,
  document: string,
  scope: 'request' | 'intent'
) {
  const formatted = formatarCnpj(document)
  const sameDocument = {
    OR: [
      { documentNormalized: document },
      { document },
      ...(formatted ? [{ document: formatted }] : []),
    ],
  } satisfies Prisma.OrganizationWhereInput
  const verified = await tx.organization.findFirst({
    where: {
      id: { not: tenantId },
      documentVerifiedAt: { not: null },
      ...sameDocument,
    },
    select: { id: true },
  })
  if (verified) return true
  const account = await tx.paymentAccount.findFirst({
    where: {
      tenantId: { not: tenantId },
      disconnectedAt: null,
      ...(scope === 'intent' ? { status: { not: 'PROVISIONING' } } : {}),
      organization: sameDocument,
    },
    select: { id: true },
  })
  return account !== null
}
