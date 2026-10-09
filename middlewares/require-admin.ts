import { type Role } from '@prisma/client'
import { headers } from 'next/headers'
import { resolveTenantPrincipal, type TenantPrincipal } from '@/lib/tenant'
import { hasPermission, type Action, type Module } from '@/lib/permissions'
import {
  AccessErrorSchema,
  type AccessError,
} from '@gb-locacoes/contracts/entitlements'
import type { MutationRequest } from '@gb-locacoes/backend/identity'

type AuthSuccess = {
  success: true
  user: {
    id: string
    role: Role
    tenantId: string
    name?: string | null
    email?: string | null
  }
  principal: TenantPrincipal
  tenantId: string
}
type AuthError = {
  success: false
  error: string
  status: number
  body?: AccessError
  headers?: Headers
}
type AuthResult = AuthSuccess | AuthError
/** A recusa do principal (401, 403 do guard de mesma origem, 404...) no formato dos helpers. */
async function denied(response: Response): Promise<AuthError> {
  const body = await response.json()
  const accessError = AccessErrorSchema.safeParse(body)
  return {
    success: false,
    error: body.error || 'Acesso negado',
    status: response.status,
    ...(accessError.success ? { body: accessError.data } : {}),
    ...(response.headers.get('Cache-Control') === 'private, no-store'
      ? { headers: new Headers(response.headers) }
      : {}),
  }
}
/**
 * HTTP callers forward the original request, including its method, URL and
 * body. Calls without an HTTP request retain the headers-only fallback with
 * method/url null; they cannot classify a subscription operation when on.
 * Both paths reach the same-origin guard before the session is read.
 */
async function principal(request?: MutationRequest): Promise<AuthResult> {
  const current = await headers()
  const access = await resolveTenantPrincipal(
    request ?? {
      method: null,
      url: null,
      headers: current,
    }
  )
  if (!access.ok) return denied(access.response)
  return {
    success: true,
    principal: access.principal,
    tenantId: access.principal.tenantId,
    user: {
      id: access.principal.userId,
      role: access.principal.role,
      tenantId: access.principal.tenantId,
    },
  }
}
export async function requireRoles(
  roles: Role[],
  request?: MutationRequest
): Promise<AuthResult> {
  const access = await principal(request)
  if (!access.success) return access
  if (!roles.includes(access.user.role))
    return { success: false, error: 'Acesso negado', status: 403 }
  return access
}
export async function requirePermission(
  module: Module,
  action: Action,
  request?: MutationRequest
): Promise<AuthResult> {
  const access = await principal(request)
  if (!access.success) return access
  if (
    access.user.role === 'CLIENT' ||
    !(await hasPermission(access.principal, access.user.role, module, action))
  )
    return { success: false, error: 'Acesso negado', status: 403 }
  return access
}
export async function requireAdmin(request?: MutationRequest) {
  return requireRoles(['ADMIN'], request)
}
export async function requireAdminOrOperator(request?: MutationRequest) {
  return requireRoles(['ADMIN', 'OPERATOR'], request)
}
export async function requireFinancialAccess(request?: MutationRequest) {
  return requireRoles(['ADMIN', 'FINANCIAL'], request)
}
