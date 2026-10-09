import { ConvertQuoteSchema } from '@gb-locacoes/contracts/quotations'
import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../../../host/private-identity'
import { z } from 'zod'
import { convertQuoteToRental } from '../../../../../../host/quotations'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'

// POST - Converter orçamento em locação
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
    const validatedData = ConvertQuoteSchema.parse(body)

    const result = await convertQuoteToRental(principal, paramsResolved.id, {
      generateBoleto: false,
      boletoDueDate: validatedData.boletoDueDate,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
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

    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error'

    if (
      errorMessage.includes('não encontrado') ||
      errorMessage.includes('deve estar aprovado') ||
      errorMessage.includes('já foi convertido') ||
      errorMessage.includes('deve ter datas')
    ) {
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    console.error('Error converting quote to rental:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
