/**
 * Contexto de borda (proxy web → backend). ADR docs/architecture/adr-tenant-hosts.md
 * (D1, D5) e desenho 4.2/4.5.
 *
 * O proxy do host web remove todos os `x-platform-*` recebidos e só então os
 * define, junto com `x-platform-edge-auth` igual a `PLATFORM_EDGE_SECRET`.
 * Aqui o contexto só é aceito com esse segredo (atual ou anterior, comparados
 * em tempo constante) e com a origem revalidada por `classifyHost`: o host
 * informado precisa produzir exatamente a mesma classe, o mesmo slug e a mesma
 * origem canônica. Qualquer divergência devolve `null`, e a requisição é
 * tratada como "sem host" (falha fechada: sem locadora implícita).
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import {
  classifyHost,
  PLATFORM_EDGE_HEADER,
  resolvePlatformEnv,
  type PlatformEdgeHostKind,
  type PlatformEnv,
  type PlatformEnvSource,
} from '@gb-locacoes/contracts/platform'

export type PlatformEdgeContext =
  | {
      readonly hostKind: 'tenant'
      readonly tenantSlug: string
      /** Origem canônica recalculada pelo classificador (nunca o Host cru). */
      readonly origin: string
      /** IP do cliente informado pela borda (`x-real-ip` na Vercel), se válido. */
      readonly clientIp: string | null
    }
  | {
      readonly hostKind: Exclude<PlatformEdgeHostKind, 'tenant'>
      readonly origin: string
      readonly clientIp: string | null
    }

type HeaderSource = { readonly headers: Pick<Headers, 'get'> }

const HOST_KINDS: readonly PlatformEdgeHostKind[] = ['tenant', 'app', 'apex']
const ORIGIN_RE =
  /^(https?):\/\/([a-z0-9.-]+(?::\d{1,5})?|\[[0-9a-f:.]+\](?::\d{1,5})?)$/
const CLIENT_IP_RE = /^[0-9A-Fa-f:.]{2,45}$/

let reportedInvalidEnv = false

function platformEnv(source: PlatformEnvSource): PlatformEnv | null {
  try {
    return resolvePlatformEnv(source)
  } catch (error) {
    // A mensagem de PlatformEnvError nunca contém valores de segredo.
    if (!reportedInvalidEnv) {
      reportedInvalidEnv = true
      console.error(
        '[platform-edge] ambiente da plataforma inválido; contexto de borda ignorado',
        {
          error: error instanceof Error ? error.message : 'unknown',
        }
      )
    }
    return null
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

/** Comparação em tempo constante; resumos de tamanho fixo evitam vazar o comprimento. */
function secretMatches(received: string, expected: string | null): boolean {
  if (expected === null) return false
  return timingSafeEqual(digest(received), digest(expected))
}

function isHostKind(value: string | null): value is PlatformEdgeHostKind {
  return value !== null && (HOST_KINDS as readonly string[]).includes(value)
}

/**
 * Lê o contexto de borda da requisição. Devolve `null` quando não há segredo
 * válido, quando o ambiente da plataforma não está configurado ou quando os
 * cabeçalhos não descrevem exatamente um host `tenant`, `app` ou `apex`.
 */
export function readPlatformEdgeContext(
  request: HeaderSource,
  env: PlatformEnvSource = process.env
): PlatformEdgeContext | null {
  const received = request.headers.get(PLATFORM_EDGE_HEADER.auth)
  if (!received) return null
  const platform = platformEnv(env)
  if (!platform || platform.edgeSecret === null) return null
  // Os dois segredos são sempre comparados (rotação sem atalho observável).
  const current = secretMatches(received, platform.edgeSecret)
  const previous = secretMatches(received, platform.edgeSecretPrevious)
  if (!current && !previous) return null

  const hostKind = request.headers.get(PLATFORM_EDGE_HEADER.hostKind)
  if (!isHostKind(hostKind)) return null
  const origin = request.headers.get(PLATFORM_EDGE_HEADER.origin)
  const match = origin === null ? null : ORIGIN_RE.exec(origin)
  if (!origin || !match || match[2] === undefined) return null

  // Só `tenant`, `app` e `apex` chegam ao backend; `www`, `reserved` e
  // `invalid` nunca formam contexto de borda.
  const classified = classifyHost(match[2], platform)
  if (
    (classified.kind !== 'tenant' &&
      classified.kind !== 'app' &&
      classified.kind !== 'apex') ||
    classified.kind !== hostKind ||
    classified.origin !== origin
  )
    return null

  const slugHeader = request.headers.get(PLATFORM_EDGE_HEADER.tenantSlug)
  const rawIp = request.headers.get(PLATFORM_EDGE_HEADER.clientIp)
  const clientIp = rawIp !== null && CLIENT_IP_RE.test(rawIp) ? rawIp : null

  if (classified.kind === 'tenant') {
    if (slugHeader !== classified.slug) return null
    return Object.freeze({
      hostKind: 'tenant',
      tenantSlug: classified.slug,
      origin: classified.origin,
      clientIp,
    })
  }
  // Host sem locadora não carrega slug: um slug aqui é borda inconsistente.
  if (slugHeader !== null && slugHeader !== '') return null
  return Object.freeze({
    hostKind: classified.kind,
    origin: classified.origin,
    clientIp,
  })
}
