// A allowlist de API do host de locadora confere com as chamadas feitas pelas páginas montadas nele (Lote 4b).
//
// Percorre o grafo de imports a partir de cada arquivo de (public)/[locadora] (páginas, layouts e providers do host),
// entrando em packages/frontend e packages/ui, e coleta todo literal `/api/...` e toda chamada do cliente Better Auth
// (`authClient.getSession()` → `/get-session`). Nos dois sentidos:
// - cada chamada precisa passar no proxy; as exceções conhecidas ficam listadas com o motivo e o teste falha quando
//   uma delas deixa de existir (a exceção sai junto);
// - cada entrada da allowlist precisa de ao menos um chamador ou de um motivo de infraestrutura (INFRA); entrada
//   sem nenhum dos dois é larga demais ou morta.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { classifyHost, resolvePlatformEnv } from '@gb-locacoes/contracts/platform'
import type { HostAuthMode } from '../auth/mode'
import { decide } from './decide'
import {
  BETTER_AUTH_BASE_PATHS,
  PUBLIC_TENANT_QUERY_ROUTES,
  TENANT_ACCOUNT_API,
  TENANT_API_ALLOWLIST,
  TENANT_API_DENYLIST,
  betterAuthBasePath,
  isApiPath,
  isTenantApiAllowed,
  matchesPattern,
  type PathPattern,
} from './route-table'

const repoRoot = path.resolve(__dirname, '../../../../../..')
const webSrc = path.join(repoRoot, 'apps', 'clients', 'web', 'src')
const tenantTree = path.join(webSrc, 'app', '(public)', '[locadora]')

// Mesma resolução do host web: entradas dos pacotes (condição padrão = web) e extensões sem variantes implícitas.
const PACKAGE_ENTRIES: Record<string, string> = {
  '@gb-locacoes/frontend/app': 'packages/frontend/src/app/index.web.ts',
  '@gb-locacoes/ui': 'packages/ui/src/index.web.ts',
}
const PACKAGE_PREFIXES: Record<string, string> = {
  '@gb-locacoes/frontend/pages/': 'packages/frontend/src/pages/',
}

/** Chamadas do host de locadora que ainda não passam e o lote que as resolve. */
const KNOWN_PENDING: Record<string, string> = {
  // RuntimeBootstrap (seleção de locadora) lista e grava vínculos; no modo host passa a usar /current (Lote 6).
  '/api/auth/organizations': 'Lote 6',
  '/api/auth/organizations/selection': 'Lote 6',
}

/**
 * Chamadas que o grafo alcança por barris de exportação, mas que só rodam em telas do painel (host `app`). Ficam
 * negadas no host de locadora de propósito; cada uma com o motivo.
 */
const PANEL_ONLY: Record<string, string> = {
  // Constantes de entities/equipamento/model/lista.ts; só pages/equipamentos-admin as usa.
  '/api/admin/equipments': 'painel',
  '/api/admin/categories': 'painel',
  // Ramo ADMIN de useNotifications (área do cliente): a sincronização é do painel; a falha é engolida pelo hook.
  '/api/admin/notifications/sync': 'painel',
  // ImageUpload do @gb-locacoes/ui; usado só por configurações, equipamentos e logística do painel.
  '/api/upload': 'painel',
  // Menu lateral da casca do painel (AdminLayoutShell, montada só pelo layout (admin) do host app): selos de pendência
  // (features/selos-admin) e assinatura da locadora (entities/assinatura). O barril do app a reexporta; prova abaixo.
  '/api/admin/badges': 'painel',
  '/api/admin/financial/aging': 'painel',
  '/api/admin/subscription': 'painel',
  '/api/admin/subscription/invoices': 'painel',
}

/**
 * Entradas da allowlist sem chamador no código do frontend, cada uma com o motivo. Só entram aqui padrões que existem
 * na allowlist e que nenhuma chamada coletada cobre (o teste falha nos dois casos contrários).
 */
const INFRA: Record<string, string> = {
  '/api/health': 'verificação de saúde do monitoramento pela origem pública do host',
  '/api/auth/callback/*/oauth-proxy':
    'conclusão do oauth-proxy: o app redireciona o navegador ao host de origem, que cria a sessão (T10)',
  '/api/auth/v2/callback/*/oauth-proxy': 'conclusão do oauth-proxy no basePath do modo better-auth-v2 (T10)',
  '/api/auth/verify-email': 'link do e-mail de verificação, montado na origem do host (factory.ts)',
}

/** Casca do painel (layout do grupo (admin) do host `app`), reexportada pelo barril @gb-locacoes/frontend/app. */
const PANEL_SHELL = path.join(repoRoot, 'packages', 'frontend', 'src', 'app', 'providers', 'AdminLayoutShell.web.tsx')
/** Chamadas que o grafo do host de locadora só alcança pela casca do painel (menu lateral: selos e assinatura). */
const PANEL_SHELL_CALLS = [
  '/api/admin/badges',
  '/api/admin/financial/aging',
  '/api/admin/subscription',
  '/api/admin/subscription/invoices',
]

// O gateway server-only lê o backend direto (WEB_API_ORIGIN), sem passar pelo proxy do host.
const SERVER_ONLY_DIR = path.join(webSrc, 'host', 'server')

function resolveFile(base: string): string | null {
  for (const candidate of [base, base + '.tsx', base + '.ts', base + '.js', path.join(base, 'index.tsx'), path.join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

function resolveImport(from: string, specifier: string): string | null {
  if (specifier.startsWith('.')) return resolveFile(path.resolve(path.dirname(from), specifier))
  const entry = PACKAGE_ENTRIES[specifier]
  if (entry) return path.join(repoRoot, entry)
  for (const [prefix, target] of Object.entries(PACKAGE_PREFIXES)) {
    if (specifier.startsWith(prefix)) {
      const page = specifier.slice(prefix.length)
      if (page === 'playground') return path.join(repoRoot, target, page, 'index.ts')
      return resolveFile(path.join(repoRoot, target, page, 'index'))
    }
  }
  return null
}

const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g
const API_RE = /['"`](\/api\/[^'"`?#\s]*)/g
// Métodos do cliente Better Auth (better-auth/react): `authClient.signIn.email(` → `/sign-in/email`.
const AUTH_CLIENT_CALL_RE = /\bauthClient\.([A-Za-z]+(?:\.[A-Za-z]+)*)\s*\(/g
const AUTH_BASE_RE = /['"](\/api\/auth(?:\/v2)?)['"]/g

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase())

type Calls = Map<string, Set<string>>

function add(calls: Calls, call: string, file: string) {
  if (!calls.has(call)) calls.set(call, new Set())
  calls.get(call)!.add(path.relative(repoRoot, file).split(path.sep).join('/'))
}

/** Grafo de imports a partir de `entries`; os arquivos de `cut` ficam fora (nem entram nem são seguidos). */
function walk(
  entries: string[],
  cut: ReadonlySet<string> = new Set()
): { files: Set<string>; calls: Calls; authClientCalls: Calls } {
  const files = new Set<string>()
  const calls: Calls = new Map()
  const authClientCalls: Calls = new Map()
  const queue = [...entries]
  while (queue.length > 0) {
    const file = queue.pop()!
    if (files.has(file) || cut.has(file) || /\.(test|spec)\.[jt]sx?$/.test(file)) continue
    files.add(file)
    const code = stripComments(readFileSync(file, 'utf8'))
    for (const match of code.matchAll(IMPORT_RE)) {
      const target = resolveImport(file, match[1]!)
      if (target && /\.[jt]sx?$/.test(target)) queue.push(target)
    }
    if (file.startsWith(SERVER_ONLY_DIR + path.sep)) continue
    // Cliente Better Auth: cada método vira o endpoint em cada basePath do cliente. Quem usa a regra única
    // (betterAuthBasePath de @gb-locacoes/contracts/platform) chama o basePath do modo, um dos da plataforma; sem a
    // regra, valem os basePath declarados no mesmo arquivo.
    const bases: string[] = !/\bauthClient\b/.test(code)
      ? []
      : /\bbetterAuthBasePath\s*\(/.test(code)
        ? [...BETTER_AUTH_BASE_PATHS]
        : [...code.matchAll(AUTH_BASE_RE)].map((match) => match[1]!)
    for (const match of code.matchAll(AUTH_CLIENT_CALL_RE)) {
      const endpoint = match[1]!.split('.').map(kebab).join('/')
      for (const base of bases) add(authClientCalls, `${base}/${endpoint}`, file)
    }
    // getSession do next-auth/react (hostAuth no legacy) busca `${basePath}/session`, com o basePath padrão.
    if (/from\s*['"]next-auth\/react['"]/.test(code) && /\bgetSession\s*\(/.test(code)) add(calls, '/api/auth/session', file)
    for (const match of code.matchAll(API_RE)) {
      // Cada `${...}` vira um segmento qualquer; uma expressão cortada no meio encerra o caminho.
      const call = match[1]!.replace(/\$\{[^}]*\}/g, 'x').replace(/\$\{.*$/, 'x').replace(/\/$/, '')
      // `'/api/'` sozinho é teste de prefixo (ex.: withPublicTenant), não chamada; basePath do cliente também não.
      if (call === '/api' || bases.includes(call)) continue
      add(calls, call, file)
    }
  }
  return { files, calls, authClientCalls }
}

function tenantEntries(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return tenantEntries(full)
    return /\.(tsx|ts)$/.test(name) ? [full] : []
  })
}

/** Caminho concreto de um padrão (`*` e `**` viram segmentos quaisquer). */
const concrete = (pattern: PathPattern) => pattern.replace(/\/\*\*$/, '/x').replace(/\*/g, 'x')

const env = resolvePlatformEnv({
  PLATFORM_ENV: 'production',
  PLATFORM_ROOT_DOMAIN: 'plataforma.example',
  PLATFORM_EDGE_SECRET: 'x'.repeat(32),
  WEB_API_ORIGIN: 'https://backend.example',
})
const on = (host: string, pathname: string, authMode: HostAuthMode) =>
  decide({ ...env, authMode }, classifyHost(host, env), { pathname, search: '', method: 'POST' })

/** Os três modos do host web; os dois primeiros têm login por subdomínio (Better Auth). */
const ACCOUNT_MODES: readonly HostAuthMode[] = ['better-auth', 'better-auth-v2']
const MODES: readonly HostAuthMode[] = [...ACCOUNT_MODES, 'legacy']
/** Toda entrada de conta de algum modo, sem repetição (as rotas próprias valem nos dois). */
const ACCOUNT_PATTERNS = [...new Set(Object.values(TENANT_ACCOUNT_API).flat())]
/** `basePath` do Better Auth de uma chamada do cliente (`/api/auth/v2/...` ou `/api/auth/...`). */
const baseOf = (call: string) => (call.startsWith('/api/auth/v2/') ? '/api/auth/v2' : '/api/auth')

describe('allowlist de API do host de locadora x chamadas das páginas de cliente', () => {
  const { files, calls, authClientCalls } = walk(tenantEntries(tenantTree))
  const allCalls = [...calls.keys(), ...authClientCalls.keys()]
  const patterns = [...TENANT_API_ALLOWLIST, ...ACCOUNT_PATTERNS]

  it('o grafo alcança as páginas, o shell, o carrossel 3D e o cliente de autenticação do host', () => {
    const rel = [...files].map((file) => path.relative(repoRoot, file).split(path.sep).join('/'))
    expect(rel).toContain('packages/frontend/src/app/providers/ClientLayoutShell.web.tsx')
    expect(rel).toContain('packages/frontend/src/pages/orcamento/ui/QuoteForm.web.tsx')
    expect(rel.some((file) => file.startsWith('packages/frontend/src/widgets/hero/'))).toBe(true)
    expect(calls.size).toBeGreaterThan(10)
    // Os quatro métodos do hostAuth, nos dois basePath do Better Auth.
    expect([...authClientCalls.keys()].sort()).toEqual(
      BETTER_AUTH_BASE_PATHS.flatMap((base) => ['get-session', 'sign-in/email', 'sign-in/social', 'sign-out'].map((endpoint) => `${base}/${endpoint}`)).sort()
    )
  })

  it('toda chamada /api das páginas de cliente passa no proxy (exceto as pendências listadas)', () => {
    // As chamadas literais valem em todo modo com login por subdomínio (o basePath do Better Auth fica no cliente).
    const blocked = [...calls.keys()]
      .filter((call) => isApiPath(call) && !ACCOUNT_MODES.every((mode) => isTenantApiAllowed(call, mode)))
      .sort()
    const report = blocked.map((call) => `${call} ← ${[...calls.get(call)!].join(', ')}`)
    const documented = { ...KNOWN_PENDING, ...PANEL_ONLY }
    expect(report.filter((line) => !(line.split(' ← ')[0]! in documented))).toEqual([])
    // Exceção que deixou de existir sai da lista junto.
    expect(blocked).toEqual(Object.keys(documented).sort())
  })

  // Achado 141: a casca do painel (AdminLayoutShell) é exportada pelo mesmo barril que o host de locadora importa
  // (@gb-locacoes/frontend/app), e o grafo, que segue todo reexport do barril, alcança as chamadas do menu lateral do
  // painel. Prova de que elas são só do painel: nenhum arquivo do grafo monta a casca (só o barril a cita) e, sem ela,
  // nenhuma dessas chamadas é alcançada; cada uma fica em PANEL_ONLY (negada no host de locadora).
  it('a casca do painel só entra no grafo pelo barril do app, e só por ela chegam as chamadas do menu do painel', () => {
    const rel = (file: string) => path.relative(repoRoot, file).split(path.sep).join('/')
    const citing = [...files]
      .filter((file) => /\bAdminLayoutShell\b/.test(stripComments(readFileSync(file, 'utf8'))))
      .map(rel)
      .sort()
    expect(citing).toEqual([
      'packages/frontend/src/app/index.web.ts',
      'packages/frontend/src/app/providers/AdminLayoutShell.web.tsx',
    ])
    const withoutShell = walk(tenantEntries(tenantTree), new Set([PANEL_SHELL]))
    for (const call of PANEL_SHELL_CALLS) {
      expect(calls.has(call), call).toBe(true)
      expect(withoutShell.calls.has(call), call).toBe(false)
      expect(PANEL_ONLY[call], call).toBeDefined()
      for (const mode of MODES) expect(isTenantApiAllowed(call, mode), `${mode} ${call}`).toBe(false)
    }
  })

  it('o cliente Better Auth do host passa só no basePath do modo e fica fechado no modo legacy', () => {
    for (const call of authClientCalls.keys()) {
      for (const mode of MODES) {
        expect(isTenantApiAllowed(call, mode), `${mode} ${call}`).toBe(betterAuthBasePath(mode) === baseOf(call))
      }
    }
    // A sessão do NextAuth (hostAuth no legacy) passa em todos os modos.
    for (const mode of MODES) expect(isTenantApiAllowed('/api/auth/session', mode)).toBe(true)
  })

  it('as chamadas críticas estão na allowlist (carrossel, catálogo, orçamento, frete e área do cliente)', () => {
    // Onda 134: os Termos da locadora no diálogo do orçamento e as páginas legais lidas no navegador.
    for (const call of ['/api/drei-proxy/x', '/api/equipments', '/api/categories', '/api/orcamentos', '/api/integrations/melhor-envio/calculate', '/api/client/rentals', '/api/contracts/x/download', '/api/settings/public/legal-documents/x']) {
      expect([...calls.keys()]).toContain(call)
      expect(isTenantApiAllowed(call, 'legacy')).toBe(true)
    }
  })

  it('nenhuma entrada da allowlist fica sem motivo: toda entrada tem chamador ou é infraestrutura declarada', () => {
    const withoutCaller = patterns.filter((pattern) => !allCalls.some((call) => matchesPattern(call, pattern)))
    // Entrada sem chamador e sem motivo: larga demais ou morta.
    expect(withoutCaller.filter((pattern) => !(pattern in INFRA))).toEqual([])
    // Motivo de infraestrutura só para entrada que existe e que ninguém chama (senão o motivo é a chamada).
    expect(Object.keys(INFRA).sort()).toEqual([...withoutCaller].sort())
    for (const reason of Object.values(INFRA)) expect(reason.length).toBeGreaterThan(20)
  })

  it('a injeção de tenantSlug só lista GETs públicos que a allowlist deixa passar', () => {
    for (const pattern of PUBLIC_TENANT_QUERY_ROUTES) expect(TENANT_API_ALLOWLIST, pattern).toContain(pattern)
  })

  it('entrada e conta do cliente só fora do legacy; nada da API de conta na allowlist geral', () => {
    expect(TENANT_ACCOUNT_API.legacy).toEqual([])
    for (const mode of ACCOUNT_MODES) {
      for (const pattern of TENANT_ACCOUNT_API[mode]) {
        expect(isTenantApiAllowed(concrete(pattern), mode), `${mode} ${pattern}`).toBe(true)
        expect(isTenantApiAllowed(concrete(pattern), 'legacy'), pattern).toBe(false)
        expect(isTenantApiAllowed(concrete(pattern), undefined), pattern).toBe(false)
      }
    }
    // Da API de autenticação, a allowlist geral tem só a sessão do NextAuth.
    expect(TENANT_API_ALLOWLIST.filter((pattern) => pattern.startsWith('/api/auth'))).toEqual(['/api/auth/session'])
    expect(patterns.filter((pattern) => pattern.includes('**') && pattern.startsWith('/api/auth'))).toEqual([])
  })
})

describe('API de conta do Better Auth só no host app (V26)', () => {
  const accountApi = [
    'list-sessions',
    'revoke-session',
    'revoke-sessions',
    'revoke-other-sessions',
    'update-session',
    'list-accounts',
    'account-info',
    'update-user',
    'change-email',
    'change-password',
    'delete-user',
    'link-social',
    'unlink-account',
    'get-access-token',
    'refresh-token',
    'callback/google',
    'oauth-proxy-callback',
  ]

  it('negada no host de locadora em todos os modos e nos dois basePath; repassada ao backend no host app', () => {
    for (const base of BETTER_AUTH_BASE_PATHS) {
      for (const endpoint of accountApi) {
        const pathname = `${base}/${endpoint}`
        for (const mode of MODES) {
          expect(isTenantApiAllowed(pathname, mode), `${mode} ${pathname}`).toBe(false)
          expect(on('locadora-a.plataforma.example', pathname, mode), `${mode} ${pathname}`).toMatchObject({ type: 'respond', status: 404 })
          expect(on('app.plataforma.example', pathname, mode), `${mode} ${pathname}`).toMatchObject({ type: 'backend', pathname })
        }
      }
    }
  })

  it('a denylist vence qualquer padrão da allowlist e cobre os vínculos com outras locadoras', () => {
    for (const pattern of TENANT_API_DENYLIST) {
      for (const mode of MODES) expect(isTenantApiAllowed(concrete(pattern), mode), `${mode} ${pattern}`).toBe(false)
    }
    for (const mode of ACCOUNT_MODES) {
      expect(isTenantApiAllowed('/api/auth/organizations', mode)).toBe(false)
      expect(isTenantApiAllowed('/api/auth/organizations/selection', mode)).toBe(false)
      expect(isTenantApiAllowed('/api/auth/organizations/current', mode)).toBe(true)
    }
    // A conclusão do oauth-proxy tem um segmento a mais que o callback do provedor: não cai na negação, e só passa no
    // basePath do modo (em /api/auth, no better-auth-v2, ela seria o callback do NextAuth).
    expect(isTenantApiAllowed('/api/auth/callback/google/oauth-proxy', 'better-auth')).toBe(true)
    expect(isTenantApiAllowed('/api/auth/v2/callback/google/oauth-proxy', 'better-auth-v2')).toBe(true)
    for (const mode of MODES) expect(isTenantApiAllowed('/api/auth/callback/google', mode)).toBe(false)
  })
})
