import {
  PaymentAccountResponseSchema,
  type PaymentAccountResponse,
} from '@gb-locacoes/contracts/payment-account'
import type { HttpClient, HttpJsonResponse } from '../../../shared/api'

export type ReceivingReadProblem =
  'session' | 'selection' | 'owner' | 'archived' | 'unavailable'
export class ReceivingReadError extends Error {
  constructor(readonly problem: ReceivingReadProblem) {
    super('Não foi possível consultar os recebimentos.')
  }
}
export async function readReceivingAccount(
  client: HttpClient
): Promise<PaymentAccountResponse> {
  const response = await client.request<HttpJsonResponse<unknown>>(
    '/api/admin/payment-account',
    { responseType: 'json-response', cache: 'no-store' }
  )
  const code =
    response.data &&
    typeof response.data === 'object' &&
    'code' in response.data
      ? response.data.code
      : null
  if (!response.ok) {
    if (response.status === 401) throw new ReceivingReadError('session')
    if (response.status === 409 && code === 'TENANT_REQUIRED')
      throw new ReceivingReadError('selection')
    if (response.status === 403)
      throw new ReceivingReadError(
        code === 'TENANT_ARCHIVED' ? 'archived' : 'owner'
      )
    throw new ReceivingReadError('unavailable')
  }
  const result = PaymentAccountResponseSchema.safeParse(response.data)
  if (!result.success) throw new ReceivingReadError('unavailable')
  return result.data
}
