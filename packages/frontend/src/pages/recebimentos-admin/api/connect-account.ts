import {
  ConnectAsaasAccountInputSchema,
  ConnectAsaasAccountResponseSchema,
} from '@gb-locacoes/contracts/payment-account'
import {
  isAbortError,
  type HttpClient,
  type HttpJsonResponse,
} from '../../../shared/api'

export type ReceivingConnectProblem =
  | 'key'
  | 'rejected'
  | 'environment'
  | 'reauthentication'
  | 'session'
  | 'email'
  | 'owner'
  | 'archived'
  | 'selection'
  | 'company'
  | 'document'
  | 'changed'
  | 'existing'
  | 'rate'
  | 'uncertain'

export class ReceivingConnectError extends Error {
  constructor(readonly problem: ReceivingConnectProblem) {
    super('Não foi possível confirmar a conexão da conta de recebimentos.')
  }
}

/** The credential is sent once, in the private body; only the strict receipt is accepted. */
export async function connectReceivingAccount(
  client: HttpClient,
  apiKey: string
): Promise<void> {
  const input = ConnectAsaasAccountInputSchema.safeParse({ apiKey })
  if (!input.success) throw new ReceivingConnectError('key')
  const response = await client
    .request<HttpJsonResponse<unknown>>('/api/admin/payment-account/connect', {
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
      throw new ReceivingConnectError('uncertain')
    })
  const code =
    response.data &&
    typeof response.data === 'object' &&
    'code' in response.data
      ? response.data.code
      : null
  let problem: ReceivingConnectProblem | null = null
  if (response.status === 401)
    problem = code === 'FRESH_SESSION_REQUIRED' ? 'reauthentication' : 'session'
  else if (response.status === 403)
    problem =
      code === 'EMAIL_NOT_VERIFIED'
        ? 'email'
        : code === 'TENANT_ARCHIVED'
          ? 'archived'
          : 'owner'
  else if (response.status === 409)
    problem =
      code === 'TENANT_REQUIRED'
        ? 'selection'
        : code === 'INVALID_CNPJ'
          ? 'company'
          : code === 'ACCOUNT_DOCUMENT_MISMATCH'
            ? 'document'
            : code === 'PAYMENT_ACCOUNT_ALREADY_EXISTS' ||
                code === 'PAYMENT_INTEGRATION_ALREADY_EXISTS'
              ? 'existing'
              : 'changed'
  else if (response.status === 400)
    problem =
      code === 'INVALID_API_KEY'
        ? 'key'
        : code === 'CREDENTIAL_REJECTED'
          ? 'rejected'
          : code === 'CREDENTIAL_ENVIRONMENT_CONFLICT'
            ? 'environment'
            : 'uncertain'
  else if (response.status === 429) problem = 'rate'
  else if (
    !response.ok ||
    response.status !== 202 ||
    !ConnectAsaasAccountResponseSchema.safeParse(response.data).success
  )
    problem = 'uncertain'
  if (problem) throw new ReceivingConnectError(problem)
}
