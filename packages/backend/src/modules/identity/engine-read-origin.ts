/**
 * Leituras dos motores de identidade com `Origin` explícito de outra origem (onda 133, achado 149). Uma regra para
 * os dois motores, nos dois hosts: todo GET/HEAD do motor fora das navegações de topo que chegam de outro site POR
 * DESENHO recusa `Origin` explícito de outra origem com o envelope central (`rejectExplicitCrossOrigin`, a regra das
 * leituras privadas da onda 132), antes do motor e do banco.
 *
 * Nenhuma leitura tem consumidor de outra origem: o cliente web chama o próprio host (GET de mesma origem não leva
 * `Origin`; o `next-auth/react` usa só o `basePath` no navegador e o cliente do Better Auth não tem `baseURL`) e o
 * app nativo não envia `Origin` (o `fetch` do React Native não o acrescenta; o `expoClient` manda `expo-origin`, que
 * só o motor traduz). Sem `Origin` (navegação de topo, app nativo, servidor-servidor) segue como antes; mutações
 * ficam com a defesa própria de cada motor (`OWN_CSRF_DEFENCE` do inventário de rotas).
 *
 * As navegações se protegem por `state`, PKCE ou token de uso único, nunca por `Origin`, e uma recusa por `Origin`
 * quebraria o fluxo no navegador que o enviasse. Os segmentos variáveis só aceitam `[A-Za-z0-9_-]`: um caminho que
 * só se pareça com uma navegação continua na regra.
 */
import type { PlatformEnvSource } from '@gb-locacoes/contracts/platform'
import { identityBasePath } from './configuration'
import { rejectExplicitCrossOrigin } from './same-origin-mutation'

/**
 * Navegações do Better Auth, relativas ao `basePath` do modo:
 * - `/callback/:id`: o provedor OAuth devolve o navegador ao callback fixo no `app`;
 * - `/callback/:id/oauth-proxy` e `/oauth-proxy-callback` (depreciado): o `app` devolve o navegador ao host de
 *   origem, outra origem por definição (T10 da ADR de hosts);
 * - `/expo-authorization-proxy`: navegador do sistema aberto pelo app; a ADR descartou `Origin` e `Sec-Fetch-Site`
 *   nele, protegido pelo plugin `appAuthorization`;
 * - `/verify-email`, `/reset-password/:token` e `/delete-user/callback`: links de e-mail;
 * - `/error`: a página para onde esses fluxos redirecionam.
 */
const BETTER_AUTH_NAVIGATIONS: readonly RegExp[] = [
  /^\/callback\/[A-Za-z0-9_-]+$/,
  /^\/callback\/[A-Za-z0-9_-]+\/oauth-proxy$/,
  /^\/oauth-proxy-callback$/,
  /^\/expo-authorization-proxy$/,
  /^\/verify-email$/,
  /^\/reset-password\/[A-Za-z0-9_-]+$/,
  /^\/delete-user\/callback$/,
  /^\/error$/,
]

/** Onde o NextAuth atende nos dois hosts: a rota `app/api/auth/[...nextauth]` (também no modo `better-auth-v2`). */
const NEXTAUTH_BASE_PATH = '/api/auth'

/**
 * Navegações do NextAuth (modo `legacy`, o padrão, e `better-auth-v2`), relativas a `/api/auth`:
 * - `/callback/:provider`: o Google e o Facebook devolvem o navegador ao callback (protegido por `state`/PKCE);
 * - `/error`: a página para onde o motor manda quando esse retorno falha.
 * `session`, `csrf`, `providers`, `signin`, `signout`, `verify-request` e qualquer ação nova ficam na regra: o login
 * de credenciais e o OAuth do `next-auth/react` e do app nativo leem `csrf`, `providers` e `session` do próprio host.
 */
const NEXTAUTH_NAVIGATIONS: readonly RegExp[] = [
  /^\/callback\/[A-Za-z0-9_-]+$/,
  /^\/error$/,
]

function refuseEngineRead(
  request: Pick<Request, 'method' | 'url' | 'headers'>,
  env: PlatformEnvSource,
  basePath: string,
  navigations: readonly RegExp[]
): Response | null {
  const method = request.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') return null
  const { pathname } = new URL(request.url)
  const endpoint = pathname.startsWith(`${basePath}/`)
    ? pathname.slice(basePath.length)
    : null
  if (
    endpoint !== null &&
    navigations.some((navigation) => navigation.test(endpoint))
  )
    return null
  return rejectExplicitCrossOrigin(request, env)
}

/** Leituras do Better Auth (`get-session`, `list-sessions`, `list-accounts`, `account-info`...), no `basePath` do modo. */
export function refuseBetterAuthRead(
  request: Pick<Request, 'method' | 'url' | 'headers'>,
  env: Record<string, string | undefined>
): Response | null {
  return refuseEngineRead(
    request,
    env,
    identityBasePath(env),
    BETTER_AUTH_NAVIGATIONS
  )
}

/** Leituras do NextAuth (`session`, `csrf`, `providers`...): `withSignInAvailability` aplica antes do motor. */
export function refuseNextAuthRead(
  request: Pick<Request, 'method' | 'url' | 'headers'>,
  env: PlatformEnvSource = process.env
): Response | null {
  return refuseEngineRead(
    request,
    env,
    NEXTAUTH_BASE_PATH,
    NEXTAUTH_NAVIGATIONS
  )
}
