import { NextResponse, type NextRequest } from 'next/server'

import { requireTenantPermission } from '@/lib/tenant-permissions'
import { readOficioQuote } from '@/lib/quote-document'
import { RentalMutationError } from '@/lib/rental-transaction'
import { TenantBrandingError } from '@/lib/email-branding'
import { mapQuoteToOficioData } from '@/lib/pdf/oficio-data-mapper'
import { generateOficioPdf } from '@/lib/pdf/oficio-generator'

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

    const quote = await readOficioQuote(context, id)

    if (!quote) {
      return NextResponse.json(
        { error: 'Orçamento não encontrado' },
        { status: 404 }
      )
    }

    // Validate minimum required data
    const errors: string[] = []
    const quoteCode = quote.quoteCode || quote.legacyExternalCode
    const clientName = quote.company || quote.name

    if (!quoteCode) {
      errors.push('Código do orçamento é obrigatório')
    }
    if (!clientName) {
      errors.push('Nome ou razão social do cliente é obrigatório')
    }

    const grossAmount = Number(quote.finalTotal || quote.total || 0)
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

    const data = await mapQuoteToOficioData(context, quote, preview)
    const pdfBuffer = await generateOficioPdf(data)

    const filename = `oficio-${(quoteCode || quote.id.slice(0, 8)).replace(/\s/g, '-')}-${data.cliente.mesReferencia}-${data.cliente.anoReferencia}.pdf`

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
