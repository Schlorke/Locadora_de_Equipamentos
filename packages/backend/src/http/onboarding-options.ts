import { OnboardingOptionsResponseSchema } from '@gb-locacoes/contracts/onboarding'
import {
  onboardingAppOrigin,
  onboardingReply,
  onboardingFailure,
} from './onboarding'

/** Anonymous read before account creation; genuine app context still bounds the published configuration. */
export function createOnboardingOptionsHandler(ports: {
  environment(): Readonly<Record<string, string | undefined>>
  read(): Promise<unknown>
}) {
  return async (request: Request) => {
    if (!['GET', 'HEAD'].includes(request.method))
      return onboardingReply({ error: 'Método não permitido.' }, 405, {
        Allow: 'GET, HEAD',
      })
    try {
      onboardingAppOrigin(request, ports.environment())
      if (new URL(request.url).search)
        return onboardingReply({ error: 'Consulta inválida.' }, 400)
      return onboardingReply(
        OnboardingOptionsResponseSchema.parse(await ports.read())
      )
    } catch (error) {
      return onboardingFailure(error)
    }
  }
}
