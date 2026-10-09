import {
  createQuoteDocuments,
  createOficioQueries,
} from '@gb-locacoes/backend/documents'
import { quotePdfResponse } from '@gb-locacoes/backend/http'
import { resolveTenantPrincipal, withTenantTransaction } from '@/lib/tenant'
import { requireTenantPermission } from '@/lib/tenant-permissions'
export const { readOficioQuote, readOficioPayment } = createOficioQueries({
  withTenantTransaction,
})
export async function downloadQuoteDocument(
  request: Request,
  quoteId: string,
  audience: 'admin' | 'client',
  adjustments = false
) {
  try {
    const access =
      audience === 'admin'
        ? await requireTenantPermission(request, 'QUOTES', 'READ')
        : await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const result = await createQuoteDocuments({
      withTenantTransaction,
    }).generateQuoteDocument(access.principal, quoteId, audience, adjustments)
    if ('error' in result)
      return Response.json({ error: result.error }, { status: result.status })
    return quotePdfResponse(result.buffer, result.title, result.identifier)
  } catch {
    return Response.json(
      { error: 'Não foi possível gerar o documento do orçamento' },
      { status: 500 }
    )
  }
}
