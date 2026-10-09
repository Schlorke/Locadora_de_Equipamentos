import type { TenantContext } from '@gb-locacoes/contracts'
import { selectedTenantCookie } from './tenant-preference'

type OrganizationSelectionRead = {
  status: 200 | 400
  body: { selection: TenantContext | null } | { error: string }
  clearCookie?: boolean
}

/** Read preference after authentication, without implicit choice or persisted role. */
export async function readOrganizationSelection(
  request: Pick<Request, 'headers'>,
  userId: string,
  findMembership: (
    _userId: string,
    _tenantId: string
  ) => Promise<TenantContext | null>
): Promise<OrganizationSelectionRead> {
  let cookie: string | null
  try {
    cookie = selectedTenantCookie(request)
  } catch {
    return {
      status: 400,
      body: { error: 'Invalid tenant selection' },
      clearCookie: true,
    }
  }
  const header = request.headers.get('x-tenant-id')
  if (cookie !== null && header !== null && cookie !== header)
    return { status: 400, body: { error: 'Conflicting tenant selection' } }
  const tenantId = header ?? cookie
  if (tenantId === null) return { status: 200, body: { selection: null } }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(tenantId))
    return { status: 400, body: { error: 'Invalid tenant selection' } }
  const selection = await findMembership(userId, tenantId)
  return selection
    ? { status: 200, body: { selection } }
    : { status: 200, body: { selection: null }, clearCookie: true }
}
