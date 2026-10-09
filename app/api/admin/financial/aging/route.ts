import { NextResponse, type NextRequest } from 'next/server'
import { requireTenantPermission } from '@/lib/tenant-permissions'
import { readFinancialAging } from '@/lib/financial-read'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
/**
 * @openapi
 * /api/admin/financial/aging:
 *   get:
 *     tags: [Admin - Financial]
 *     summary: Aging de contas a receber e maiores devedores
 *     description: |
 *       Retorna classificação de contas a receber por faixas de vencimento
 *       e lista dos maiores devedores.
 *
 *       **Endpoint Protegido** - Requer autenticação ADMIN ou FINANCIAL
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dados de aging e devedores
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Permissões insuficientes
 *       500:
 *         description: Erro interno do servidor
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireTenantPermission(request, 'FINANCIAL', 'READ')
    if (!access.ok) return access.response
    const context = access.principal
    return NextResponse.json(
      await readFinancialAging(context, new URL(request.url).searchParams)
    )
  } catch (error) {
    console.error('Error fetching aging data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
