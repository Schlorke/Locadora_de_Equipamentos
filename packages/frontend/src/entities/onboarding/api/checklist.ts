import {
  OnboardingStatusResponseSchema,
  type OnboardingStatusResponse,
} from '@gb-locacoes/contracts/onboarding'
import type { HttpClient, HttpJsonResponse } from '../../../shared/api'

export type ChecklistProblem = 'session' | 'owner' | 'selection' | 'unavailable'
export class ChecklistReadError extends Error {
  constructor(readonly problem: ChecklistProblem) {
    super('Não foi possível consultar os primeiros passos.')
  }
}
export async function readOnboardingChecklist(
  client: HttpClient,
  signal?: AbortSignal
): Promise<OnboardingStatusResponse | null> {
  const response = await client.request<HttpJsonResponse<unknown>>(
    '/api/onboarding/status',
    { responseType: 'json-response', signal }
  )
  if (response.status === 401) throw new ChecklistReadError('session')
  if (response.status === 403) {
    const code =
      response.data &&
      typeof response.data === 'object' &&
      'code' in response.data
        ? response.data.code
        : null
    throw new ChecklistReadError(
      ['APP_HOST_REQUIRED', 'ORIGIN_NOT_ALLOWED'].includes(String(code))
        ? 'unavailable'
        : 'owner'
    )
  }
  if (
    response.status === 404 &&
    response.data &&
    typeof response.data === 'object' &&
    'code' in response.data &&
    response.data.code === 'SUBSCRIPTION_NOT_FOUND'
  )
    return null
  if (
    response.status === 409 &&
    response.data &&
    typeof response.data === 'object' &&
    'code' in response.data &&
    response.data.code === 'TENANT_REQUIRED'
  )
    throw new ChecklistReadError('selection')
  const parsed = OnboardingStatusResponseSchema.safeParse(response.data)
  if (!response.ok || !parsed.success)
    throw new ChecklistReadError('unavailable')
  return parsed.data
}
