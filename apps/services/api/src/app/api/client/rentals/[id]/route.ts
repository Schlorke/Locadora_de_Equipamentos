import { RentalMutationError } from '@gb-locacoes/backend/rentals'
import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../../host/private-identity'
import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
import { hideClientRental, readClientRental } from '../../../../../host/portal'

// GET - Obter detalhes de uma locação específica do cliente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const rental = await readClientRental(access.principal, id)
    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 })
    }
    return NextResponse.json({ rental })
  } catch {
    console.error('Client portal operation failed')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Remover locação do histórico do cliente
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const crossOrigin = rejectCrossOriginMutation(request)
    if (crossOrigin) return crossOrigin
    if (!(await hideClientRental(access.principal, id))) {
      return NextResponse.json(
        { error: 'Rental not found or unauthorized' },
        { status: 404 }
      )
    }
    return NextResponse.json({
      message: 'Locação removida do histórico com sucesso',
    })
  } catch (error) {
    if (error instanceof RentalMutationError && error.policy)
      return NextResponse.json(error.policy, {
        status: error.status,
        headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Host' },
      })
    console.error('Client portal operation failed')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
