import { requireTenantPermission } from '../../../../../host/permissions'
import { readFinancialExport } from '../../../../../host/financial-read'
import {
  buildProfessionalPdf,
  buildXlsx,
  buildCsv,
} from '@gb-locacoes/backend/documents'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
export async function GET(request: Request) {
  try {
    const access = await requireTenantPermission(request, 'FINANCIAL', 'READ')
    if (!access.ok) return access.response
    const context = access.principal

    const { searchParams } = new URL(request.url)
    const format = (searchParams.get('format') || 'pdf').toLowerCase()

    if (!['pdf', 'xlsx', 'csv'].includes(format)) {
      return Response.json(
        { error: 'Formato não suportado. Use format=pdf, xlsx ou csv.' },
        { status: 400 }
      )
    }

    const { rows, ...meta } = await readFinancialExport(context, searchParams)

    if (format === 'xlsx') {
      const buffer = await buildXlsx(rows, meta)
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition':
            'attachment; filename="relatorio-financeiro.xlsx"',
          'Cache-Control': 'no-store',
        },
      })
    }

    if (format === 'csv') {
      const buffer = buildCsv(rows)
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition':
            'attachment; filename="relatorio-financeiro.csv"',
          'Cache-Control': 'no-store',
        },
      })
    }

    /* format === 'pdf' */
    const pdfBuffer = await buildProfessionalPdf(rows, meta)
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          'attachment; filename="relatorio-financeiro-oficio.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exporting financial report:', error)
    return Response.json(
      { error: 'Erro ao exportar relatório financeiro' },
      { status: 500 }
    )
  }
}
