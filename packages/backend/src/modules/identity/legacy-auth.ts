import { createHmac, timingSafeEqual } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { NextAuthOptions, Session, User } from 'next-auth'
import type {} from './legacy-auth-types.d.ts'
import CredentialsProvider from 'next-auth/providers/credentials'
import FacebookProvider from 'next-auth/providers/facebook'
import GoogleProvider from 'next-auth/providers/google'
import {
  findLegacyAccountsByEmail,
  normalizeEmail,
  verifyLegacyCredential,
  type LegacySignInGuard,
} from './legacy-credentials'

/** Fixed codes exposed by NextAuth; original causes never enter the callback URL. */
const SIGN_IN_RATE_LIMITED = 'RateLimited'
export const SIGN_IN_UNAVAILABLE = 'AuthUnavailable'

/** Existing NextAuth adapter; hosts supply storage, attempt budgets and environment. */
export function createLegacyAuthentication(dependencies: {
  getDatabase(): Promise<PrismaClient>
  signInAttempts(): LegacySignInGuard
  environment(): Record<string, string | undefined>
  now?: () => Date
  limiterFailureFields(_error: unknown): {
    error: string
    code?: string
    detail?: string
  }
}) {
  const {
    getDatabase: getPrisma,
    signInAttempts,
    environment,
    limiterFailureFields,
  } = dependencies
  const findAccountsByEmail = async (email: string) =>
    findLegacyAccountsByEmail(await getPrisma(), email)

  type CredentialUser = User & { credentialVersion: string }

  /**
   * Short HMAC of the persisted password hash. Any password change rotates it,
   * so JWTs issued before a reset stop resolving. The hash itself never enters
   * the token.
   */
  function legacyCredentialVersion(
    userId: string,
    passwordHash: string | null
  ): string {
    const secret = environment().NEXTAUTH_SECRET || environment().AUTH_SECRET
    if (!secret) throw new Error('NEXTAUTH_SECRET is required for sessions')
    return createHmac('sha256', secret)
      .update(`legacy-session-credential:v1\0${userId}\0${passwordHash ?? ''}`)
      .digest('base64url')
      .slice(0, 22)
  }

  async function storedCredentialVersion(
    userId: unknown
  ): Promise<string | null> {
    if (typeof userId !== 'string' || !userId) return null
    const prisma = await getPrisma()
    const stored = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    })
    return stored ? legacyCredentialVersion(stored.id, stored.password) : null
  }

  function sameCredentialVersion(current: string, presented: unknown): boolean {
    if (typeof presented !== 'string') return false
    const expected = Buffer.from(current)
    const received = Buffer.from(presented)
    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    )
  }

  // Helper function for debug logging
  const debugLog = (message: string, data?: unknown) => {
    // Only log in development and when explicitly enabled
    if (
      environment().NODE_ENV === 'development' &&
      environment().NEXTAUTH_DEBUG === 'true'
    ) {
      console.warn(`[AUTH DEBUG] ${message}`, data || '')
    }
  }

  const authOptions: NextAuthOptions = {
    providers: [
      GoogleProvider({
        clientId: environment().GOOGLE_CLIENT_ID!,
        clientSecret: environment().GOOGLE_CLIENT_SECRET!,
        authorization: {
          params: {
            prompt: 'consent',
            access_type: 'offline',
            response_type: 'code',
          },
        },
      }),
      FacebookProvider({
        clientId: environment().FACEBOOK_CLIENT_ID!,
        clientSecret: environment().FACEBOOK_CLIENT_SECRET!,
      }),
      CredentialsProvider({
        name: 'credentials',
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials, req) {
          debugLog('Iniciando autenticação')

          // The one verification path, also used by /api/auth/v2 during
          // coexistence: counted before the lookup, exact e-mail match, the
          // same bcrypt cost for unknown accounts. A limiter, configuration or
          // database failure refuses (fails closed) with a fixed code: NextAuth
          // would copy the original message into `?error=`.
          let verification: Awaited<ReturnType<typeof verifyLegacyCredential>>
          try {
            const guard = signInAttempts()
            verification = await verifyLegacyCredential(
              { db: await getPrisma(), guard },
              {
                email: credentials?.email,
                password: credentials?.password,
                ip: guard.clientIp(req?.headers),
              }
            )
          } catch (error) {
            console.error('[auth]', {
              event: 'sign_in_unavailable',
              ...limiterFailureFields(error),
            })
            // NextAuth reads only `message`; the cause stays on the server.
            throw new Error(SIGN_IN_UNAVAILABLE, { cause: error })
          }
          if (verification.status === 'rate-limited') {
            debugLog('Limite de tentativas atingido')
            throw new Error(SIGN_IN_RATE_LIMITED)
          }
          if (verification.status === 'unavailable') {
            // Lookup or bcrypt failed (logged by verifyLegacyCredential): an
            // outage, never "wrong password".
            throw new Error(SIGN_IN_UNAVAILABLE)
          }
          if (verification.status !== 'authenticated') {
            debugLog('Credenciais inválidas')
            return null
          }

          try {
            const user = verification.account
            debugLog('Autenticação bem-sucedida', {
              id: user.id,
              role: user.role,
            })

            const authenticated: CredentialUser = {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              // Bound to the exact hash bcrypt just verified.
              credentialVersion: legacyCredentialVersion(
                user.id,
                user.password
              ),
            }
            return authenticated
          } catch (error) {
            console.error('💥 [AUTH] Erro:', error)
            return null
          }
        },
      }),
    ],
    session: {
      strategy: 'jwt',
      maxAge: 24 * 60 * 60,
    },
    callbacks: {
      async jwt({ token, user, account, profile }) {
        // Primeira vez que o usuário faz login
        if (user) {
          token.id = user.id
          token.role = user.role
        }

        // Para OAuth (Google/Facebook), criar ou atualizar usuário no banco
        if (account && profile && user) {
          try {
            const prisma = await getPrisma()
            const normalizedEmail = user.email ? normalizeEmail(user.email) : ''

            if (normalizedEmail) {
              // Verificar se usuário já existe (igualdade exata, sem curingas)
              const matches = await findAccountsByEmail(normalizedEmail)
              if (matches.length > 1)
                throw new Error('OAuth e-mail matches more than one account')
              const existingUser = matches[0]

              if (existingUser) {
                // Atualizar informações do usuário existente
                await prisma.user.update({
                  where: { id: existingUser.id },
                  data: {
                    name: user.name || existingUser.name,
                    image: user.image || existingUser.image,
                    // Não sobrescrever role se já existir
                    role: existingUser.role || 'CLIENT',
                  },
                })
                token.id = existingUser.id
                token.role = existingUser.role || 'CLIENT'
              } else {
                // Criar novo usuário
                const newUser = await prisma.user.create({
                  data: {
                    email: normalizedEmail,
                    name: user.name || '',
                    image: user.image || null,
                    role: 'CLIENT', // Usuários OAuth são sempre CLIENT por padrão
                    // Campos opcionais para OAuth (podem ser preenchidos depois)
                    phone: null,
                    cpf: null,
                    cnpj: null,
                  },
                })
                token.id = newUser.id
                token.role = newUser.role
              }
            }
          } catch (error) {
            console.error('Erro ao processar login OAuth:', error)
          }
        }

        if (user) {
          // Only a real sign-in has user+account. JWT refresh/update never advances authentication time.
          if (account)
            token.authenticatedAt = (
              dependencies.now?.() ?? new Date()
            ).getTime()
          const issued = (user as Partial<CredentialUser>).credentialVersion
          token.credentialVersion =
            account?.type === 'credentials' && typeof issued === 'string'
              ? issued
              : undefined
        }

        // Every session resolution re-reads the stored credential.
        let current: string | null
        try {
          current = await storedCredentialVersion(token.id)
        } catch (error) {
          console.error(
            '[AUTH] Credencial da sessão indisponível:',
            error instanceof Error ? error.name : 'unknown'
          )
          // Deny this resolution without revoking the cookie on a storage failure.
          token.credentialCheck = 'unavailable'
          return token
        }
        delete token.credentialCheck
        if (current && user && account?.type !== 'credentials')
          token.credentialVersion = current
        if (
          !current ||
          !sameCredentialVersion(current, token.credentialVersion)
        )
          // NextAuth clears the session cookie and resolves no session.
          throw new Error('SessionCredentialRevoked')

        return token
      },
      async session({ session, token }) {
        if (token.credentialCheck === 'unavailable') {
          // An empty payload makes getServerSession and /api/auth/session return no session.
          return {} as Session
        }
        if (session.user) {
          session.user.id = token.id as string
          session.user.role = token.role as
            'ADMIN' | 'FINANCIAL' | 'OPERATOR' | 'CLIENT'
        }
        delete session.authenticatedAt
        if (
          typeof token.authenticatedAt === 'number' &&
          Number.isSafeInteger(token.authenticatedAt)
        )
          session.authenticatedAt = token.authenticatedAt
        return session
      },
      async signIn({ account }) {
        // Permitir login para todos os usuários
        // A lógica de criação/atualização está no callback jwt

        // Para OAuth (Google/Facebook), verificar role e redirecionar
        if (
          account?.provider === 'google' ||
          account?.provider === 'facebook'
        ) {
          // O role será definido no callback jwt, então retornamos true
          // O redirecionamento será feito com base no callbackUrl
          return true
        }

        return true
      },
      async redirect({ url, baseUrl }) {
        try {
          const destination = new URL(url, baseUrl)
          return destination.origin === new URL(baseUrl).origin
            ? destination.toString()
            : baseUrl
        } catch {
          return baseUrl
        }
      },
    },
    pages: {
      signIn: '/login',
    },
    secret: environment().NEXTAUTH_SECRET,
    debug: false, // Disabled to prevent warnings
  }

  return { authOptions, findAccountsByEmail }
}
