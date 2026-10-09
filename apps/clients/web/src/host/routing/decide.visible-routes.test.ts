// As 52 URLs visíveis do host web existem no host certo, incluindo os recebimentos e a página de pausa (S13).
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  classifyHost,
  isTenantSlug,
  resolvePlatformEnv,
} from '@gb-locacoes/contracts/platform'
import { ADMIN_LOGIN_REDIRECT } from '@gb-locacoes/frontend/pages/admin-login'
import { resolveAuthCallbackRedirect } from '@gb-locacoes/frontend/pages/auth-callback'
import { PANEL_HOME } from '@gb-locacoes/frontend/pages/login'
import { decide } from './decide'

const repoRoot = path.resolve(__dirname, '../../../../../..')
const webSrc = path.join(repoRoot, 'apps', 'clients', 'web', 'src')

interface WebRoute {
  readonly file: string
  readonly host: 'tenant' | 'app' | 'apex'
  readonly url: string
  readonly groups: readonly string[]
}

const routes: WebRoute[] = JSON.parse(
  execFileSync(
    process.execPath,
    [
      path.join(repoRoot, 'tools', 'modernization-inventory.mjs'),
      '--web-routes',
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    }
  )
)

// Inventário de docs/architecture/adr-web-route-groups.md (47 páginas, uma URL cada) mais /vincular (H6) e /site-pausado
// (S13: destino do rewrite da vitrine em pausa; com o site no ar, 404), agora distribuído por host.
const TENANT = [
  '/',
  '/area-cliente',
  '/area-cliente/enderecos',
  '/area-cliente/historico',
  '/area-cliente/historico/[id]',
  '/area-cliente/notificacoes',
  '/area-cliente/perfil',
  '/auth/callback',
  '/cadastro',
  '/contato',
  '/cookies',
  '/entrar',
  '/equipamentos',
  '/equipamentos/[id]',
  '/login',
  '/orcamento',
  '/politica-devolucao',
  '/privacidade',
  '/recuperar-senha',
  '/reset-password',
  '/site-pausado',
  '/sobre',
  '/termos',
  '/vincular',
]
// /login no app é o login da equipe (mesma tela do login da locadora, retorno preso ao painel).
const APP_PANEL = [
  '/comecar',
  '/admin/assinatura',
  '/admin/recebimentos',
  '/admin',
  '/admin/categorias',
  '/admin/dashboard',
  '/admin/email',
  '/admin/equipamentos',
  '/admin/equipamentos/[id]',
  '/admin/equipamentos/[id]/editar',
  '/admin/equipamentos/novo',
  '/admin/financeiro',
  '/admin/login',
  '/admin/logistics',
  '/admin/maintenance',
  '/admin/orcamentos',
  '/admin/orcamentos/[id]',
  '/admin/permissions',
  '/admin/rentals',
  '/admin/settings',
  '/admin/whatsapp',
  '/auth/callback',
  '/login',
  '/recuperar-senha',
  '/reset-password',
]
const APP_LABS = [
  '/admin/teste-toast',
  '/catalog',
  '/equipamentos-scroll',
  '/grid-motion',
  '/playground',
  '/playground/icon-customization',
]
const APEX = ['/api-docs']

const urlsOn = (host: WebRoute['host']) =>
  routes
    .filter((route) => route.host === host)
    .map((route) => route.url)
    .sort()
const concrete = (url: string) => url.replace(/\[[^\]]+\]/g, 'x1')

const env = resolvePlatformEnv({
  PLATFORM_ENV: 'production',
  PLATFORM_ROOT_DOMAIN: 'plataforma.example',
  PLATFORM_EDGE_SECRET: 'x'.repeat(32),
  WEB_API_ORIGIN: 'https://backend.example',
})
const labsEnv = { ...env, labsEnabled: true }
const accountEnv = { ...env, authMode: 'better-auth' as const }
const at = (host: string, url: string, decideEnv = env) =>
  decide(decideEnv, classifyHost(host, env), {
    pathname: url,
    search: '',
    method: 'GET',
  })

/**
 * A página que o App Router casaria com o caminho interno (depois do rewrite): segmentos estáticos antes de
 * dinâmicos, como no Next. Devolve também o valor capturado por `[locadora]`, que o layout valida.
 */
function pageFor(
  internalPath: string
): { route: WebRoute; locadora: string | null } | undefined {
  const parts = internalPath.split('/').slice(1).filter(Boolean)
  const candidates = routes
    .map((route) => {
      const inner =
        route.host === 'tenant'
          ? ['[locadora]']
          : route.host === 'apex'
            ? ['plataforma']
            : []
      return {
        route,
        pattern: [...inner, ...route.url.split('/').slice(1).filter(Boolean)],
      }
    })
    .filter(
      ({ pattern }) =>
        pattern.length === parts.length &&
        pattern.every(
          (segment, index) =>
            segment.startsWith('[') || segment === parts[index]
        )
    )
    // Mais segmentos estáticos primeiro (prioridade do roteador).
    .sort(
      (a, b) =>
        b.pattern.filter((s) => !s.startsWith('[')).length -
        a.pattern.filter((s) => !s.startsWith('[')).length
    )
  const best = candidates[0]
  if (!best) return undefined
  return {
    route: best.route,
    locadora: best.pattern[0] === '[locadora]' ? (parts[0] ?? null) : null,
  }
}

/** O caminho interno abre conteúdo: casa uma página e, se for da árvore [locadora], com slug válido de locadora. */
function opensPage(internalPath: string): boolean {
  const page = pageFor(internalPath)
  if (!page) return false
  return page.locadora === null || isTenantSlug(page.locadora)
}

describe('URLs visíveis por host', () => {
  it('as 52 URLs existem e cada host tem as suas', () => {
    expect(urlsOn('tenant')).toEqual([...TENANT].sort())
    expect(urlsOn('app')).toEqual([...APP_PANEL, ...APP_LABS].sort())
    expect(urlsOn('apex')).toEqual(['/', ...APEX].sort())
    const union = new Set([...TENANT, ...APP_PANEL, ...APP_LABS, ...APEX])
    expect(union.size).toBe(52)
  })

  it('nenhuma URL é servida por dois arquivos no mesmo host', () => {
    const keys = routes.map((route) => route.host + ' ' + route.url)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('host de locadora: o proxy reescreve cada URL para a página da árvore [locadora]', () => {
    for (const url of TENANT) {
      const decision = at(
        'locadora-a.plataforma.example',
        concrete(url),
        accountEnv
      )
      expect(decision.type, url).toBe('rewrite')
      if (decision.type !== 'rewrite') continue
      expect(decision.pathname.startsWith('/locadora-a')).toBe(true)
      const page = pageFor(decision.pathname)
      expect(page?.route.host, url).toBe('tenant')
      expect(page?.route.url).toBe(url)
      expect(page?.locadora).toBe('locadora-a')
    }
  })

  it('host app: painel e fluxos da equipe seguem para next; laboratório só com a flag', () => {
    for (const url of APP_PANEL) {
      expect(at('app.plataforma.example', concrete(url)).type, url).toBe('next')
      expect(pageFor(concrete(url))?.route.host, url).toBe('app')
    }
    for (const url of APP_LABS) {
      expect(at('app.plataforma.example', concrete(url)).type, url).toBe(
        'respond'
      )
      expect(
        at('app.plataforma.example', concrete(url), labsEnv).type,
        url
      ).toBe('next')
    }
  })

  it('modo legacy: toda página dos grupos (auth) e (account) da locadora fica oculta no proxy', () => {
    const account = routes.filter(
      (route) =>
        route.host === 'tenant' &&
        route.groups.some(
          (group) => group === '(auth)' || group === '(account)'
        )
    )
    expect(account.length).toBe(13)
    for (const route of account) {
      expect(
        at('locadora-a.plataforma.example', concrete(route.url)).type,
        route.url
      ).toBe('respond')
    }
    for (const route of routes.filter(
      (item) => item.host === 'tenant' && !account.includes(item)
    )) {
      expect(
        at('locadora-a.plataforma.example', concrete(route.url)).type,
        route.url
      ).toBe('rewrite')
    }
  })

  it('apex: /api-docs chega à página da plataforma', () => {
    const decision = at('plataforma.example', '/api-docs')
    expect(decision).toEqual({
      type: 'rewrite',
      pathname: '/plataforma/api-docs',
      search: '',
    })
    expect(pageFor('/plataforma/api-docs')?.route.url).toBe('/api-docs')
  })

  it('URL de um host não abre a página de outro', () => {
    for (const url of TENANT.filter(
      (item) => !APP_PANEL.includes(item) && item !== '/'
    )) {
      expect(at('app.plataforma.example', concrete(url)).type, url).toBe(
        'respond'
      )
    }
    for (const url of [...APP_LABS, '/api-docs']) {
      const decision = at('locadora-a.plataforma.example', concrete(url))
      // /admin/teste-toast vai ao host app (308); os demais caem sob a locadora, onde não existem.
      expect(['rewrite', 'redirect']).toContain(decision.type)
      if (decision.type === 'rewrite')
        expect(opensPage(decision.pathname), url).toBe(false)
    }
    for (const url of APP_PANEL.filter((item) => item.startsWith('/admin'))) {
      expect(at('locadora-a.plataforma.example', concrete(url)).type, url).toBe(
        'redirect'
      )
    }
    for (const url of [...TENANT, ...APP_PANEL].filter(
      (item) => item !== '/'
    )) {
      const decision = at('plataforma.example', concrete(url))
      // /plataforma/area-cliente casa [locadora]=plataforma, mas "plataforma" é reservado: o layout dá notFound().
      if (decision.type === 'rewrite')
        expect(opensPage(decision.pathname), url).toBe(false)
    }
  })

  it('host app: todo destino de entrada e saída da equipe chega a uma página do app (achado 25)', () => {
    const frontend = path.join(repoRoot, 'packages', 'frontend', 'src')
    const source = (...parts: string[]) =>
      readFileSync(path.join(...parts), 'utf8')
    const literals = (code: string, pattern: RegExp) =>
      [...code.matchAll(pattern)].map((match) => match[1]!)
    const webFiles = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name)
        if (statSync(full).isDirectory()) return webFiles(full)
        return /\.web\.tsx$/.test(name) && !/\.test\./.test(name) ? [full] : []
      })
    const destinations = new Map<string, string>([
      [
        ADMIN_LOGIN_REDIRECT,
        'ADMIN_LOGIN_REDIRECT (/admin/login segue para o login)',
      ],
      [PANEL_HOME, 'destino padrão do login da equipe'],
      [
        resolveAuthCallbackRedirect({
          status: 'unauthenticated',
          hasUser: false,
          callbackUrl: null,
        })!,
        '/auth/callback sem sessão',
      ],
    ])
    const found = (label: string, values: string[]) => {
      expect(values.length, label).toBeGreaterThan(0)
      for (const value of values) destinations.set(value, label)
    }
    // "Entrar" e login automático da área privada (PrivateAreaGate, pela regra signInHref de features/entrar) e retorno
    // com erro do /auth/callback do host.
    found(
      'gate.signIn',
      literals(
        source(frontend, 'features', 'entrar', 'model', 'redirect.ts'),
        /export const SIGN_IN_PATH = ["']([^"']+)["']/g
      )
    )
    found(
      'AuthCallbackRoute',
      literals(
        source(webSrc, 'host', 'auth', 'AuthCallbackRoute.tsx'),
        /router\.replace\('([^']+)'\)/g
      )
    )
    // /admin sem sessão e "Sair" do painel.
    found(
      'resolveAdminIndexRedirect',
      literals(
        source(frontend, 'features', 'entrar-admin', 'model', 'redirect.ts'),
        /return "(\/[^"]+)"/g
      )
    )
    found(
      'signOut do painel',
      webFiles(path.join(frontend, 'widgets')).flatMap((file) =>
        literals(source(file), /signOut\(\{ callbackUrl: '([^']+)' \}\)/g)
      )
    )
    expect([...destinations.keys()].sort()).toEqual([
      '/admin',
      '/admin/dashboard',
      '/admin/login',
      '/login',
    ])
    for (const [url, origin] of destinations) {
      expect(at('app.plataforma.example', url).type, `${url} ← ${origin}`).toBe(
        'next'
      )
      expect(pageFor(url)?.route.host, `${url} ← ${origin}`).toBe('app')
    }
    // O login da equipe é a página do app, não a da locadora.
    expect(pageFor('/login')?.route.file).toMatch(
      /app\/\(auth\)\/login\/page\.tsx$/
    )
  })

  it('acesso direto ao segmento interno de outra locadora não abre conteúdo dela', () => {
    const decision = at(
      'locadora-a.plataforma.example',
      '/locadora-b/equipamentos'
    )
    expect(decision).toEqual({
      type: 'rewrite',
      pathname: '/locadora-a/locadora-b/equipamentos',
      search: '',
    })
    if (decision.type === 'rewrite')
      expect(pageFor(decision.pathname)).toBeUndefined()
  })
})
