import { TENANT_COOKIE_NAME as SELECTED_TENANT_COOKIE } from '@gb-locacoes/contracts'
import type { MutationRequest } from './same-origin-mutation'

/** A preference only; the selected tenant still needs a current membership. */
export function selectedTenantCookie(
  request: Pick<MutationRequest, 'headers'>
): string | null {
  const values = (request.headers.get('cookie') || '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${SELECTED_TENANT_COOKIE}=`))
  if (values.length > 1) throw new Error('Ambiguous tenant cookie')
  const value = values[0]?.slice(SELECTED_TENANT_COOKIE.length + 1)
  return value === undefined ? null : decodeURIComponent(value)
}

export function selectedTenantPreferenceCookie(
  tenantId: string | null,
  secure: boolean
): string {
  return (
    SELECTED_TENANT_COOKIE +
    '=' +
    encodeURIComponent(tenantId ?? '') +
    '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' +
    (tenantId ? '2592000' : '0') +
    (secure ? '; Secure' : '')
  )
}
