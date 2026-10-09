/**
 * Cartão público de uma locadora (`GET /api/public/tenants/{slug}`).
 * Contrato: `PublicTenantCardSchema` em `@gb-locacoes/contracts/directory`.
 *
 * Só nome, cidade, UF e logo. Nunca CNPJ (`document`), telefone, e-mail ou
 * CEP: a leitura seleciona apenas os campos do cartão e o resultado passa pelo
 * schema estrito, que recusa qualquer chave extra. O logo vem de `Setting`,
 * dado da própria locadora, e por isso é lido em `withTenantTransaction`.
 */
import type { PrismaClient } from '@prisma/client'
import {
  PublicTenantCardSchema,
  type PublicTenantCard,
} from '@gb-locacoes/contracts/directory'
import { withTenantTransaction } from '../identity/index'

/** Locadora já resolvida pelo adaptador (slug válido, organização ACTIVE). */
export type TenantCardSubject = { tenantId: string; slug: string }

const NAME_MAX = 200
const CITY_MAX = 120
const LOGO_MAX = 2048

function text(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function state(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase()
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : null
}

/** Só URL absoluta em https, sem credenciais; qualquer outra forma vira `null`. */
function logoUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed || trimmed.length > LOGO_MAX) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null
  return PublicTenantCardSchema.shape.logoUrl.safeParse(trimmed).success
    ? trimmed
    : null
}

/**
 * Monta o cartão público. Devolve `null` quando a organização deixou de estar
 * ACTIVE, mudou de slug ou não tem nome publicável; o adaptador responde com o
 * mesmo 404 neutro de locadora inexistente.
 */
export async function readPublicTenantCard(
  prisma: PrismaClient,
  tenant: TenantCardSubject
): Promise<PublicTenantCard | null> {
  const row = await withTenantTransaction(
    prisma,
    { tenantId: tenant.tenantId },
    async (tx) => {
      const organization = await tx.organization.findUnique({
        where: { id: tenant.tenantId },
        select: {
          slug: true,
          name: true,
          city: true,
          state: true,
          status: true,
        },
      })
      if (!organization) return null
      const setting = await tx.setting.findFirst({
        where: { tenantId: tenant.tenantId },
        select: { companyIconUrl: true },
      })
      return { organization, logo: setting?.companyIconUrl ?? null }
    }
  )
  if (
    !row ||
    row.organization.status !== 'ACTIVE' ||
    row.organization.slug !== tenant.slug
  )
    return null
  const card = PublicTenantCardSchema.safeParse({
    slug: row.organization.slug,
    name: text(row.organization.name, NAME_MAX),
    city: text(row.organization.city, CITY_MAX),
    state: state(row.organization.state),
    logoUrl: logoUrl(row.logo),
  })
  return card.success ? card.data : null
}
