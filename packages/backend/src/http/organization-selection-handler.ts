import type { TenantContext } from '@gb-locacoes/contracts'
import {
  readOrganizationSelection,
  selectedTenantPreferenceCookie,
} from '../modules/identity'
import { rejectExplicitCrossOrigin } from './explicit-origin'
import { organizationSelectionResponse as reply } from './organization-selection'

export function createOrganizationSelectionHandler(dependencies: {
  getServerSession(): Promise<{ user?: { id?: string } } | null>
  isTrustedMutationOrigin(_request: Request): boolean
  membership(_userId: string, _tenantId: string): Promise<TenantContext | null>
  secure(): boolean
}) {
  const { getServerSession, isTrustedMutationOrigin, membership } = dependencies
  const selectionCookie = (tenantId: string | null) =>
    selectedTenantPreferenceCookie(tenantId, dependencies.secure())
  return async function organizationSelection(
    request: Request,
    method: 'GET' | 'POST' | 'DELETE'
  ) {
    try {
      const session = await getServerSession()
      if (!session?.user?.id)
        return reply(
          { error: 'Authentication required' },
          401,
          selectionCookie(null)
        )
      if (method !== 'GET' && !isTrustedMutationOrigin(request))
        return reply({ error: 'Origin not allowed' }, 403)
      if (method === 'DELETE')
        return reply({ selection: null }, 200, selectionCookie(null))
      if (method === 'GET') {
        // Read without a cross-origin consumer (panel selector on `app`, native app): explicit foreign Origin is
        // refused after the session, before revalidating or clearing the preference (wave 133, finding 149).
        const crossOrigin = rejectExplicitCrossOrigin(request)
        if (crossOrigin) return crossOrigin
        const result = await readOrganizationSelection(
          request,
          session.user.id,
          membership
        )
        return reply(
          result.body,
          result.status,
          result.clearCookie ? selectionCookie(null) : undefined
        )
      }
      if (
        request.headers.get('content-type')?.split(';')[0]?.trim() !==
        'application/json'
      )
        return reply({ error: 'JSON body required' }, 415)
      const data: unknown = await request.json().catch(() => null)
      if (
        !data ||
        typeof data !== 'object' ||
        !('tenantId' in data) ||
        typeof data.tenantId !== 'string'
      )
        return reply({ error: 'Explicit tenant selection required' }, 400)
      const tenantId = data.tenantId
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(tenantId))
        return reply({ error: 'Invalid tenant selection' }, 400)
      const selection = await membership(session.user.id, tenantId)
      if (!selection) return reply({ error: 'Organization access denied' }, 403)
      return reply({ selection }, 200, selectionCookie(tenantId))
    } catch {
      return Response.json(
        { error: 'Organization selection unavailable' },
        {
          status: 503,
          headers: { 'Cache-Control': 'no-store', Vary: 'Cookie, x-tenant-id' },
        }
      )
    }
  }
}
