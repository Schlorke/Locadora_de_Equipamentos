/**
 * Mutação de navegador só da origem pública esperada (CSRF entre locadoras
 * irmãs). ADR docs/architecture/adr-tenant-hosts.md (D1 e D5).
 *
 * Todo `{slug}.<raiz>` e o `app.<raiz>` são o MESMO site: o cookie de sessão de
 * `a.<raiz>` (SameSite Lax ou Strict) acompanha um `fetch` com
 * `credentials: 'include'` disparado por um script de `b.<raiz>`, e um POST
 * `text/plain` nem passa por preflight. Uma regra só, aplicada de forma
 * central nos pontos de autorização por cookie (`resolveTenantPrincipal`, e
 * por ele `requireTenantPermission` e os middlewares de `requireAdmin`) e nos
 * fluxos anônimos de conta:
 *
 * - métodos seguros (GET, HEAD, OPTIONS): sempre aceitos;
 * - sem cabeçalho de navegador (`Origin` e `Sec-Fetch-Site` ausentes): aceita,
 *   como antes (app nativo, servidor-servidor; sem navegador não há cookie de
 *   outro site);
 * - origem esperada: a que a borda validada calculou para o host; sem borda, a
 *   origem pública configurada (`WEB_PUBLIC_ORIGIN`) ou, sem ela, a da própria
 *   requisição. Configurada e inválida: recusa (falha fechada);
 * - `Origin` presente e diferente da esperada (inclusive `null`): recusa;
 * - `Sec-Fetch-Site` presente e diferente de `same-origin` ou `none`: recusa.
 *
 * Leituras privadas: o principal comum (`createTenantPrincipalResolver`) também
 * recusa `Origin` explícito de outra origem em GET/HEAD, depois do vínculo e
 * antes da assinatura e dos dados (`rejectExplicitCrossOrigin`, onda 132). As
 * leituras de conta fora dele (`/api/auth/organizations`, `/current`,
 * `/selection` GET e os GET dos dois motores, Better Auth e NextAuth, salvo as
 * navegações de outro site: `engine-read-origin.ts`) aplicam a mesma função
 * (onda 133, achado 149).
 *
 * Método desconhecido (quem só enxerga os cabeçalhos, como `next/headers` em
 * `requireAdmin`): pela especificação Fetch o navegador envia `Origin` em todo
 * método que não seja GET nem HEAD, então sem `Origin` a requisição é leitura
 * (ou cliente sem navegador) e segue; com `Origin`, vale a regra de mutação.
 * Sem a URL, a "própria origem" é o authority do cabeçalho `Host`.
 */
import type { PlatformEnvSource } from '@gb-locacoes/contracts/platform'
import { readPlatformEdgeContext } from './platform-edge'

export type MutationRequest = {
  /** Optional cloned body for narrowly defined subscription exceptions. */
  clone?: () => { json(): Promise<unknown> }
  /** Método HTTP; `null` quando o chamador só enxerga os cabeçalhos. */
  readonly method: string | null
  /** URL da requisição; `null` quando o chamador só enxerga os cabeçalhos. */
  readonly url: string | null
  readonly headers: Pick<Headers, 'get'>
}

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS'])
const SAME_ORIGIN_SITES: ReadonlySet<string> = new Set(['same-origin', 'none'])

/** Origem de navegador aceita: a exata, ou só o authority quando a URL é desconhecida. */
type Expected = { readonly origin: string } | { readonly host: string } | null

function webOrigin(raw: string): URL | null {
  try {
    const url = new URL(raw)
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username ||
      url.password
    )
      return null
    return url
  } catch {
    return null
  }
}

function expectedOrigin(
  request: MutationRequest,
  env: PlatformEnvSource,
  publicOrigin: string | undefined
): Expected {
  const edge = readPlatformEdgeContext(request, env)
  if (edge) return { origin: edge.origin }
  const configured = publicOrigin?.trim()
  if (configured) {
    const url = webOrigin(configured)
    if (
      !url ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.hostname.includes('*')
    )
      return null
    return { origin: url.origin }
  }
  if (request.url !== null) {
    const url = webOrigin(request.url)
    return url ? { origin: url.origin } : null
  }
  const host = request.headers.get('host')?.trim().toLowerCase()
  return host ? { host } : null
}

function matches(origin: string, expected: Expected): boolean {
  if (expected === null) return false
  if ('origin' in expected) return origin === expected.origin
  const url = webOrigin(origin)
  return url !== null && url.origin === origin && url.host === expected.host
}

/** A requisição não é mutação de navegador vinda de outra origem. */
export function isSameOriginMutation(
  request: MutationRequest,
  env: PlatformEnvSource = process.env,
  publicOrigin: string | undefined = env.WEB_PUBLIC_ORIGIN
): boolean {
  const method = request.method?.toUpperCase() ?? null
  if (method !== null && SAFE_METHODS.has(method)) return true
  const origin = request.headers.get('origin')
  const site = request.headers.get('sec-fetch-site')
  if (method === null && origin === null) return true
  if (origin === null && site === null) return true
  const expected = expectedOrigin(request, env, publicOrigin)
  if (expected === null) return false
  if (origin !== null && !matches(origin, expected)) return false
  return site === null || SAME_ORIGIN_SITES.has(site)
}

/**
 * Guard das mutações autenticadas por cookie: 403 `no-store` quando a mutação
 * vem de outra origem; `null` quando a requisição pode seguir.
 */
export function rejectCrossOriginMutation(
  request: MutationRequest,
  env?: PlatformEnvSource,
  publicOrigin?: string
): Response | null {
  if (isSameOriginMutation(request, env, publicOrigin)) return null
  return Response.json(
    { error: 'Origem não permitida' },
    { status: 403, headers: { 'Cache-Control': 'no-store' } }
  )
}

/**
 * `Origin` explícito em qualquer método, leituras inclusive (ondas 45, 49 e
 * 131; generalizado no principal privado comum na onda 132, achado 144).
 *
 * Sem `Origin` (app nativo, servidor-servidor, navegação de topo) a requisição
 * segue. Com ele, a requisição é classificada só pelos cabeçalhos
 * (`method: null`) e comparada com a origem que a borda validada calculou para
 * o host (ou a origem pública configurada), exatamente como a regra de
 * mutação: `Origin` de locadora irmã, do painel num host de locadora, `null`
 * ou `Sec-Fetch-Site` fora de `same-origin`/`none` dão o mesmo 403 `no-store`.
 * A política genérica de métodos seguros de `isSameOriginMutation` não muda.
 */
export function rejectExplicitCrossOrigin(
  request?: Pick<MutationRequest, 'url' | 'headers'>,
  env: PlatformEnvSource = process.env
): Response | null {
  if (!request || request.headers.get('origin') === null) return null
  return rejectCrossOriginMutation(
    { method: null, url: request.url, headers: request.headers },
    env
  )
}
