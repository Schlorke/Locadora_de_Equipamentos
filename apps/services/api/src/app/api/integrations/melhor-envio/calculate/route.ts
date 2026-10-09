import { resolveTenantPrincipal } from '../../../../../host/private-identity'
import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
import { calculateShipping } from '../../../../../host/shipping'
export async function POST(request: Request) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const crossOrigin = rejectCrossOriginMutation(request)
    if (crossOrigin) return crossOrigin
    return await calculateShipping(access.principal, request)
  } catch {
    return Response.json(
      { error: 'Não foi possível consultar o frete' },
      { status: 502 }
    )
  }
}
