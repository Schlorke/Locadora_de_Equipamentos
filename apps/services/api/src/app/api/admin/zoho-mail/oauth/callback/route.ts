import { NextRequest } from 'next/server'
import { resolveTenantPrincipal } from '../../../../../../host/private-identity'
import { completeZohoOAuth } from '../../../../../../host/zoho-oauth'
import { zohoOAuthAuthorizationFailure } from '@gb-locacoes/backend/http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const roles = ['ADMIN', 'OPERATOR']
export async function GET(request: NextRequest) {
  const access = await resolveTenantPrincipal(request)
  if (!access.ok)
    return zohoOAuthAuthorizationFailure(
      request,
      access.error || 'Acesso negado'
    )
  if (!roles.includes(access.principal.role))
    return zohoOAuthAuthorizationFailure(request, 'Acesso negado')
  return completeZohoOAuth(access.principal, request)
}
