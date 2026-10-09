import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { Prisma } from '@prisma/client'
import type { TenantTransactionRunner } from '../rentals/index'

export interface EmailBranding {
  name: string
  publicBaseUrl: string
  logoUrl: string | null
  contactEmail: string | null
  phone: string | null
  address: string | null
}
export class TenantBrandingError extends Error {
  readonly status = 409
  readonly code = 'EMAIL_BRANDING_NOT_CONFIGURED'
}
export function escapeEmailHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!
  )
}
function validatedUrl(value: string, base?: string): string {
  let url: URL
  try {
    url = new URL(value, base)
  } catch {
    throw new TenantBrandingError('URL de email da locadora inválida')
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  const localDevelopment = ['test', 'development'].includes(
    process.env.NODE_ENV ?? ''
  )
  if (
    url.username ||
    url.password ||
    (url.protocol !== 'https:' &&
      !(localDevelopment && local && url.protocol === 'http:'))
  )
    throw new TenantBrandingError(
      'Email requer URL HTTPS configurada pela locadora'
    )
  return url.toString()
}
export function emailAssetUrl(branding: EmailBranding, value: string): string {
  return escapeEmailHtml(validatedUrl(value, branding.publicBaseUrl))
}
export function normalizeEmailBranding(branding: EmailBranding) {
  if (!branding?.name?.trim() || !branding.publicBaseUrl?.trim())
    throw new TenantBrandingError(
      'Configure nome e URL pública da locadora antes de enviar emails'
    )
  const parsedBase = new URL(validatedUrl(branding.publicBaseUrl))
  if (parsedBase.search || parsedBase.hash)
    throw new TenantBrandingError(
      'A URL pública não pode incluir parâmetros ou fragmentos'
    )
  const publicBaseUrl = parsedBase.toString().replace(/\/$/, '')
  const words = branding.name.trim().split(/\s+/)
  const initials =
    words[0]!.length <= 3
      ? words[0]!
      : words
          .map((word) => word[0])
          .slice(0, 2)
          .join('')
  const name = escapeEmailHtml(branding.name.trim())
  return {
    ...branding,
    name,
    publicBaseUrl: escapeEmailHtml(publicBaseUrl),
    logoHtml: branding.logoUrl
      ? `<img src="${emailAssetUrl(branding, branding.logoUrl)}" alt="${name}" width="40" height="40" style="display: block; margin: 0 auto; object-fit: contain;" />`
      : escapeEmailHtml(initials.toUpperCase()),
  }
}
export function createTenantBranding({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  async function loadTenantBranding(
    context: TenantContext,
    db?: Prisma.TransactionClient
  ): Promise<EmailBranding> {
    if (!db)
      return withTenantTransaction(context, (tx) =>
        loadTenantBranding(context, tx)
      )
    const organization = await db.organization.findUnique({
      where: { id: context.tenantId },
      select: { name: true, status: true },
    })
    const setting = await db.setting.findFirst({
      where: { tenantId: context.tenantId },
      orderBy: { createdAt: 'asc' },
      select: {
        publicBaseUrl: true,
        companyIconUrl: true,
        logoSecondary: true,
        contactEmail: true,
        companyPhone: true,
        companyAddress: true,
      },
    })
    if (
      !organization ||
      organization.status !== 'ACTIVE' ||
      !setting?.publicBaseUrl
    )
      throw new TenantBrandingError(
        'Configure a URL pública de email para a locadora ativa'
      )
    const branding: EmailBranding = {
      name: organization.name,
      publicBaseUrl: setting.publicBaseUrl,
      logoUrl: setting.companyIconUrl || setting.logoSecondary || null,
      contactEmail: setting.contactEmail || null,
      phone: setting.companyPhone || null,
      address: setting.companyAddress || null,
    }
    normalizeEmailBranding(branding)
    return branding
  }

  return { loadTenantBranding }
}
