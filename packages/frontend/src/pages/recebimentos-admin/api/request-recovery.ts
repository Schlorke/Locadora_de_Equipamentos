import {
  RequestAccountRecoveryInputSchema,
  RequestAccountRecoveryResponseSchema,
} from '@gb-locacoes/contracts/payment-account'
import {
  isAbortError,
  type HttpClient,
  type HttpJsonResponse,
} from '../../../shared/api'

export class ReceivingRecoveryError extends Error {
  constructor(
    readonly problem:
      'reauthentication' | 'session' | 'owner' | 'review' | 'uncertain'
  ) {
    super('Não foi possível confirmar o pedido de conferência.')
  }
}
export async function requestReceivingRecovery(client: HttpClient) {
  const response = await client
    .request<HttpJsonResponse<unknown>>('/api/admin/payment-account/recovery', {
      method: 'POST',
      cache: 'no-store',
      responseType: 'json-response',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        RequestAccountRecoveryInputSchema.parse({ confirmation: true })
      ),
    })
    .catch((error) => {
      if (isAbortError(error)) throw error
      throw new ReceivingRecoveryError('uncertain')
    })
  const code =
    response.data &&
    typeof response.data === 'object' &&
    'code' in response.data
      ? response.data.code
      : null
  if (response.status === 401)
    throw new ReceivingRecoveryError(
      code === 'FRESH_SESSION_REQUIRED' ? 'reauthentication' : 'session'
    )
  if (response.status === 403) throw new ReceivingRecoveryError('owner')
  if (response.status === 409) throw new ReceivingRecoveryError('review')
  if (
    !response.ok ||
    response.status !== 202 ||
    !RequestAccountRecoveryResponseSchema.safeParse(response.data).success
  )
    throw new ReceivingRecoveryError('uncertain')
}
