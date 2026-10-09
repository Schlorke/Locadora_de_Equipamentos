import { CalculateQuoteLateFeeSchema as Input } from '@gb-locacoes/contracts/quotations'
import { requireTenantPermission } from '../../../../../../host/permissions'
import { calculateQuoteLateFee } from '../../../../../../host/quotations'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireTenantPermission(request, 'QUOTES', 'READ')
    if (!access.ok) return access.response
    const body = Input.safeParse(await request.json().catch(() => null))
    if (!body.success)
      return Response.json(
        { error: 'Dados de cálculo inválidos' },
        { status: 400 }
      )
    const { id } = await params
    const result = await calculateQuoteLateFee(access.principal, id, body.data)
    if (result.outcome === 'not_found')
      return Response.json(
        { error: 'Orçamento não encontrado' },
        { status: 404 }
      )
    if (result.outcome === 'missing_end_date')
      return Response.json(
        { error: 'Orçamento não possui data de término definida' },
        { status: 400 }
      )
    return Response.json(
      {
        lateFee: result.lateFee,
        daysLate: result.daysLate,
        calculationMethod: result.calculationMethod,
        config: result.config,
        baseValue: result.baseValue,
        endDate: result.endDate,
        calculationDate: result.calculationDate,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return Response.json(
      { error: 'Erro ao calcular multa por atraso' },
      { status: 500 }
    )
  }
}
