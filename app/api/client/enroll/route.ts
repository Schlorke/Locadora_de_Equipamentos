import { CustomerEnrollmentSchema as enrollSchema } from '@gb-locacoes/contracts/customer-enrollment'
import {
  createCustomerEnrollmentService,
  EnrollmentError,
} from '@gb-locacoes/backend/customers'
import { getServerSession } from '@/lib/application-session'
import { isTrustedMutationOrigin } from '@/lib/security/mutation-origin'
import { resolvePublicRequestTenant, withTenantTransaction } from '@/lib/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

const privateHeaders = {
  'Cache-Control': 'private, no-store',
  Vary: 'Cookie, Host',
}
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: privateHeaders })
// O mesmo 409 de /api/auth/organizations/current: um só contrato para "fora de
// host de locadora", decidido por `code`.
const tenantRequired = () =>
  reply(
    {
      error: 'Disponível somente no endereço da locadora',
      code: 'TENANT_REQUIRED',
    },
    409
  )

/**
 * A mesma requisição sem a query e sem o corpo: só a borda validada pode
 * indicar a locadora (o mesmo recorte de /api/auth/organizations/current).
 */
const hostOnly = (request: Request) => {
  const url = new URL(request.url)
  return new Request(url.origin + url.pathname, { headers: request.headers })
}

// Só o consentimento explícito. Papel, ids e dados de perfil nunca vêm do
// corpo (chave extra é 400, antes de ler ou gravar); `tenantSlug`, se vier,
// só pode repetir a locadora do host (senão 400 TENANT_CONFLICT).
// Composição: a transação por locadora vem de lib/tenant (identity + Prisma).
const enrollment = createCustomerEnrollmentService({
  withTenantTransaction: (context, operation) =>
    withTenantTransaction(context, operation),
})

/**
 * Vínculo do usuário logado como cliente da locadora do HOST
 * (docs/architecture/adr-tenant-hosts.md, D9 e Lote 6).
 *
 * - a locadora vem só da borda validada de um host de locadora; app, apex ou
 *   sem borda: 409 `TENANT_REQUIRED` (com `code`, `private, no-store` e
 *   `Vary: Cookie, Host`), decidido pela borda antes de ler o corpo ou o
 *   banco, seja qual for o `tenantSlug` enviado; `x-tenant-id` divergente: 400;
 * - cria `Membership(CLIENT)` e `ClientProfile` (201) ou devolve o vínculo
 *   ativo que já existe (200); nunca papel de equipe;
 * - vínculo suspenso ou revogado não é reativado (403).
 */
export async function POST(request: Request) {
  if (!isTrustedMutationOrigin(request))
    return reply({ error: 'Origem não permitida' }, 403)
  try {
    // Sem a query e sem o corpo, só um host de locadora produz um slug: fora
    // dele o resolvedor responde TENANT_REQUIRED sem consultar o banco, e o
    // corpo nem é lido (nenhum `tenantSlug` enviado muda a resposta).
    // Área do cliente: separada da vitrine, continua com o site em pausa (S13).
    const tenant = await resolvePublicRequestTenant(hostOnly(request), {
      surface: 'client-area',
    })
    if (!tenant.ok)
      return tenant.code === 'TENANT_REQUIRED'
        ? tenantRequired()
        : tenant.response
    if (tenant.edge?.hostKind !== 'tenant') return tenantRequired()
    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return reply({ error: 'Dados inválidos' }, 400)
    }
    const parsed = enrollSchema.safeParse(payload)
    if (!parsed.success)
      return reply(
        { error: 'Confirme o consentimento para vincular sua conta' },
        400
      )
    // O `tenantSlug` do corpo ou da query só pode repetir a locadora do host.
    if (
      parsed.data.tenantSlug !== undefined ||
      new URL(request.url).searchParams.has('tenantSlug')
    ) {
      const agreed = await resolvePublicRequestTenant(request, {
        bodySlug: parsed.data.tenantSlug,
        surface: 'client-area',
      })
      if (!agreed.ok) return agreed.response
    }
    const headerTenant = request.headers.get('x-tenant-id')
    if (headerTenant !== null && headerTenant !== tenant.context.tenantId)
      return reply(
        { error: 'Seleção de locadora conflitante', code: 'TENANT_CONFLICT' },
        400
      )
    const session = await getServerSession()
    const userId = session?.user?.id
    if (!userId) return reply({ error: 'Authentication required' }, 401)
    const result = await enrollment.enrollClient({
      tenantId: tenant.context.tenantId,
      userId,
      clientIp: tenant.edge.clientIp,
      userAgent: request.headers.get('user-agent'),
    })
    return reply(
      { membership: result.membership, created: result.created },
      result.created ? 201 : 200
    )
  } catch (error) {
    if (error instanceof EnrollmentError)
      return reply({ error: error.message, code: error.code }, error.status)
    console.error(
      'Erro ao vincular cliente à locadora do host:',
      error instanceof Error ? error.name : 'unknown'
    )
    return reply({ error: 'Vínculo indisponível no momento' }, 503)
  }
}
