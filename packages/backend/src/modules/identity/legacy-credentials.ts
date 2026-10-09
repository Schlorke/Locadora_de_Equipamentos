import type { Prisma, PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

/**
 * Credencial legada (bcrypt na coluna `users.password`): o ÚNICO caminho que
 * confere e-mail e senha, usado pelo login do NextAuth (`lib/auth.ts`) e pelo
 * login do Better Auth na coexistência (`/api/auth/v2`, `AUTH_MODE=legacy` com
 * `AUTH_V2_ENABLED=true`). Os dois pagam o mesmo endurecimento:
 * - a tentativa é contada ANTES de qualquer busca (mesma resposta para conta
 *   existente ou não) pelo limitador persistente de `lib/rate-limit.ts`;
 * - a conta é achada por igualdade exata do e-mail normalizado: `_` e `%`
 *   digitados nunca funcionam como curinga de ILIKE;
 * - conta inexistente, ambígua ou sem senha paga o mesmo bcrypt de uma senha
 *   errada.
 */

/** RFC 5321: limite de um endereço entregável. */
import { MAX_EMAIL_LENGTH } from '@gb-locacoes/contracts/credentials'

/**
 * Espera sugerida (`Retry-After`, em segundos) em todo 503 dos fluxos de
 * identidade quando a tentativa não pode ser contada nem conferida (limitador
 * sem segredo em produção, banco fora). 429 fica só para limite atingido.
 */
export const AUTH_UNAVAILABLE_RETRY_SECONDS = 60

/** E-mail canônico: chave das buscas, das janelas de tentativa e das linhas novas. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

const LEGACY_ACCOUNT_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  image: true,
  password: true,
  emailVerified: true,
} satisfies Prisma.UserSelect

export type LegacyAccount = Prisma.UserGetPayload<{
  select: typeof LEGACY_ACCOUNT_SELECT
}>

export type LegacyAccountDatabase = {
  user: Pick<PrismaClient['user'], 'findMany'>
}

/**
 * Contas cujo e-mail gravado é igual a `email` depois de normalizados os dois.
 * O Prisma traduz `mode: 'insensitive'` para ILIKE, então os metacaracteres do
 * LIKE são escapados e cada linha é conferida de novo aqui. Linhas gravadas
 * antes da normalização podem diferir só na caixa: voltam até duas linhas, e
 * duas é ambiguidade para quem chama.
 */
export async function findLegacyAccountsByEmail(
  db: LegacyAccountDatabase,
  email: string
): Promise<LegacyAccount[]> {
  const normalized = normalizeEmail(email)
  if (!normalized || normalized.length > MAX_EMAIL_LENGTH) return []
  const rows = await db.user.findMany({
    where: {
      email: {
        equals: normalized.replace(/[\\%_]/g, '\\$&'),
        mode: 'insensitive',
      },
    },
    select: LEGACY_ACCOUNT_SELECT,
    take: 2,
  })
  return rows.filter((row) => normalizeEmail(row.email) === normalized)
}

/**
 * bcrypt (custo 12, o das senhas gravadas) de um valor aleatório que ninguém
 * conhece. Comparado quando não há conta utilizável, para que um e-mail
 * inexistente demore o mesmo que uma senha errada.
 */
const UNKNOWN_ACCOUNT_HASH =
  '$2b$12$eivJbuGcYwHhK/kQyYqF3.eSHjzTeTNgC8S.5gquf1qmPuK2xV2oa'

export type LegacyHeaderSource =
  Headers | Readonly<Record<string, unknown>> | null | undefined

export type LegacySignInAttempt = { ip: string | null; account: string }

export type LegacySignInDecision = {
  allowed: boolean
  /** Fim da janela que recusou (ou da mais longa), em ms desde a época. */
  resetTime: number
  /** Espera antes de conferir a senha; nunca motivo de recusa. */
  delayMs: number
}

/**
 * Porta do limitador de login legado. A implementação vive na aplicação
 * (`legacySignInGuard` em `lib/rate-limit.ts`, janelas em
 * `platform_rate_limits`) e é a mesma para os dois logins.
 */
export type LegacySignInGuard = {
  /** IP do cliente vindo só de fonte confiável (borda validada, proxy declarado). */
  clientIp(_headers: LegacyHeaderSource): string | null
  /** Conta uma tentativa de forma atômica; falha de armazenamento rejeita. */
  consume(_attempt: LegacySignInAttempt): Promise<LegacySignInDecision>
  /** Senha provada: limpa a janela da conta e a deste cliente. */
  clear(_attempt: LegacySignInAttempt): Promise<void>
}

export type LegacyCredentialVerification =
  | { status: 'authenticated'; account: LegacyAccount & { password: string } }
  | { status: 'rejected' }
  | { status: 'rate-limited'; resetTime: number }
  /** A busca ou a comparação falhou; nada foi provado. */
  | { status: 'unavailable' }

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Confere e-mail e senha legados. Ordem fixa: formato, tentativa contada
 * (recusa ou espera), busca exata, bcrypt sempre. Uma falha do limitador
 * rejeita a promessa: nunca uma tentativa sem limite.
 */
export async function verifyLegacyCredential(
  deps: {
    db: LegacyAccountDatabase
    guard: LegacySignInGuard
    pause?: (_ms: number) => Promise<void>
  },
  input: { email: unknown; password: unknown; ip: string | null }
): Promise<LegacyCredentialVerification> {
  const { email, password, ip } = input
  if (typeof email !== 'string' || typeof password !== 'string' || !password)
    return { status: 'rejected' }
  const account = normalizeEmail(email)
  // Nenhum endereço entregável é tão longo: recusado antes de contar ou buscar.
  if (!account || account.length > MAX_EMAIL_LENGTH)
    return { status: 'rejected' }

  const attempt = await deps.guard.consume({ ip, account })
  if (!attempt.allowed)
    return { status: 'rate-limited', resetTime: attempt.resetTime }
  // Muitas tentativas na conta atrasam todos os clientes, antes da busca.
  if (attempt.delayMs > 0) await (deps.pause ?? wait)(attempt.delayMs)

  let verified: (LegacyAccount & { password: string }) | null = null
  try {
    const matches = await findLegacyAccountsByEmail(deps.db, account)
    const candidate = matches.length === 1 ? matches[0] : undefined
    // Conta inexistente, ambígua ou sem senha paga o mesmo bcrypt.
    const valid = await bcrypt.compare(
      password,
      candidate?.password ?? UNKNOWN_ACCOUNT_HASH
    )
    if (valid && candidate?.password)
      verified = { ...candidate, password: candidate.password }
  } catch (error) {
    console.error(
      '[identity] Credencial legada indisponível:',
      error instanceof Error ? error.name : 'unknown'
    )
    return { status: 'unavailable' }
  }
  if (!verified) return { status: 'rejected' }
  await deps.guard.clear({ ip, account })
  return { status: 'authenticated', account: verified }
}

/**
 * Copia a senha legada já provada por `verifyLegacyCredential` para a conta
 * `credential` do Better Auth. A coluna legada continua sendo a única que
 * grava senha durante a coexistência.
 */
export async function synchronizeLegacyCredential(
  prisma: PrismaClient,
  account: Pick<LegacyAccount, 'id' | 'emailVerified'> & { password: string }
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.authAccount.upsert({
      where: {
        providerId_accountId: {
          providerId: 'credential',
          accountId: account.id,
        },
      },
      create: {
        userId: account.id,
        accountId: account.id,
        providerId: 'credential',
        password: account.password,
      },
      update: { password: account.password },
    })
    if (account.emailVerified) {
      await tx.user.update({
        where: { id: account.id },
        data: { authEmailVerified: true },
      })
    }
  })
}
