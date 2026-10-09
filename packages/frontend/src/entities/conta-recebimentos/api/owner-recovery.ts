import {
  AccountRecoveryResponseSchema,
  type AccountRecoveryView,
} from '@gb-locacoes/contracts/payment-account'
import type { HttpClient, HttpJsonResponse } from '../../../shared/api'
import { ReceivingReadError } from './owner-account'

export async function readReceivingRecovery(
  client: HttpClient
): Promise<AccountRecoveryView | null> {
  const response = await client.request<HttpJsonResponse<unknown>>(
    '/api/admin/payment-account/recovery',
    {
      method: 'GET',
      cache: 'no-store',
      responseType: 'json-response',
    }
  )
  if (response.status === 401) throw new ReceivingReadError('session')
  if (response.status === 403) throw new ReceivingReadError('owner')
  if (response.status === 409) throw new ReceivingReadError('selection')
  const result = AccountRecoveryResponseSchema.safeParse(response.data)
  if (!response.ok || response.status !== 200 || !result.success)
    throw new ReceivingReadError('unavailable')
  return result.data.recovery
}
