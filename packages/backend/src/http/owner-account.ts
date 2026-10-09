import {
  OwnerRegistrationSchema,
  OwnerAccountResponseSchema,
  type OwnerRegistrationInput,
} from '@gb-locacoes/contracts/credentials'
import { OnboardingError } from '../modules/onboarding/index'
import {
  onboardingAppOrigin,
  onboardingFailure,
  onboardingReply,
  readOnboardingBody,
} from './onboarding'

type Account = { id: string; email: string; authEmailVerified: boolean }
export function createOwnerAccountHandlers(ports: {
  environment(): Readonly<Record<string, string | undefined>>
  checkSignup(): Promise<void>
  refuseAttempt(request: Request, email: string): Promise<Response | null>
  verifyRegistration(
    input: OwnerRegistrationInput,
    request: Request,
    origin: string
  ): Promise<void>
  register(input: OwnerRegistrationInput, request: Request): Promise<void>
  read(userId: string): Promise<Account | null>
  consumeResend(email: string): Promise<boolean>
  resend(email: string, request: Request): Promise<void>
}) {
  async function entry(request: Request, method: string) {
    const origin = onboardingAppOrigin(request, ports.environment())
    if (
      request.method !== method &&
      !(method === 'GET' && request.method === 'HEAD')
    )
      throw new OnboardingError(400, 'ONBOARDING_INPUT_INVALID')
    if (new URL(request.url).search)
      throw new OnboardingError(400, 'ONBOARDING_INPUT_INVALID')
    if (
      ports.environment().AUTH_CREDENTIAL_WRITES_PAUSED === 'true' &&
      method === 'POST'
    )
      throw new OnboardingError(503, 'CREDENTIAL_MAINTENANCE')
    await ports.checkSignup()
    return origin
  }
  const received = () =>
    onboardingReply(
      { message: 'Pedido recebido. Confira seu e-mail para continuar.' },
      202,
      { 'Retry-After': '60' }
    )
  return {
    async register(request: Request) {
      try {
        const origin = await entry(request, 'POST')
        const input = OwnerRegistrationSchema.safeParse(
          await readOnboardingBody(request)
        )
        if (!input.success)
          throw new OnboardingError(400, 'ONBOARDING_INPUT_INVALID')
        const refused = await ports.refuseAttempt(request, input.data.email)
        if (refused) {
          const headers = new Headers(refused.headers)
          headers.set('Cache-Control', 'private, no-store')
          headers.set(
            'Vary',
            [headers.get('Vary'), 'Cookie', 'Host'].filter(Boolean).join(', ')
          )
          return new Response(refused.body, { status: refused.status, headers })
        }
        await ports.verifyRegistration(input.data, request, origin)
        await ports.register(input.data, request)
        return received()
      } catch (error) {
        return onboardingFailure(error)
      }
    },
    async read(request: Request, userId: string) {
      try {
        await entry(request, 'GET')
        const account = await ports.read(userId)
        if (!account || account.id !== userId)
          throw new OnboardingError(401, 'AUTHENTICATION_REQUIRED')
        return onboardingReply(
          OwnerAccountResponseSchema.parse({
            userId: account.id,
            emailVerified: account.authEmailVerified,
          })
        )
      } catch (error) {
        return onboardingFailure(error)
      }
    },
    async resend(request: Request, userId: string) {
      try {
        await entry(request, 'POST')
        const body = await readOnboardingBody(request)
        if (
          !body ||
          typeof body !== 'object' ||
          Array.isArray(body) ||
          Object.keys(body).length
        )
          throw new OnboardingError(400, 'ONBOARDING_INPUT_INVALID')
        const account = await ports.read(userId)
        if (!account || account.id !== userId)
          throw new OnboardingError(401, 'AUTHENTICATION_REQUIRED')
        if (
          !account.authEmailVerified &&
          (await ports.consumeResend(account.email))
        )
          await ports.resend(account.email, request)
        return received()
      } catch (error) {
        return onboardingFailure(error)
      }
    },
  }
}
