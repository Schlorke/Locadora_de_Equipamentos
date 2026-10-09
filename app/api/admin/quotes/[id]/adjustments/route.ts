import { CreateAdjustmentSchema } from '@gb-locacoes/contracts/quotations'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveTenantPrincipal } from '@/lib/tenant'
import { RentalMutationError } from '@/lib/rental-transaction'
import {
  createQuoteAdjustment,
  listQuoteAdjustments,
} from '@/lib/quote-request'

const roles = ['ADMIN', 'OPERATOR', 'FINANCIAL']
export const runtime = 'nodejs'
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await resolveTenantPrincipal(request)
  if (!access.ok) return access.response
  if (!roles.includes(access.principal.role))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  const { id } = await params
  const adjustments = await listQuoteAdjustments(access.principal, id)
  if (!adjustments)
    return NextResponse.json(
      { error: 'Orçamento não encontrado' },
      { status: 404 }
    )
  return NextResponse.json({ adjustments })
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const context = access.principal
    if (!roles.includes(context.role))
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    const { id } = await params
    const payload = CreateAdjustmentSchema.parse(await request.json())
    return NextResponse.json(
      await createQuoteAdjustment(context, id, payload),
      { status: 202 }
    )
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: error.issues[0]?.message || 'Dados inválidos',
          details: error.issues,
        },
        { status: 400 }
      )
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
    console.error('Quote adjustment failed')
    return NextResponse.json(
      { error: 'Erro ao criar reajuste' },
      { status: 500 }
    )
  }
}
