import type { TenantPrincipal } from '../modules/identity/index'
import { createOnboardingStatusReader } from '../modules/onboarding/index'
import { OwnerSubscriptionReadError } from '../modules/subscriptions/index'
import { PLATFORM_EDGE_HEADERS } from '@gb-locacoes/contracts/platform'
import {
  onboardingAppOrigin,
  onboardingReply,
  onboardingFailure,
} from './onboarding'

export function createOnboardingStatusHandler(
  ports: Parameters<typeof createOnboardingStatusReader>[0] & {
    environment(): Readonly<Record<string, string | undefined>>
  }
) {
  const read = createOnboardingStatusReader(ports)
  return async (request: Request, principal: TenantPrincipal) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method))
        return onboardingReply({ error: 'Método não permitido.' }, 405, {
          Allow: 'GET, HEAD',
        })
      // Direct authenticated device reads use the same owner/RLS reader. Browser
      // metadata or any supplied edge still require the genuine app context.
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
          { error: 'Não foi possível consultar o cadastro.', code: error.code },
          error.status
        )
      return onboardingFailure(error)
    }
  }
}
