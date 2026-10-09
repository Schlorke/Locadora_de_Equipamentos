import {
  PaymentAccountCreationOfferSchema,
  type PaymentAccountCreationOffer,
} from '@gb-locacoes/contracts/payment-account'
import type { HttpClient, HttpJsonResponse } from '../../../shared/api'

/**
 * Creation offer of the receiving account (`GET /api/admin/payment-account/create`). Only the strict contract is
 * accepted; any refusal, failure or unexpected body means "no creation offered" and the page stays as it was.
 */
export async function readCreationOffer(
  client: HttpClient
): Promise<PaymentAccountCreationOffer | null> {
  const response = await client.request<HttpJsonResponse<unknown>>(
    '/api/admin/payment-account/create',
    { responseType: 'json-response', cache: 'no-store' }
  )
  if (!response.ok || response.status !== 200) return null
  const offer = PaymentAccountCreationOfferSchema.safeParse(response.data)
  return offer.success ? offer.data : null
}
