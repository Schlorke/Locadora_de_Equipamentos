import {
  OwnerSubscriptionActionResponseSchema,
  OwnerSubscriptionCommandKeySchema,
  ReactivateSubscriptionInputSchema,
  type ReactivateSubscriptionInput,
} from '@gb-locacoes/contracts/subscription'
import type { HttpClient, HttpJsonResponse } from '../../../shared/api'

export type OwnerAction = 'activate' | 'cancel' | 'undo-cancel' | 'reactivate'
export type OwnerActionProblem =
  | 'reauthentication'
  | 'session'
  | 'owner'
  | 'selection'
  | 'changed'
  | 'profile'
  | 'legal'
  | 'configuration'
  | 'offer'
  | 'rate'
  | 'uncertain'
export class OwnerActionError extends Error {
  constructor(public readonly problem: OwnerActionProblem) {
    super('Não foi possível confirmar o pedido da assinatura.')
  }
}

/** O recibo confirma somente a transação local. O chamador relê o resumo. */
type OwnerActionRequest = {
  (
    client: HttpClient,
    action: Exclude<OwnerAction, 'reactivate'>,
    key: string
  ): Promise<void>
  (
    client: HttpClient,
    action: 'reactivate',
    key: string,
    input: ReactivateSubscriptionInput
  ): Promise<void>
}
export const requestOwnerAction: OwnerActionRequest = async (
  client: HttpClient,
  action: OwnerAction,
  key: string,
  input?: ReactivateSubscriptionInput
): Promise<void> => {
  const parsedKey = OwnerSubscriptionCommandKeySchema.safeParse(key)
  if (!parsedKey.success) throw new OwnerActionError('uncertain')
  const parsedInput =
    action === 'reactivate'
      ? ReactivateSubscriptionInputSchema.safeParse(input)
      : null
  if (parsedInput && !parsedInput.success) throw new OwnerActionError('offer')
  const response = await client.request<HttpJsonResponse<unknown>>(
    `/api/admin/subscription/${action}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': parsedKey.data,
      },
      body: parsedInput?.success ? JSON.stringify(parsedInput.data) : '{}',
      responseType: 'json-response',
    }
  )
  const code =
    response.data &&
    typeof response.data === 'object' &&
    'code' in response.data
      ? response.data.code
      : null
  if (response.status === 401)
    throw new OwnerActionError(
      code === 'FRESH_SESSION_REQUIRED' ? 'reauthentication' : 'session'
    )
  if (response.status === 403) throw new OwnerActionError('owner')
  if (response.status === 409) {
    const problem: OwnerActionProblem =
      code === 'TENANT_REQUIRED'
        ? 'selection'
        : code === 'BILLING_PROFILE_REQUIRED'
          ? 'profile'
          : code === 'LEGAL_ACCEPTANCE_REQUIRED'
            ? 'legal'
            : code === 'PLAN_NOT_AVAILABLE'
              ? 'offer'
              : code === 'PROVIDER_ENVIRONMENT_CONFLICT'
                ? 'configuration'
                : 'changed'
    throw new OwnerActionError(problem)
  }
  if (response.status === 404) throw new OwnerActionError('changed')
  if (response.status === 429) throw new OwnerActionError('rate')
  if (
    !response.ok ||
    !OwnerSubscriptionActionResponseSchema.safeParse(response.data).success
  )
    throw new OwnerActionError('uncertain')
}
