import { NextResponse } from 'next/server'
import { requireTenantPermission } from '@/lib/tenant-permissions'
import { readFinancialRevenue } from '@/lib/financial-read'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
/**
 * @openapi
 * /api/admin/financial/revenue:
 *   get:
 *     tags: [Admin - Financial]
 *     summary: Dados de receita para gráficos
 *     description: |
 *       Retorna dados históricos de receita e receita por categoria.
 *
 *       **🔐 Endpoint Protegido** - Requer autenticação ADMIN ou FINANCIAL
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: months
 *         in: query
 *         description: Número de meses de histórico (padrão: 12)
 *         required: false
 *         schema:
 *           type: integer
 *           default: 12
 *     responses:
 *       200:
 *         description: Dados de receita
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Permissões insuficientes
 *       500:
 *         description: Erro interno do servidor
 */
export async function GET(request: Request) {
  try {
    const access = await requireTenantPermission(request, 'FINANCIAL', 'READ')
    if (!access.ok) return access.response
    const context = access.principal
    return NextResponse.json(
      await readFinancialRevenue(context, new URL(request.url).searchParams)
    )
  } catch (error) {
    console.error('Error fetching revenue data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
