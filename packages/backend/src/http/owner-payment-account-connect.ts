import {
  ConnectAsaasAccountInputSchema,
  ConnectAsaasAccountResponseSchema,
} from '@gb-locacoes/contracts/payment-account'
import {
  isFreshAuthentication,
  type TenantPrincipal,
} from '../modules/identity/index'
import {
  OwnerPaymentAccountConnectError,
  type createOwnerPaymentAccountConnection,
} from '../modules/payment-accounts/index'
import { BillingProviderError } from '../modules/billing/index'
import {
  onboardingAppOrigin,
  onboardingFailure,
  onboardingReply,
  readOnboardingBody,
} from './onboarding'

/** A credential is parsed once and never included in replies, errors or logging. */
export function createOwnerPaymentAccountConnectHandler(ports: {
  environment(): Readonly<Record<string, string | undefined>>
  getSession(): Promise<{
    user?: { id?: string }
    authenticatedAt?: number
  } | null>
  connect: ReturnType<typeof createOwnerPaymentAccountConnection>
  now?: () => Date
}) {
  return async (request: Request, principal: TenantPrincipal) => {
    try {
      if (request.method !== 'POST')
        return onboardingReply({ error: 'Método não permitido.' }, 405, {
          Allow: 'POST',
        })
      onboardingAppOrigin(request, ports.environment())
      if (new URL(request.url).search)
        return onboardingReply({ error: 'Consulta inválida.' }, 400)
      const session = await ports.getSession()
      if (
        session?.user?.id !== principal.userId ||
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
      const input = ConnectAsaasAccountInputSchema.safeParse(
        await readOnboardingBody(request)
      )
      if (!input.success)
        return onboardingReply(
          { error: 'Chave de API inválida.', code: 'INVALID_API_KEY' },
          400
        )
      const result = await ports.connect(principal, {
        ...input.data,
        authenticatedAt: session.authenticatedAt!,
      })
      return onboardingReply(
        ConnectAsaasAccountResponseSchema.parse(result),
        202
      )
    } catch (error) {
      if (error instanceof OwnerPaymentAccountConnectError)
        return onboardingReply(
          {
            error: 'Não foi possível conectar a conta de recebimentos.',
            code: error.code,
          },
          error.status
        )
      if (
        error instanceof BillingProviderError &&
        error.reason === 'AUTHENTICATION'
      )
        return onboardingReply(
          {
            error: 'A chave não foi aceita pela instituição de pagamentos.',
            code: 'CREDENTIAL_REJECTED',
          },
          400
        )
      const failure = onboardingFailure(error)
      return failure.status === 503
        ? onboardingReply(
            { error: 'Não foi possível conectar a conta de recebimentos.' },
            503
          )
        : failure
    }
  }
}
