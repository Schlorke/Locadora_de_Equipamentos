import { RentalMutationError } from '@gb-locacoes/backend/rentals'
import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../host/private-identity'
import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
import { hideClientQuote, readClientQuote } from '../../../../host/portal'

// GET - Buscar detalhes de um orçamento específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const quote = await readClientQuote(access.principal, id)
    if (!quote) {
      return NextResponse.json(
        { error: 'Orçamento não encontrado' },
        { status: 404 }
      )
    }
    return NextResponse.json(quote)
  } catch {
    console.error('Client portal operation failed')
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// DELETE - Remover orçamento do histórico do cliente (soft delete, não afeta o admin)
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
    if (!(await hideClientQuote(access.principal, id))) {
      return NextResponse.json(
        { error: 'Orçamento não encontrado ou não autorizado' },
        { status: 404 }
      )
    }
    return NextResponse.json({
      message: 'Orçamento removido do histórico com sucesso',
    })
  } catch (error) {
    if (error instanceof RentalMutationError && error.policy)
      return NextResponse.json(error.policy, {
        status: error.status,
        headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Host' },
      })
    console.error('Client portal operation failed')
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
