import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '@/lib/tenant'
import { z } from 'zod'
import { extendRental } from '@/lib/rental-lifecycle'
import { RentalMutationError } from '@/lib/rental-transaction'

import { AdminExtendRentalSchema as ExtendRentalSchema } from '@gb-locacoes/contracts/rentals'

// POST - Prorrogar locação
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const principal = access.principal
    if (principal.role !== 'ADMIN')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const paramsResolved = await params
    const body = await request.json()
    const { additionalDays, generateBoleto, boletoDueDate } =
      ExtendRentalSchema.parse(body)

    const result = await extendRental(principal, paramsResolved.id, {
      additionalDays,
      generateBoleto,
      boletoDueDate,
    })
    return NextResponse.json(
      { ...result, boletoPending: Boolean(result.paymentId && generateBoleto) },
      { status: result.paymentId && generateBoleto ? 202 : 200 }
    )
  } catch (error) {
    // Regra de negócio (estado, disponibilidade, posse): status e mensagem
    // do domínio, como nas rotas irmãs de check-in/check-out.
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error extending rental:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
