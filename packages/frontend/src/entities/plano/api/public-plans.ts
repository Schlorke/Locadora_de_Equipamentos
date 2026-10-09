import {
  PublicPlansResponseSchema,
  type PublicPlan,
} from '@gb-locacoes/contracts/subscription'
import type { HttpClient, HttpJsonResponse } from '../../../shared/api'

export async function readPublicMonthlyPlans(
  client: HttpClient
): Promise<PublicPlan[]> {
  const response = await client.request<HttpJsonResponse<unknown>>(
    '/api/public/plans',
    { responseType: 'json-response' }
  )
  const parsed = PublicPlansResponseSchema.safeParse(response.data)
  if (!response.ok || !parsed.success) throw new Error('Catálogo indisponível.')
  return parsed.data.plans.filter((plan) => plan.interval === 'MONTHLY')
}
