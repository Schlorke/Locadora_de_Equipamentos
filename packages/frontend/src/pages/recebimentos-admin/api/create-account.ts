import {
  CreatePaymentAccountInputSchema,
  CreatePaymentAccountResponseSchema,
} from '@gb-locacoes/contracts/payment-account'
import {
  isAbortError,
  type HttpClient,
  type HttpJsonResponse,
} from '../../../shared/api'

export type ReceivingCreateProblem =
  | 'input'
  | 'reauthentication'
  | 'session'
  | 'subscription'
  | 'plan'
  | 'email'
  | 'owner'
  | 'archived'
  | 'selection'
  | 'document'
  | 'changed'
  | 'payment'
  | 'notice'
  | 'existing'
  | 'unavailable'
  | 'rate'
  | 'uncertain'

export class ReceivingCreateError extends Error {
  constructor(readonly problem: ReceivingCreateProblem) {
    super('Não foi possível confirmar o pedido da conta de recebimentos.')
  }
}

const CONFLICTS: Record<string, ReceivingCreateProblem> = {
  TENANT_REQUIRED: 'selection',
  DOCUMENT_IN_USE: 'document',
  COMPANY_DATA_CHANGED: 'changed',
  FIRST_PAYMENT_REQUIRED: 'payment',
  PAYMENTS_NOTICE_REQUIRED: 'notice',
  PAYMENT_ACCOUNT_ALREADY_EXISTS: 'existing',
  PAYMENT_INTEGRATION_ALREADY_EXISTS: 'existing',
  PAYMENT_ACCOUNT_CREATION_UNAVAILABLE: 'unavailable',
}

/**
 * The owner's request (`POST /api/admin/payment-account/create`): validated by the shared contract before sending,
 * sent once in the private body and accepted only with the strict receipt. Any unconfirmed outcome is "uncertain".
 */
export async function requestReceivingAccount(
  client: HttpClient,
  values: {
    incomeValue: string
    mobilePhone: string
    companyDataVersion: string
  }
): Promise<void> {
  const input = CreatePaymentAccountInputSchema.safeParse({
    ...values,
    companyDataConfirmed: true,
  })
  if (!input.success) throw new ReceivingCreateError('input')
  const response = await client
    .request<HttpJsonResponse<unknown>>('/api/admin/payment-account/create', {
      method: 'POST',
      body: JSON.stringify(input.data),
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      responseType: 'json-response',
    })
    .catch((error) => {
      if (isAbortError(error))
        throw Object.assign(new Error('Solicitação encerrada.'), {
          name: 'AbortError',
        })
      throw new ReceivingCreateError('uncertain')
    })
  const code =
    response.data &&
    typeof response.data === 'object' &&
    'code' in response.data &&
    typeof response.data.code === 'string'
      ? response.data.code
      : null
  let problem: ReceivingCreateProblem | null = null
  if (response.status === 401)
    problem = code === 'FRESH_SESSION_REQUIRED' ? 'reauthentication' : 'session'
  else if (response.status === 402)
    problem = code === 'MODULE_NOT_IN_PLAN' ? 'plan' : 'subscription'
  else if (response.status === 403)
    problem =
      code === 'EMAIL_NOT_VERIFIED'
        ? 'email'
        : code === 'TENANT_ARCHIVED'
          ? 'archived'
          : 'owner'
  else if (response.status === 409)
    problem =
      code && Object.hasOwn(CONFLICTS, code) ? CONFLICTS[code]! : 'changed'
  else if (response.status === 400) problem = 'input'
  else if (response.status === 429) problem = 'rate'
  else if (
    !response.ok ||
    response.status !== 202 ||
    !CreatePaymentAccountResponseSchema.safeParse(response.data).success
  )
    problem = 'uncertain'
  if (problem) throw new ReceivingCreateError(problem)
}
