import { NextResponse, type NextRequest } from 'next/server'

import { requireTenantPermission } from '../../../../../../../host/permissions'
import { readOficioPayment } from '../../../../../../../host/documents'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'
import { TenantBrandingError } from '@gb-locacoes/backend/communications'
import { mapPaymentToOficioData } from '../../../../../../../host/documents'
import { generateOficioPdf } from '@gb-locacoes/backend/documents'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireTenantPermission(request, 'FINANCIAL', 'READ')
    if (!access.ok) return access.response
    const context = access.principal

    const { id } = await params
    const preview = request.nextUrl.searchParams.get('preview') === 'true'

    const record = await readOficioPayment(context, id)

    if (!record) {
      return NextResponse.json(
        { error: 'Lançamento financeiro não encontrado' },
        { status: 404 }
      )
    }

    const payment = {
      ...record,
      quote: record.quote ?? record.rental?.quote ?? null,
    }

    // Validate minimum required data
    const errors: string[] = []
    const quoteCode =
      payment.quote?.quoteCode || payment.quote?.legacyExternalCode || null
    const clientName = payment.quote?.company || payment.quote?.name || null

    if (!quoteCode && !payment.quote) {
      errors.push('Código do orçamento é obrigatório')
    }
    if (!clientName) {
      errors.push('Nome ou razão social do cliente é obrigatório')
    }

    const grossAmount = Number(payment.grossAmount || payment.amount || 0)
    if (grossAmount <= 0) {
      errors.push('Valor bruto deve ser maior que zero')
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dados insuficientes para gerar ofício',
          details: errors,
        },
        { status: 422 }
      )
    }

    const data = await mapPaymentToOficioData(context, payment, preview)
    const pdfBuffer = await generateOficioPdf(data)

    const filename = `oficio-${(quoteCode || payment.id.slice(0, 8)).replace(/\s/g, '-')}-${data.cliente.mesReferencia}-${data.cliente.anoReferencia}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (
      error instanceof RentalMutationError ||
      error instanceof TenantBrandingError
    )
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      )
    console.error('Error generating ofício PDF:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar PDF do ofício' },
      { status: 500 }
    )
  }
}
