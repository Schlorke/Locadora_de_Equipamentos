import { z } from 'zod'
import {
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@gb-locacoes/contracts/credentials'
import { identityMode } from '../modules/identity/configuration'
import { IDENTITY_MAX_PASSWORD_LENGTH } from '../modules/identity/factory'
import type { createCredentialAccounts } from '../modules/identity/credential-accounts'
import type { AccountFlowScope } from '../modules/identity/rate-limit'
export function createCredentialAccountHandlers(dependencies: {
  accounts: ReturnType<typeof createCredentialAccounts>
  refuseAuthAttempt(
    _scope: AccountFlowScope,
    _input: { headers: Headers; account: string },
    _message: string
  ): Promise<Response | null>
  handleIdentityRequest(_request: Request): Promise<Response>
}) {
  const { accounts, refuseAuthAttempt, handleIdentityRequest } = dependencies
  const failed = (error: unknown) =>
    error instanceof z.ZodError
      ? Response.json(
          { error: error.issues[0]?.message || 'Dados inválidos' },
          { status: 400 }
        )
      : Response.json({ error: 'Erro interno do servidor' }, { status: 500 })
  async function register(request: Request): Promise<Response> {
    try {
      const body = await request.json()
      const validatedData = registerSchema.parse(body)
      const refused = await refuseAuthAttempt(
        'register',
        { headers: request.headers, account: validatedData.email },
        'Muitas tentativas. Tente novamente mais tarde.'
      )
      if (refused) return refused
      if (
        identityMode(process.env) === 'better-auth' &&
        validatedData.password.length > IDENTITY_MAX_PASSWORD_LENGTH
      )
        return Response.json(
          {
            error:
              'Senha deve ter no máximo ' +
              IDENTITY_MAX_PASSWORD_LENGTH +
              ' caracteres',
          },
          { status: 400 }
        )
      await accounts.registerAccount(validatedData, request)
      return Response.json(
        {
          message:
            'Cadastro recebido. Se os dados puderem ser usados, você receberá um email para continuar.',
        },
        { status: 202 }
      )
    } catch (error) {
      return failed(error)
    }
  }
  async function forgotPassword(request: Request): Promise<Response> {
    try {
      const body = await request.json()
      const { email } = forgotPasswordSchema.parse(body)
      const refused = await refuseAuthAttempt(
        'password-reset',
        { headers: request.headers, account: email },
        'Muitas solicitações. Tente novamente mais tarde.'
      )
      if (refused) return refused
      await accounts.requestPasswordReset(email, request)
      return Response.json(
        {
          message:
            'Se o email existir, você receberá instruções de recuperação.',
        },
        { status: 200 }
      )
    } catch (error) {
      return failed(error)
    }
  }
  async function resetPassword(request: Request): Promise<Response> {
    try {
      const body = await request.json()
      const { token, password } = resetPasswordSchema.parse(body)
      const result = await accounts.resetPassword(token, password, request)
      return 'response' in result
        ? result.response
        : Response.json(result.body, { status: result.status })
    } catch (error) {
      return failed(error)
    }
  }
  async function verifyEmail(request: Request): Promise<Response> {
    if (identityMode(process.env) === 'better-auth')
      return handleIdentityRequest(request)
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    if (!token)
      return new Response(null, {
        status: 307,
        headers: {
          Location: new URL('/login?error=token-missing', request.url).href,
        },
      })
    try {
      const error = await accounts.verifyEmailToken(token)
      return new Response(null, {
        status: 307,
        headers: {
          Location: new URL(
            error ? '/login?error=token-expired' : '/login?verified=true',
            request.url
          ).href,
        },
      })
    } catch {
      return new Response(null, {
        status: 307,
        headers: {
          Location: new URL('/login?error=verification-failed', request.url)
            .href,
        },
      })
    }
  }
  return { register, forgotPassword, resetPassword, verifyEmail }
}
