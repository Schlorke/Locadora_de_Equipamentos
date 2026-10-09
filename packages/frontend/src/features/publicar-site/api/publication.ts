import { SitePublicationResponseSchema } from '@gb-locacoes/contracts/onboarding'
import type { HttpClient, HttpJsonResponse } from '../../../shared/api'

export type PublicationProblem =
  | 'session'
  | 'owner'
  | 'email'
  | 'subscription'
  | 'equipment'
  | 'selection'
  | 'origin'
  | 'uncertain'
export class SitePublicationError extends Error {
  constructor(readonly problem: PublicationProblem) {
    super('Não foi possível confirmar a publicação.')
  }
}
export async function requestSitePublication(client: HttpClient) {
  const response = await client.request<HttpJsonResponse<unknown>>(
    '/api/admin/site/publish',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      responseType: 'json-response',
    }
  )
  const code =
    response.data &&
    typeof response.data === 'object' &&
    'code' in response.data
      ? response.data.code
      : null
  if (response.status === 401) throw new SitePublicationError('session')
  if (response.status === 402 || code === 'TENANT_ARCHIVED')
    throw new SitePublicationError('subscription')
  if (
    response.status === 403 &&
    ['APP_HOST_REQUIRED', 'ORIGIN_NOT_ALLOWED'].includes(String(code))
  )
    throw new SitePublicationError('origin')
  if (response.status === 403)
    throw new SitePublicationError(
      code === 'EMAIL_NOT_VERIFIED' ? 'email' : 'owner'
    )
  if (response.status === 409 && code === 'TENANT_REQUIRED')
    throw new SitePublicationError('selection')
  if (response.status === 409 && code === 'FIRST_EQUIPMENT_REQUIRED')
    throw new SitePublicationError('equipment')
  const parsed = SitePublicationResponseSchema.safeParse(response.data)
  if (!response.ok || !parsed.success)
    throw new SitePublicationError('uncertain')
  return parsed.data
}
