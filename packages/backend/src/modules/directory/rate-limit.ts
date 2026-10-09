/**
 * Rate limit persistente da plataforma (ADR docs/architecture/adr-tenant-hosts.md,
 * Migração B e Lote 7a).
 *
 * - Janela fixa alinhada ao relógio: a janela `i` cobre
 *   `[i * windowMs, (i + 1) * windowMs)`. A chave é
 *   `"<rota>:<hmac(identificador)>:<índice da janela>"`, então cada janela tem a
 *   sua linha e nenhuma contagem precisa ser zerada.
 * - O consumo é um único `upsert` (`INSERT ... ON CONFLICT DO UPDATE` no
 *   PostgreSQL): atômico entre instâncias, sem ler antes de gravar. Quem passa
 *   do limite continua contando na mesma linha, sem criar outras.
 * - Nenhuma chave guarda IP ou e-mail em claro: o identificador entra como
 *   `HMAC-SHA256(PLATFORM_RATE_LIMIT_SECRET, valor)` em hexadecimal, e as
 *   chaves só usam `[a-z0-9:-]` (seguro para `startsWith`, que o Prisma traduz
 *   para `LIKE` sem escapar `%` e `_`).
 * - `platform_rate_limits` é global (tools/tenant-models.json#globalModels); as
 *   janelas vencidas saem no cron de outbox (`purgeExpiredPlatformRateLimits`).
 */
import { createHmac, randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { PlatformEnvError } from '@gb-locacoes/contracts/platform'

/** Janela fixa: no máximo `max` ocorrências a cada `windowMs`. */
export type RateLimitWindow = {
  readonly windowMs: number
  readonly max: number
}

export type RateLimitDecision = {
  readonly allowed: boolean
  /** Ocorrências que ainda cabem na janela (0 quando recusada). */
  readonly remaining: number
  /** Fim da janela atual, em milissegundos desde a época. */
  readonly resetTime: number
}

/**
 * Porta do contador. `hit` conta uma ocorrência de forma atômica e devolve o
 * total da janela; `remove` e `removePrefix` apagam janelas (sucesso de login,
 * troca de senha).
 */
export interface RateLimitCounter {
  hit(_key: string, _expiresAt: Date): Promise<number>
  remove(_keys: readonly string[]): Promise<void>
  removePrefix(_prefix: string): Promise<void>
}

export type PlatformRateLimitDatabase = Pick<PrismaClient, 'platformRateLimit'>

const SEGMENT_RE = /^[a-z0-9-]+$/
const PREFIX_RE = /^(?:[a-z0-9-]+:)+$/
/** Tamanho do HMAC na chave: 128 bits em hexadecimal. */
const DIGEST_LENGTH = 32
export const PLATFORM_RATE_LIMIT_SECRET_MIN_LENGTH = 32
/** Folga antes da limpeza: relógios de instâncias diferentes nunca batem exato. */
export const PLATFORM_RATE_LIMIT_PURGE_GRACE_MS = 60_000

/** Janela que contém `now`. */
export function rateLimitWindowAt(
  now: number,
  windowMs: number
): { index: number; resetTime: number } {
  if (!Number.isFinite(now) || !Number.isInteger(windowMs) || windowMs <= 0)
    throw new RangeError('Janela de rate limit inválida')
  const index = Math.floor(now / windowMs)
  return { index, resetTime: (index + 1) * windowMs }
}

/** Prefixo comum a todas as janelas de um escopo: `"a:b:c:"`. */
export function rateLimitKeyPrefix(segments: readonly string[]): string {
  if (
    !segments.length ||
    !segments.every((segment) => SEGMENT_RE.test(segment))
  )
    throw new RangeError('Segmento de chave de rate limit inválido')
  return `${segments.join(':')}:`
}

/** Chave de uma janela: prefixo do escopo mais o índice da janela. */
export function rateLimitWindowKey(
  segments: readonly string[],
  index: number
): string {
  if (!Number.isSafeInteger(index) || index < 0)
    throw new RangeError('Índice de janela de rate limit inválido')
  return `${rateLimitKeyPrefix(segments)}${index}`
}

/**
 * HMAC do identificador (IP, e-mail normalizado). `purpose` separa domínios:
 * o mesmo texto como IP e como e-mail nunca produz a mesma parte de chave.
 */
export function platformRateLimitDigest(
  secret: string,
  purpose: string,
  value: string
): string {
  return createHmac('sha256', secret)
    .update(`${purpose}\u0000${value}`, 'utf8')
    .digest('hex')
    .slice(0, DIGEST_LENGTH)
}

let processSecret: string | null = null
let reportedMissingSecret = false

/**
 * `PLATFORM_RATE_LIMIT_SECRET` com 32 caracteres ou mais, igual em todas as
 * instâncias. Em produção, ausente ou curto é erro de configuração, como
 * `PLATFORM_EDGE_SECRET`: lança `PlatformEnvError` em toda chamada (registrado
 * uma vez), e o limitador que o pede recusa em vez de degradar em silêncio
 * para janelas por instância. A mensagem nunca repete o valor. Fora de
 * produção, cada processo usa uma chave aleatória própria.
 *
 * O `NODE_ENV` da entrada é o sinal de produção JÁ decidido por quem chama,
 * nunca o `process.env` cru: o app decide pelo critério da plataforma
 * (`isPlatformProduction`, em `identityRateLimitSecret` de security-env.ts),
 * em que um preview da Vercel (`NODE_ENV=production`) não é produção e
 * `PLATFORM_ENV=production` é, com qualquer `NODE_ENV`. Por isso não há
 * padrão: toda chamada diz de onde vem o sinal.
 */
export function platformRateLimitSecret(
  env: Readonly<Record<string, string | undefined>>
): string {
  const configured = env.PLATFORM_RATE_LIMIT_SECRET?.trim()
  if (configured && configured.length >= PLATFORM_RATE_LIMIT_SECRET_MIN_LENGTH)
    return configured
  if (env.NODE_ENV === 'production') {
    const error = new PlatformEnvError(
      `PLATFORM_RATE_LIMIT_SECRET é obrigatória em produção, com ${PLATFORM_RATE_LIMIT_SECRET_MIN_LENGTH} caracteres ou mais.`
    )
    if (!reportedMissingSecret) {
      reportedMissingSecret = true
      console.error(`[rate-limit] ${error.message}`)
    }
    throw error
  }
  processSecret ??= randomBytes(32).toString('hex')
  return processSecret
}

/** Adaptador Prisma da porta, sobre `platform_rate_limits`. */
export function prismaRateLimitCounter(
  db: PlatformRateLimitDatabase
): RateLimitCounter {
  return {
    async hit(key, expiresAt) {
      // Upsert nativo (um campo único em `where`, mesmo valor em `create`):
      // INSERT ... ON CONFLICT ("key") DO UPDATE, atômico entre instâncias.
      const row = await db.platformRateLimit.upsert({
        where: { key },
        create: { key, count: 1, expiresAt },
        update: { count: { increment: 1 } },
        select: { count: true },
      })
      return row.count
    },
    async remove(keys) {
      if (!keys.length) return
      await db.platformRateLimit.deleteMany({
        where: { key: { in: [...keys] } },
      })
    },
    async removePrefix(prefix) {
      if (!PREFIX_RE.test(prefix))
        throw new RangeError('Prefixo de rate limit inválido')
      await db.platformRateLimit.deleteMany({
        where: { key: { startsWith: prefix } },
      })
    },
  }
}

/** Conta uma ocorrência na janela atual do escopo. */
export async function hitRateLimitWindow(
  counter: RateLimitCounter,
  segments: readonly string[],
  windowMs: number,
  now: number
): Promise<{ count: number; resetTime: number }> {
  const window = rateLimitWindowAt(now, windowMs)
  const count = await counter.hit(
    rateLimitWindowKey(segments, window.index),
    new Date(window.resetTime)
  )
  return { count, resetTime: window.resetTime }
}

/** Consome uma ocorrência: permitida enquanto o total da janela não passa de `max`. */
export async function consumeRateLimitWindow(
  counter: RateLimitCounter,
  segments: readonly string[],
  window: RateLimitWindow,
  now: number
): Promise<RateLimitDecision> {
  const { count, resetTime } = await hitRateLimitWindow(
    counter,
    segments,
    window.windowMs,
    now
  )
  return {
    allowed: count <= window.max,
    remaining: Math.max(0, window.max - count),
    resetTime,
  }
}

/**
 * Apaga as janelas vencidas (chamado pelo cron de outbox). Mantém a folga de
 * `PLATFORM_RATE_LIMIT_PURGE_GRACE_MS`, para uma instância com relógio
 * adiantado não apagar a janela que outra ainda usa.
 */
export async function purgeExpiredPlatformRateLimits(
  db: PlatformRateLimitDatabase,
  now: number = Date.now()
): Promise<number> {
  const { count } = await db.platformRateLimit.deleteMany({
    where: {
      expiresAt: { lt: new Date(now - PLATFORM_RATE_LIMIT_PURGE_GRACE_MS) },
    },
  })
  return count
}

/** Busca do diretório: 30 por minuto por IP. */
export const DIRECTORY_SEARCH_RATE_LIMIT: RateLimitWindow = {
  windowMs: 60_000,
  max: 30,
}

/**
 * Janela da busca do diretório por IP do cliente. Sem IP confiável, todos
 * dividem a janela `unknown` (falha fechada: nunca uma janela por requisição).
 */
export function consumeDirectorySearchRateLimit(
  counter: RateLimitCounter,
  input: { ip: string | null; secret: string; now: number }
): Promise<RateLimitDecision> {
  const subject = input.ip
    ? platformRateLimitDigest(input.secret, 'ip', input.ip)
    : 'unknown'
  return consumeRateLimitWindow(
    counter,
    ['directory-search', 'ip', subject],
    DIRECTORY_SEARCH_RATE_LIMIT,
    input.now
  )
}
