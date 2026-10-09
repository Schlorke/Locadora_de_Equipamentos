import { QuoteRequestSchema } from '@gb-locacoes/contracts/quotations'
import { NextResponse, type NextRequest } from 'next/server'
import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
import { ZodError } from 'zod'
import { getServerSession } from '../../../host/session'
import { resolvePublicRequestTenant } from '../../../host/runtime'
import { resolveTenantPrincipal } from '../../../host/private-identity'
import { isSameOriginMutation as isTrustedMutationOrigin } from '@gb-locacoes/backend/identity'
import { checkRateLimit, strictRateLimit } from '../../../host/rate-limit'
import { createQuoteRequest } from '../../../host/quotations'
import { listClientQuotes } from '../../../host/portal'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const principal = access.principal
    const transformedQuotes = await listClientQuotes(principal)

    // Resposta privada: nunca em cache compartilhado (desenho 4.5).
    return NextResponse.json(transformedQuotes, {
      headers: {
        'Cache-Control': 'private, no-store',
        Vary: 'Cookie, x-tenant-id',
      },
    })
  } catch (error) {
    console.error('Error fetching customer quotes:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar orçamentos' },
      { status: 500 }
    )
  }
}

/**
 * Orçamento persistido; notificação enfileirada.
 * @description tenantSlug obrigatório identifica a locadora ativa. Dados inválidos retornam 400 somente após validar a locadora. Itens devem pertencer à mesma locadora. Resposta de sucesso não confirma envio de e-mail.
 * @tag Quotes
 * @requestBody PublicQuoteRequest required
 * @response 201: PublicQuoteCreated: Orçamento persistido; notificação enfileirada
 * @response 400:PublicApiError: Dados inválidos
 * @response 404:PublicApiError: Locadora ou recurso não encontrado
 * @response 409:PublicApiError: Locadora não selecionada ou conflito de negócio
 * @openapi
 */
export async function POST(request: NextRequest) {
  // Mutação de navegador só da própria origem, antes de tudo (CSRF entre locadoras irmãs).
  const crossOrigin = rejectCrossOriginMutation(request)
  if (crossOrigin) return crossOrigin
  const rateLimit = checkRateLimit(request, strictRateLimit)
  if (!rateLimit.allowed) return rateLimit.response
  try {
    const body = await request.json()
    // Host de locadora: tenantSlug do corpo ou da query só repete o do host.
    const tenant = await resolvePublicRequestTenant(request, {
      bodySlug: body?.tenantSlug,
    })
    if (!tenant.ok) return tenant.response
    // Com borda, a origem do navegador precisa ser a do próprio host.
    if (tenant.edge && !isTrustedMutationOrigin(request))
      return NextResponse.json(
        { error: 'Origem não permitida' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      )
    const context = tenant.context
    const input = QuoteRequestSchema.parse(body)
    const session = await getServerSession()
    const quote = await createQuoteRequest(context, input, session?.user?.id)
    return NextResponse.json(quote, { status: 201 })
  } catch (error) {
    if (error instanceof RentalMutationError)
      return NextResponse.json(
        error.policy ?? { error: error.message, code: error.code },
        {
          status: error.status,
          ...(error.policy
            ? {
                headers: {
                  'Cache-Control': 'private, no-store',
                  Vary: 'Cookie, Host',
                },
              }
            : {}),
        }
      )
    if (error instanceof ZodError)
      return NextResponse.json(
        {
          error: error.issues[0]?.message || 'Dados inválidos',
          field: error.issues[0]?.path.join('.') || 'unknown',
        },
        { status: 400 }
      )
    console.error('Error creating quote:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
