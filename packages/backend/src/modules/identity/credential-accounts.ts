import { Prisma, type PrismaClient } from '@prisma/client'
import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { Resend } from 'resend'
import type { RegistrationInput } from '@gb-locacoes/contracts/credentials'
import type { OwnerRegistrationInput } from '@gb-locacoes/contracts/credentials'
import { withOwnerAccountRegistration } from './owner-signup-context'
import type { Identity } from './factory'
import type { LegacyAccount } from './legacy-credentials'
import type { AccountNoticeKind, AuthAttemptScope } from './rate-limit'
import { identityMode } from './configuration'
import { identitySubject } from './runtime'
import { escapeEmailHtml } from '../communications'
type CredentialResult =
  | { body: { error: string } | { message: string }; status: number }
  | { response: Response }
export function createCredentialAccounts(dependencies: {
  database(): PrismaClient
  getIdentity(): Promise<Identity>
  findAccountsByEmail(_email: string): Promise<LegacyAccount[]>
  resend: Pick<Resend, 'emails'> | null
  after(_task: () => Promise<void>): void
  consumeAccountNotice(
    _kind: AccountNoticeKind,
    _email: string
  ): Promise<boolean>
  resetAuthAccountAttempts(
    _scope: AuthAttemptScope,
    _email: string
  ): Promise<void>
}) {
  const {
    database,
    getIdentity,
    findAccountsByEmail,
    resend,
    after,
    consumeAccountNotice,
    resetAuthAccountAttempts,
  } = dependencies
  async function afterResponse(task: () => Promise<void>): Promise<void> {
    try {
      after(task)
    } catch {
      // Fora de uma requisição do Next (scripts e testes): envia agora.
      await task()
    }
  }
  function sendEmail(message: { to: string; subject: string; html: string }) {
    return async () => {
      try {
        await resend!.emails.send({ from: process.env.FROM_EMAIL!, ...message })
      } catch (emailError) {
        console.error('Erro ao enviar email:', emailError)
      }
    }
  }
  async function createIdentityAccount(
    data: RegistrationInput | OwnerRegistrationInput,
    request: Request,
    ownerCallback?: '/comecar'
  ): Promise<void> {
    try {
      const response = await (
        await getIdentity()
      ).api.signUpEmail({
        body: ownerCallback ? { ...data, callbackURL: ownerCallback } : data,
        headers: request.headers,
        request,
        asResponse: true,
      })
      if (!response.ok)
        console.error('[identity]', {
          event: 'registration_failed',
          status: response.status,
        })
    } catch (error) {
      console.error('[identity]', {
        event: 'registration_failed',
        error: error instanceof Error ? error.name : 'unknown',
      })
    }
  }
  async function registerAccount(
    validatedData: RegistrationInput,
    request: Request
  ): Promise<void> {
    if (identityMode(process.env) === 'better-auth') {
      await afterResponse(() => createIdentityAccount(validatedData, request))
      return
    }
    // Hash antes da busca: o custo do bcrypt não distingue conta existente.
    const hashedPassword = await bcrypt.hash(validatedData.password, 12)
    const appUrl = process.env.NEXTAUTH_URL
    const sendsEmail = process.env.NODE_ENV === 'production' && Boolean(resend)

    // Igualdade exata: '_' e '%' no e-mail não casam com outras contas.
    const holders = await findAccountsByEmail(validatedData.email)

    if (holders.length > 0) {
      // O titular é avisado no máximo uma vez por janela; a resposta HTTP não revela a conta.
      if (
        sendsEmail &&
        (await consumeAccountNotice(
          'registration-attempt',
          validatedData.email
        ))
      ) {
        await afterResponse(
          sendEmail({
            to: holders[0]!.email,
            subject: identitySubject('Tentativa de cadastro'),
            html: `
              <h1>Tentativa de cadastro</h1>
              <p>Recebemos um pedido de cadastro com este email, que já possui conta.</p>
              <p>Se foi você, entre com sua senha ou use a recuperação de senha na tela de login.</p>
              <p>Se você não fez este pedido, ignore este email.</p>
            `,
          })
        )
      }
      return
    }

    // Criar usuário e token de verificação juntos
    const prisma = database()
    const verificationToken = crypto.randomUUID()
    let user: { email: string }
    try {
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: validatedData.name,
            email: validatedData.email,
            password: hashedPassword,
            phone: validatedData.phone,
            cpf: validatedData.cpf,
            cnpj: validatedData.cnpj,
          },
          select: { email: true },
        })
        await tx.verificationToken.create({
          data: {
            identifier: `email-verification:${created.email}`,
            token: verificationToken,
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
          },
        })
        return created
      })
    } catch (error) {
      // Email, CPF ou CNPJ já usados (inclusive em corrida): não revelar qual.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        return
      throw error
    }

    // Enviar email de verificação (temporariamente desabilitado para desenvolvimento)
    if (sendsEmail) {
      await afterResponse(
        sendEmail({
          to: user.email,
          subject: identitySubject('Verifique seu email'),
          html: `
            <h1>Bem-vindo!</h1>
            <p>Clique no link abaixo para verificar seu email:</p>
            <a href="${escapeEmailHtml(`${appUrl}/api/auth/verify-email?token=${verificationToken}`)}">
              Verificar Email
            </a>
            <p>Este link expira em 24 horas.</p>
          `,
        })
      )
    }

    return
  }
  /** The same engine, deferred commit-safe mail and neutral result as the customer flow. */
  async function registerOwnerAccount(
    data: OwnerRegistrationInput,
    request: Request
  ): Promise<void> {
    if (identityMode(process.env) !== 'better-auth')
      throw new Error('OWNER_IDENTITY_REQUIRED')
    await afterResponse(() =>
      withOwnerAccountRegistration(data, () =>
        createIdentityAccount(data, request, '/comecar')
      )
    )
  }
  async function resendOwnerVerification(
    email: string,
    request: Request
  ): Promise<void> {
    if (identityMode(process.env) !== 'better-auth')
      throw new Error('OWNER_IDENTITY_REQUIRED')
    const headers = new Headers(request.headers)
    headers.delete('cookie')
    await afterResponse(async () => {
      try {
        const response = await (
          await getIdentity()
        ).api.sendVerificationEmail({
          body: { email, callbackURL: '/comecar' },
          headers,
          request,
          asResponse: true,
        })
        if (!response.ok)
          console.error('[identity]', {
            event: 'owner_verification_resend_failed',
            status: response.status,
          })
      } catch (error) {
        console.error('[identity]', {
          event: 'owner_verification_resend_failed',
          error: error instanceof Error ? error.name : 'unknown',
        })
      }
    })
  }
  async function issuePasswordReset(email: string, appUrl: string) {
    try {
      const accounts = await findAccountsByEmail(email)
      if (accounts.length !== 1) return
      const user = accounts[0]!
      // Orçamento silencioso por conta: sem novo link, o último enviado continua valendo.
      if (!(await consumeAccountNotice('password-reset', user.email))) return

      // O link carrega o token; o banco guarda apenas o SHA-256 dele.
      const resetToken = randomBytes(32).toString('base64url')
      const identifier = `password-reset:${user.email}`
      const prisma = database()
      await prisma.$transaction([
        // Só o link mais recente continua válido.
        prisma.verificationToken.deleteMany({ where: { identifier } }),
        prisma.verificationToken.create({
          data: {
            identifier,
            token: createHash('sha256').update(resetToken).digest('hex'),
            expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
          },
        }),
      ])

      const fromEmail = process.env.FROM_EMAIL
      const resetUrl = `${appUrl}/reset-password?token=${resetToken}`

      // Enviar email de recuperacao quando o Resend estiver configurado
      if (resend && fromEmail) {
        try {
          await resend.emails.send({
            from: fromEmail,
            to: user.email,
            // E-mail de identidade pertence à plataforma (platform.json), nunca a uma locadora.
            subject: identitySubject('Recuperação de senha'),
            html: `
            <h1>Recuperacao de senha</h1>
            <p>Clique no link abaixo para redefinir sua senha:</p>
            <a href="${escapeEmailHtml(resetUrl)}">
              Redefinir Senha
            </a>
            <p>Este link expira em 1 hora.</p>
            <p>Se voce nao solicitou esta recuperacao, ignore este email.</p>
          `,
          })
        } catch (emailError) {
          console.error('Erro ao enviar email:', emailError)
          // Continue mesmo se o email falhar
        }
      } else {
        console.warn(
          'Resend nao configurado ou FROM_EMAIL ausente - email nao enviado.'
        )
      }
    } catch (error) {
      console.error(
        'Erro ao emitir recuperação de senha:',
        error instanceof Error ? error.name : 'unknown'
      )
    }
  }
  async function requestIdentityPasswordReset(
    email: string,
    request: Request
  ): Promise<void> {
    try {
      if (!(await consumeAccountNotice('password-reset', email))) return
      const response = await (
        await getIdentity()
      ).api.requestPasswordReset({
        body: { email, redirectTo: '/reset-password' },
        headers: request.headers,
        request,
        asResponse: true,
      })
      if (!response.ok)
        console.error('[identity]', {
          event: 'password_reset_request_failed',
          status: response.status,
        })
    } catch (error) {
      console.error('[identity]', {
        event: 'password_reset_request_failed',
        error: error instanceof Error ? error.name : 'unknown',
      })
    }
  }
  async function requestPasswordReset(
    email: string,
    request: Request
  ): Promise<void> {
    await afterResponse(() =>
      identityMode(process.env) === 'better-auth'
        ? requestIdentityPasswordReset(email, request)
        : issuePasswordReset(
            email,
            process.env.NEXTAUTH_URL || new URL(request.url).origin
          )
    )
  }
  async function resetPassword(
    token: string,
    password: string,
    request: Request
  ): Promise<CredentialResult> {
    if (identityMode(process.env) === 'better-auth') {
      const response = await (
        await getIdentity()
      ).api.resetPassword({
        body: { token, newPassword: password },
        headers: request.headers,
        asResponse: true,
      })
      if (!response.ok) return { response }
      return { body: { message: 'Senha redefinida com sucesso' }, status: 200 }
    }
    const prisma = database()
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token: tokenHash },
    })
    if (
      !verificationToken ||
      !verificationToken.identifier.startsWith('password-reset:') ||
      verificationToken.expires < new Date()
    ) {
      return { body: { error: 'Token inválido ou expirado' }, status: 400 }
    }
    const user = await prisma.user.findUnique({
      where: {
        email: verificationToken.identifier.slice('password-reset:'.length),
      },
    })
    if (!user) {
      return { body: { error: 'Usuário não encontrado' }, status: 404 }
    }
    const hashedPassword = await bcrypt.hash(password, 12)
    const consumed = await prisma.$transaction(async (tx) => {
      const deleted = await tx.verificationToken.deleteMany({
        where: {
          token: tokenHash,
          identifier: verificationToken.identifier,
          expires: { gt: new Date() },
        },
      })
      if (deleted.count !== 1) return false
      // A nova senha invalida qualquer outro link de recuperação da conta.
      await tx.verificationToken.deleteMany({
        where: { identifier: verificationToken.identifier },
      })
      // Muda a versão de credencial dos JWTs legados emitidos antes da troca.
      await tx.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      })
      if (process.env.AUTH_V2_ENABLED === 'true')
        await tx.authSession.deleteMany({ where: { userId: user.id } })
      return true
    })
    if (!consumed)
      return { body: { error: 'Token inválido ou expirado' }, status: 400 }
    await resetAuthAccountAttempts('sign-in', user.email)
    return { body: { message: 'Senha redefinida com sucesso' }, status: 200 }
  }
  async function verifyEmailToken(
    token: string
  ): Promise<'token-expired' | null> {
    const prisma = database()
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    })
    if (
      !verificationToken ||
      !verificationToken.identifier.startsWith('email-verification:') ||
      verificationToken.expires < new Date()
    ) {
      return 'token-expired'
    }
    const consumed = await prisma.$transaction(async (tx) => {
      const deleted = await tx.verificationToken.deleteMany({
        where: {
          token,
          identifier: verificationToken.identifier,
          expires: { gt: new Date() },
        },
      })
      if (deleted.count !== 1) return false
      await tx.user.update({
        where: {
          email: verificationToken.identifier.slice(
            'email-verification:'.length
          ),
        },
        data: {
          emailVerified: new Date(),
          ...(process.env.AUTH_V2_ENABLED === 'true'
            ? { authEmailVerified: true }
            : {}),
        },
      })
      return true
    })
    if (!consumed) return 'token-expired'
    return null
  }
  return {
    registerAccount,
    registerOwnerAccount,
    resendOwnerVerification,
    requestPasswordReset,
    resetPassword,
    verifyEmailToken,
  }
}
