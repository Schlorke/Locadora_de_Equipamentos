import { normalizarCnpj, validarCnpj } from '@gb-locacoes/domain/documento'
import {
  BillingProviderError,
  createAsaasHttpClient,
  type AsaasHttpClientConfig,
} from './asaas-http'
import {
  parseAsaasAccountStatus,
  type AsaasAccountStatus,
} from './asaas-events'

export type AsaasConnectedAccount = {
  document: string
  status: AsaasAccountStatus
}

/** Read-only proof of the authenticated company's identity; no account/key/webhook creation. */
export async function readAsaasConnectedAccount(
  config: AsaasHttpClientConfig
): Promise<AsaasConnectedAccount> {
  const http = createAsaasHttpClient(config)
  const body = await http.request({
    method: 'GET',
    path: '/myAccount/commercialInfo/',
  })
  const document = (body as { cpfCnpj?: unknown } | null)?.cpfCnpj
  if (typeof document !== 'string' || !validarCnpj(document))
    throw new BillingProviderError('INVALID_RESPONSE', {
      reason: 'UNEXPECTED_SHAPE',
    })
  const status = parseAsaasAccountStatus(
    await http.request({ method: 'GET', path: '/myAccount/status/' })
  )
  return { document: normalizarCnpj(document), status }
}
