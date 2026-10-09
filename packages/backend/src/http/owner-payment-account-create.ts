import { PLATFORM_EDGE_HEADERS } from '@gb-locacoes/contracts/platform'
import {
  CreatePaymentAccountInputSchema,
  CreatePaymentAccountResponseSchema,
  PaymentAccountCreationOfferSchema,
} from '@gb-locacoes/contracts/payment-account'
import {
  isFreshAuthentication,
  type TenantPrincipal,
} from '../modules/identity/index'
import {
  OwnerSubaccountRequestError,
  type createOwnerSubaccountRequest,
} from '../modules/payment-accounts/index'
import {
  onboardingAppOrigin,
  onboardingFailure,
  onboardingReply,
  readOnboardingBody,
} from './onboarding'

/**
 * GET/HEAD: the owner's creation offer. POST: the creation request (exact panel origin, fresh session, strict
 * body). The body (declared income and mobile phone) is never echoed, logged or returned.
 */
export function createOwnerPaymentAccountCreateHandler(ports: {
  environment(): Readonly<Record<string, string | undefined>>
  getSession(): Promise<{
    user?: { id?: string }
    authenticatedAt?: number
  } | null>
  creation: ReturnType<typeof createOwnerSubaccountRequest>
  now?: () => Date
}) {
  return async (request: Request, principal: TenantPrincipal) => {
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
          PaymentAccountCreationOfferSchema.parse(
            await ports.creation.offer(principal)
          )
        )
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
      const input = CreatePaymentAccountInputSchema.safeParse(
        await readOnboardingBody(request)
      )
      if (!input.success)
        return onboardingReply(
          {
            error: 'Confira os dados informados.',
            code: 'INVALID_INPUT',
          },
          400
        )
      return onboardingReply(
        CreatePaymentAccountResponseSchema.parse(
          await ports.creation.request(
            principal,
            input.data,
            session.authenticatedAt!
          )
        ),
        202
      )
    } catch (error) {
      if (error instanceof OwnerSubaccountRequestError)
        return onboardingReply(
          {
            error: 'Não foi possível pedir a conta de recebimentos.',
            code: error.code,
          },
          error.status
        )
      const failure = onboardingFailure(error)
      return failure.status === 503
        ? onboardingReply(
            {
              error:
                'Não foi possível consultar a criação da conta de recebimentos.',
            },
            503
          )
        : failure
    }
  }
}
