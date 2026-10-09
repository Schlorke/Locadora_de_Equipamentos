import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { successResponse } from '@gb-locacoes/backend/http'
import { checkRateLimit, strictRateLimit } from '../../../host/rate-limit'
import { ContactSchema } from '@gb-locacoes/contracts/quotations'
import { resolvePublicRequestTenant } from '../../../host/runtime'
import { isTrustedMutationOrigin } from '../../../host/mutation-origin'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'
import { createContactRequest } from '../../../host/contact-request'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
/**
 * Contato persistido; entrega da mensagem enfileirada.
 * @description tenantSlug obrigatório identifica a locadora ativa. Dados inválidos retornam 400 somente após validar a locadora. Itens devem pertencer à mesma locadora. Resposta de sucesso não confirma envio de e-mail.
 * @tag Contact
 * @requestBody PublicContactRequest required
 * @response 202: PublicContactAccepted: Contato persistido; entrega da mensagem enfileirada
 * @response 400:PublicApiError: Dados inválidos
 * @response 404:PublicApiError: Locadora ou recurso não encontrado
 * @response 409:PublicApiError: Locadora não selecionada ou conflito de negócio
 * @openapi
 */
export async function POST(request: NextRequest) {
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
    const input = ContactSchema.parse(body)
    const quote = await createContactRequest(context, input)
    return successResponse(
      { messageId: quote.id, deliveryStatus: 'queued' },
      202,
      'Solicitação recebida! Entraremos em contato em até 2 horas úteis.'
    )
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Dados inválidos' },
        { status: 400 }
      )
    if (error instanceof RentalMutationError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      )
    console.error('Contact request failed')
    return NextResponse.json(
      { error: 'Erro ao salvar solicitação' },
      { status: 500 }
    )
  }
}
