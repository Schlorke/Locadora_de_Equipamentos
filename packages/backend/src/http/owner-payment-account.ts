import { PLATFORM_EDGE_HEADERS } from '@gb-locacoes/contracts/platform'
import type { TenantPrincipal } from '../modules/identity/index'
import { createOwnerPaymentAccountReader } from '../modules/payment-accounts/index'
import { OwnerSubscriptionReadError } from '../modules/subscriptions/index'
import {
  onboardingAppOrigin,
  onboardingReply,
  onboardingFailure,
} from './onboarding'

export function createOwnerPaymentAccountHandler(
  ports: Parameters<typeof createOwnerPaymentAccountReader>[0] & {
    environment(): Readonly<Record<string, string | undefined>>
  }
) {
  const read = createOwnerPaymentAccountReader(ports)
  return async (request: Request, principal: TenantPrincipal) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method))
        return onboardingReply({ error: 'Método não permitido.' }, 405, {
          Allow: 'GET, HEAD',
        })
      if (
        request.headers.has('Origin') ||
        request.headers.has('Sec-Fetch-Site') ||
        PLATFORM_EDGE_HEADERS.some((header) => request.headers.has(header))
      )
        onboardingAppOrigin(request, ports.environment())
      if (new URL(request.url).search)
        return onboardingReply({ error: 'Consulta inválida.' }, 400)
      return onboardingReply(await read(principal))
    } catch (error) {
      if (error instanceof OwnerSubscriptionReadError)
        return onboardingReply(
          {
            error: 'Esta consulta é exclusiva do dono da locadora.',
            code: error.code,
          },
          error.status
        )
      const response = onboardingFailure(error)
      return response.status === 503
        ? onboardingReply(
            { error: 'Não foi possível consultar a conta de recebimentos.' },
            503
          )
        : response
    }
  }
}
