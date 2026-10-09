import { PLATFORM_EDGE_HEADERS } from '@gb-locacoes/contracts/platform'
import {
  AccountRecoveryResponseSchema,
  RequestAccountRecoveryInputSchema,
  RequestAccountRecoveryResponseSchema,
} from '@gb-locacoes/contracts/payment-account'
import {
  isFreshAuthentication,
  type TenantPrincipal,
} from '../modules/identity/index'
import {
  OwnerAccountRecoveryError,
  type createOwnerAccountRecovery,
} from '../modules/payment-accounts/index'
import {
  onboardingAppOrigin,
  onboardingReply,
  onboardingFailure,
  readOnboardingBody,
} from './onboarding'

export function createOwnerAccountRecoveryHandler(ports: {
  environment(): Readonly<Record<string, string | undefined>>
  getSession(): Promise<{
    user?: { id?: string }
    authenticatedAt?: number
  } | null>
  recovery: ReturnType<typeof createOwnerAccountRecovery>
  now?: () => Date
}) {
  return async (request: Request, actor: TenantPrincipal) => {
    try {
      if (!['GET', 'HEAD', 'POST'].includes(request.method))
        return onboardingReply({ error: 'Método não permitido.' }, 405, {
          Allow: 'GET, HEAD, POST',
        })
      if (
        request.method === 'POST' ||
        request.headers.has('Origin') ||
        request.headers.has('Sec-Fetch-Site') ||
        PLATFORM_EDGE_HEADERS.some((header) => request.headers.has(header))
      )
        onboardingAppOrigin(request, ports.environment())
      if (new URL(request.url).search)
        return onboardingReply({ error: 'Consulta inválida.' }, 400)
      if (request.method !== 'POST')
        return onboardingReply(
          AccountRecoveryResponseSchema.parse(await ports.recovery.read(actor))
        )
      const session = await ports.getSession()
      if (
        session?.user?.id !== actor.userId ||
        !isFreshAuthentication(
          session.authenticatedAt,
          (ports.now ?? (() => new Date()))()
        )
      )
        return onboardingReply(
          {
            error: 'Entre novamente para confirmar esta ação.',
            code: 'FRESH_SESSION_REQUIRED',
          },
          401
        )
      if (
        !RequestAccountRecoveryInputSchema.safeParse(
          await readOnboardingBody(request)
        ).success
      )
        return onboardingReply(
          {
            error: 'Confirme o pedido de conferência.',
            code: 'INVALID_CONFIRMATION',
          },
          400
        )
      return onboardingReply(
        RequestAccountRecoveryResponseSchema.parse(
          await ports.recovery.request(actor, session.authenticatedAt!)
        ),
        202
      )
    } catch (error) {
      if (error instanceof OwnerAccountRecoveryError)
        return onboardingReply(
          {
            error: 'Não foi possível confirmar a conferência dos recebimentos.',
            code: error.code,
          },
          error.status
        )
      const failure = onboardingFailure(error)
      return failure.status === 503
        ? onboardingReply(
            {
              error:
                'Não foi possível consultar a recuperação dos recebimentos.',
            },
            503
          )
        : failure
    }
  }
}
