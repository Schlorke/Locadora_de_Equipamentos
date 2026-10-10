/**
 * Tabelas de roteamento do host web por classe de host (docs/architecture/adr-tenant-hosts.md, seção 4.2).
 * Só dados e casamento de padrões: nada aqui lê ambiente, disco, banco ou rede.
 *
 * Padrões de caminho: segmentos literais, `*` (exatamente um segmento) e `**` no fim (zero ou mais segmentos).
 * O caminho casado é sempre o canônico (segmentos já decodificados por `canonicalPathname`).
 */
import {
  BETTER_AUTH_BASE_PATHS,
  betterAuthBasePath,
  type BetterAuthBasePath,
} from '@gb-locacoes/contracts/platform'
import type { HostAuthMode } from '../auth/mode'
import { PUBLIC_DIRECTORIES, PUBLIC_FILES } from './public-entries.generated'

export type PathPattern = `/${string}`

/** Casa um caminho canônico com um padrão (`*` = um segmento, `**` final = zero ou mais segmentos). */
export function matchesPattern(
  pathname: string,
  pattern: PathPattern
): boolean {
  const path = pathname.split('/').slice(1)
  const parts = pattern.split('/').slice(1)
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]
    if (part === '**' && index === parts.length - 1) return true
    const segment = path[index]
    if (segment === undefined) return false
    if (part !== '*' && part !== segment) return false
    if (part === '*' && segment === '') return false
  }
  return path.length === parts.length
}

export function matchesAny(
  pathname: string,
  patterns: readonly PathPattern[]
): boolean {
  return patterns.some((pattern) => matchesPattern(pathname, pattern))
}

/** Caminho de API (inclui a entrada `/api` sozinha, que também sai do `fallback`). */
export function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}

/**
 * APIs negadas em qualquer host da plataforma (404 JSON). Webhooks e crons continuam chamando a origem do
 * backend diretamente; utilitários de teste e de setup nunca ficam expostos pelo host web.
 */
export const BLOCKED_API_PATTERNS: readonly PathPattern[] = [
  '/api/test-login/**',
  '/api/fix-storage/**',
  '/api/supabase-setup/**',
  '/api/cron/**',
  '/api/webhooks/**',
  '/api/internal/**',
]

/** Handlers servidos pelo próprio host web (Lote 9: `/api/internal/revalidate`). Hoje nenhum. */
export const LOCAL_API_ROUTES: readonly PathPattern[] = []

/** `/api/payments/**\/webhook**` e `/api/contracts/zapsign-webhook**`. */
function isWebhookPath(pathname: string): boolean {
  const segments = pathname.split('/').slice(2)
  if (segments[0] === 'payments')
    return segments.slice(1).some((segment) => segment.startsWith('webhook'))
  if (segments[0] === 'contracts')
    return (segments[1] ?? '').startsWith('zapsign-webhook')
  return false
}

export function isBlockedApi(pathname: string): boolean {
  if (matchesAny(pathname, LOCAL_API_ROUTES)) return false
  return matchesAny(pathname, BLOCKED_API_PATTERNS) || isWebhookPath(pathname)
}

/**
 * `basePath` do Better Auth por modo: a regra única de `@gb-locacoes/contracts/platform`, a mesma do cliente
 * (`host/auth/client.ts`), do app mobile e do backend. `null` no `legacy`, que não tem login por subdomínio, e sem modo
 * (falha fechada). No `better-auth-v2` o backend fica em `AUTH_MODE=legacy`: `/api/auth/*` é o NextAuth
 * (`apps/services/api/src/app/api/auth/[...nextauth]/route.ts`), que lê a ação só do primeiro segmento (`callback/credentials/oauth-proxy` é o callback
 * de credenciais dele). Por isso a entrada do cliente só vale no `basePath` do modo, nunca nos dois.
 */
export { BETTER_AUTH_BASE_PATHS, betterAuthBasePath }
export type { BetterAuthBasePath }

/** Um endpoint do Better Auth (`get-session`, `callback/*`...) nos dois `basePath` (as negações valem em qualquer modo). */
export function betterAuthPatterns(
  endpoints: readonly string[]
): PathPattern[] {
  return endpoints.flatMap((endpoint) =>
    BETTER_AUTH_BASE_PATHS.map((base): PathPattern => `${base}/${endpoint}`)
  )
}

/**
 * APIs alcançáveis num host de locadora (`{slug}.<raiz>`) em qualquer modo de autenticação. Conferida contra as
 * chamadas das páginas montadas em `(public)/[locadora]` pelo teste `route-table.tenant-api-allowlist.test.ts`:
 * toda entrada tem chamador ou motivo de infraestrutura.
 *
 * Da API de autenticação, só a sessão do NextAuth (`legacy`: o shell consulta a sessão em qualquer rota). O que a
 * entrada do cliente usa está em `TENANT_ACCOUNT_API`, por modo, e só vale fora do `legacy`.
 */
export const TENANT_API_ALLOWLIST: readonly PathPattern[] = [
  // getSession do next-auth/react (hostAuth no modo legacy), chamado pelo RuntimeBootstrap em toda rota.
  '/api/auth/session',
  '/api/categories',
  '/api/equipments',
  // Consulta pública por id: SSR e a tela compartilhada usam o mesmo contrato do catálogo.
  '/api/equipments/*',
  '/api/equipments/*/availability',
  '/api/equipamentos/search',
  '/api/settings/public',
  // Textos legais publicados pela locadora (onda 134): páginas legais da raiz legada e do app e o diálogo dos Termos do
  // orçamento (entities/documento-legal). O SSR do host web lê pelo gateway server-only.
  '/api/settings/public/legal-documents/*',
  '/api/contact',
  '/api/quotes/**',
  // Formulário de /orcamento (QuoteForm): delega a POST /api/quotes e herda as regras de borda.
  '/api/orcamentos',
  '/api/cart/**',
  '/api/addresses/**',
  '/api/client/**',
  '/api/user/profile',
  // Sem chamador na vitrine, ficam de fora até uma tela usá-las: /api/contracts/sign e /api/payments/boleto/{id}/pdf.
  '/api/contracts/*/download',
  // Frete do orçamento (entities/orcamento/model/frete.ts): exige vínculo com a locadora do host.
  '/api/integrations/melhor-envio/calculate',
  // Usada pelo carrossel 3D crítico (ModelViewer.web.tsx); negar quebraria o componente (V23).
  '/api/drei-proxy/**',
  '/api/health',
]

/**
 * Entrada e conta do cliente no `basePath` do Better Auth do modo (nunca no outro, que pode ser o NextAuth); nenhuma
 * no modo sem Better Auth.
 */
function tenantAccountApiOf(mode: HostAuthMode): readonly PathPattern[] {
  const base = betterAuthBasePath(mode)
  if (base === null) return []
  return [
    // hostAuth.getSession (RuntimeBootstrap, /login, /entrar e /auth/callback).
    `${base}/get-session`,
    // hostAuth.signInCredentials (/login e /entrar).
    `${base}/sign-in/email`,
    // hostAuth.signInProvider: início do login social; o callback do provedor é registrado só no app (T10).
    `${base}/sign-in/social`,
    // Conclusão do oauth-proxy: o app devolve o navegador ao host de origem, que cria a própria sessão (T10).
    `${base}/callback/*/oauth-proxy`,
    // hostAuth.signOut: "Sair" encerra só a sessão deste host.
    `${base}/sign-out`,
    // Rotas próprias do backend (segmento estático: vencem o catch-all do NextAuth e o do Better Auth em qualquer
    // modo). Telas de cadastro, recuperação e redefinição de senha (limite e respostas neutras nelas).
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    // Link de verificação do cadastro, montado na origem do host (factory.ts, sendVerificationEmail).
    '/api/auth/verify-email',
    // Vínculo com a locadora do host (área do cliente no modo host).
    '/api/auth/organizations/current',
  ]
}

/**
 * Entrada e conta do cliente no host de locadora, por modo de autenticação: a lista MÍNIMA do que as telas `(auth)` e
 * `(account)` da vitrine chamam. Só existe quando o login por subdomínio existe (Better Auth) e só no `basePath` do
 * modo (`betterAuthBasePath`); no `legacy` essas telas ficam ocultas (desenho 4.6) e a API delas também. O resto da
 * API de conta fica só no host `app` (`TENANT_API_DENYLIST`).
 */
export const TENANT_ACCOUNT_API: Readonly<
  Record<HostAuthMode, readonly PathPattern[]>
> = {
  legacy: tenantAccountApiOf('legacy'),
  'better-auth': tenantAccountApiOf('better-auth'),
  'better-auth-v2': tenantAccountApiOf('better-auth-v2'),
}

/**
 * Negadas no host de locadora mesmo que um padrão da allowlist as cubra. Um script na origem da locadora (pixel
 * permitido ou XSS) não pode ler nem mexer na conta global do usuário, nas sessões dos outros hosts (inclusive a do
 * painel) nem nos vínculos com outras locadoras; isso tudo só no host `app`.
 */
export const TENANT_API_DENYLIST: readonly PathPattern[] = [
  // V26: listariam os vínculos do usuário com outras locadoras para scripts da origem desta. Só /current passa.
  '/api/auth/organizations',
  '/api/auth/organizations/selection',
  ...betterAuthPatterns([
    // Sessões de todos os hosts (token, IP e user agent) e a revogação delas.
    'list-sessions',
    'revoke-session',
    'revoke-sessions',
    'revoke-other-sessions',
    'update-session',
    // Perfil, e-mail, senha e exclusão da conta global (vista por todas as locadoras).
    'update-user',
    'change-email',
    'change-password',
    'delete-user',
    'delete-user/callback',
    // Contas OAuth vinculadas e os tokens delas.
    'list-accounts',
    'account-info',
    'link-social',
    'unlink-account',
    'get-access-token',
    'refresh-token',
    // Callback do provedor OAuth (registrado só no app) e as rotas de apoio do app e do mobile.
    'callback/*',
    'oauth-proxy-callback',
    'expo-authorization-proxy',
  ]),
]

/**
 * API permitida num host de locadora no modo de autenticação do host web (`DecideEnv.authMode`; ausente conta como
 * `legacy`). A denylist vence qualquer padrão.
 */
export function isTenantApiAllowed(
  pathname: string,
  mode: HostAuthMode | undefined
): boolean {
  if (matchesAny(pathname, TENANT_API_DENYLIST)) return false
  if (matchesAny(pathname, TENANT_API_ALLOWLIST)) return true
  return matchesAny(pathname, TENANT_ACCOUNT_API[mode ?? 'legacy'])
}

/**
 * GETs públicos que recebem `tenantSlug={slug do host}` quando a query não traz um: a URL vira a chave de cache
 * por locadora (desenho 4.5).
 */
export const PUBLIC_TENANT_QUERY_ROUTES: readonly PathPattern[] = [
  '/api/categories',
  '/api/equipments',
  '/api/equipments/*',
  '/api/equipments/*/availability',
  '/api/equipamentos/search',
  '/api/settings/public',
  '/api/settings/public/legal-documents/*',
]

/** APIs do apex: diretório de locadoras e catálogo público da assinatura. */
export const APEX_API_ROUTES: readonly PathPattern[] = [
  '/api/public/plans',
  '/api/public/tenants',
  '/api/public/tenants/*',
]

/**
 * Páginas do host `app` (painel e fluxos de conta da equipe). `/login` é o login da equipe: destino do
 * `/admin/login`, do "Entrar" da área privada e do /auth/callback sem sessão.
 */
export const APP_HOST_PATHS: readonly PathPattern[] = [
  '/admin',
  '/admin/**',
  '/login',
  '/comecar',
  '/recuperar-senha',
  '/reset-password',
  '/auth/callback',
]

/** Páginas de laboratório: só no host `app`, com `PLATFORM_LABS_ENABLED=true` e fora de produção. */
export const LABS_PATHS: readonly PathPattern[] = [
  '/catalog',
  '/playground',
  '/playground/**',
  '/grid-motion',
  '/equipamentos-scroll',
  '/admin/teste-toast',
]

/**
 * Entrada, cadastro e área do cliente no host de locadora (grupos `(auth)` e `(account)` de `[locadora]`). No modo
 * `legacy` (NextAuth) ficam ocultos (desenho 4.6): o proxy responde o 404 neutro antes de renderizar.
 */
export const TENANT_ACCOUNT_PATHS: readonly PathPattern[] = [
  '/entrar',
  '/login',
  '/cadastro',
  '/recuperar-senha',
  '/reset-password',
  '/auth/callback',
  '/vincular',
  '/area-cliente',
  '/area-cliente/**',
]

/** Arquivos de associação dos links universais, servidos só no apex (Lote 7c). */
export const APEX_WELL_KNOWN: readonly string[] = [
  'apple-app-site-association',
  'assetlinks.json',
]

/**
 * Arquivos de public/ que cada host serve com a própria rota (SEO por host, Lote 5) e por isso não seguem para
 * `next` nem para os arquivos estáticos.
 */
export const HOST_OWNED_PUBLIC_FILES: readonly string[] = [
  'robots.txt',
  'sitemap.xml',
  'manifest.json',
]

const PASSTHROUGH_FILES = new Set(
  PUBLIC_FILES.filter((name) => !HOST_OWNED_PUBLIC_FILES.includes(name))
)
const PUBLIC_DIRECTORY_SET = new Set(PUBLIC_DIRECTORIES)

/** Entrada de public/ que segue para `next` e é servida pela cópia pública do próprio host web. */
export function isPublicPassthrough(pathname: string): boolean {
  const segments = pathname.split('/').slice(1)
  const first = segments[0] ?? ''
  if (segments.length === 1) return PASSTHROUGH_FILES.has(first)
  return PUBLIC_DIRECTORY_SET.has(first)
}
