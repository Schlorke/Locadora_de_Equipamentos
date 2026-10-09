import { readAdminQuote } from '../../../../../host/portal'
import { type NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../../host/private-identity'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'
import {
  checkRateLimit,
  adminApiRateLimit,
} from '../../../../../host/rate-limit'
import {
  deleteQuote,
  QuoteUpdateRejected,
  updateQuote,
} from '../../../../../host/quotations'
// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    // Verificar autenticação de admin ou operator
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const principal = access.principal
    if (!['ADMIN', 'OPERATOR'].includes(principal.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const quote = await readAdminQuote(principal, params.id)

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    return NextResponse.json(quote)
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof RentalMutationError)
      return NextResponse.json(error.policy ?? { error: error.message }, {
        status: error.status,
        ...(error.policy
          ? {
              headers: {
                'Cache-Control': 'private, no-store',
                Vary: 'Cookie, Host',
              },
            }
          : {}),
      })
    console.error('Error fetching quote:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  // Rate limiting: 200 requests per minute for admin operations
  const rateLimitCheck = checkRateLimit(request, adminApiRateLimit)
  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response
  }

  const params = await props.params
  try {
    // Verificar autenticação de admin ou operator
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const principal = access.principal
    if (!['ADMIN', 'OPERATOR'].includes(principal.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    return NextResponse.json(await updateQuote(principal, params.id, body))
  } catch (error) {
    if (error instanceof QuoteUpdateRejected)
      return NextResponse.json(error.body, { status: error.status })
    if (error instanceof Response) return error
    // Recusa de conciliação traz o código (ex.: PAYMENT_ADJUSTMENT_REQUIRES_RECONCILIATION), como a rota de reajustes.
    if (error instanceof RentalMutationError)
      return NextResponse.json(
        error.policy ??
          (error.code === 'invalid_rental'
            ? { error: error.message }
            : { error: error.message, code: error.code }),
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
    console.error('Error updating quote:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    // DELETE requer apenas ADMIN (nao OPERATOR)
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const principal = access.principal
    if (!['ADMIN'].includes(principal.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await deleteQuote(principal, params.id)

    return NextResponse.json({ message: 'Quote deleted successfully' })
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof RentalMutationError)
      return NextResponse.json(error.policy ?? { error: error.message }, {
        status: error.status,
        ...(error.policy
          ? {
              headers: {
                'Cache-Control': 'private, no-store',
                Vary: 'Cookie, Host',
              },
            }
          : {}),
      })
    console.error('Error deleting quote:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
