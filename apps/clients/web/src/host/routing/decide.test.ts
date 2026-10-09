// T3 e T4 da ADR docs/architecture/adr-tenant-hosts.md (seção 4.13): tabela 4.2 do proxy e matcher.
import { NextRequest, type NextResponse } from 'next/server'
import {
  getRedirectUrl,
  getRewrittenUrl,
  isRewrite,
  unstable_doesMiddlewareMatch,
} from 'next/experimental/testing/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PLATFORM_EDGE_HEADERS,
  resolvePlatformEnv,
} from '@gb-locacoes/contracts/platform'
import { config } from '../../proxy'
import { canonicalPathname, decide, withoutCookie } from './decide'
import { createPlatformProxy, type ProxyEnv } from './platform-proxy'

const SECRET = 'segredo-de-borda-de-teste-com-mais-de-32-caracteres'
const prodEnv = resolvePlatformEnv({
  PLATFORM_ENV: 'production',
  PLATFORM_ROOT_DOMAIN: 'plataforma.example',
  PLATFORM_EDGE_SECRET: SECRET,
  WEB_API_ORIGIN: 'https://backend.example',
})
const devEnv = resolvePlatformEnv({
  PLATFORM_ENV: 'development',
  PLATFORM_ROOT_DOMAIN: 'localhost',
  PLATFORM_PUBLIC_PORT: '3001',
  PLATFORM_EDGE_SECRET: SECRET,
  WEB_API_ORIGIN: 'http://127.0.0.1:3000',
  PLATFORM_LABS_ENABLED: 'true',
})

const A = 'https://locadora-a.plataforma.example'
const APP = 'https://app.plataforma.example'
const APEX = 'https://plataforma.example'

function run(
  env: ProxyEnv | null,
  url: string,
  init: { method?: string; headers?: Record<string, string> } = {}
): NextResponse {
  // Sem leitor do modo do site (S13), a resposta é síncrona.
  const handler = createPlatformProxy(() => env) as (request: NextRequest) => NextResponse
  return handler(
    new NextRequest(url, {
      method: init.method ?? 'GET',
      headers: { host: new URL(url).host, ...init.headers },
    })
  )
}
const prod = (
  url: string,
  init?: { method?: string; headers?: Record<string, string> }
) => run(prodEnv, url, init)

/** Cabeçalhos que o Next repassa ao destino depois do proxy (lista de sobrescrita + valores). */
function forwarded(response: NextResponse): Map<string, string> {
  const names = (response.headers.get('x-middleware-override-headers') ?? '')
    .split(',')
    .filter(Boolean)
  return new Map(
    names.map((name) => [
      name,
      response.headers.get('x-middleware-request-' + name) ?? '',
    ])
  )
}

function expectRewrite(response: NextResponse, target: string) {
  expect(isRewrite(response)).toBe(true)
  expect(getRewrittenUrl(response)).toBe(target)
}

function expectNext(response: NextResponse) {
  expect(response.headers.get('x-middleware-next')).toBe('1')
  expect(isRewrite(response)).toBe(false)
}

async function expectJson(
  response: NextResponse,
  status: number,
  body: unknown
) {
  expect(response.status).toBe(status)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual(body)
}

const API_NOT_FOUND = {
  error: 'Not Found',
  message: 'Endpoint não encontrado',
  code: 'NOT_FOUND',
}
const CONFLICT = {
  error: 'Seleção de locadora conflitante',
  code: 'TENANT_CONFLICT',
}

async function expectPageNotFound(response: NextResponse) {
  expect(response.status).toBe(404)
  expect(response.headers.get('x-robots-tag')).toContain('noindex')
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.text()).toContain('Página não encontrada')
}

describe('T3: host de locadora', () => {
  it('reescreve toda página para o segmento da locadora do Host', () => {
    expectRewrite(prod(A + '/'), A + '/locadora-a')
    expectRewrite(
      prod(A + '/equipamentos/eq1?x=1'),
      A + '/locadora-a/equipamentos/eq1?x=1'
    )
    // Acesso direto ao segmento de outra locadora fica preso sob a do Host (não existe → 404).
    expectRewrite(
      prod(A + '/locadora-b/equipamentos'),
      A + '/locadora-a/locadora-b/equipamentos'
    )
    expectRewrite(
      prod(A + '/b/equipamentos/x.png'),
      A + '/locadora-a/b/equipamentos/x.png'
    )
    expectRewrite(prod(A + '/plataforma'), A + '/locadora-a/plataforma')
  })

  it('a locadora vem só do Host: nem a URL, nem x-forwarded-host, nem cabeçalhos de borda forjados a trocam', () => {
    const response = prod(A + '/equipamentos', {
      headers: {
        'x-forwarded-host': 'locadora-b.plataforma.example',
        'x-platform-tenant-slug': 'locadora-b',
        'x-platform-edge-auth': SECRET,
      },
    })
    expectRewrite(response, A + '/locadora-a/equipamentos')
    const headers = forwarded(response)
    for (const name of PLATFORM_EDGE_HEADERS)
      expect(headers.has(name)).toBe(false)
  })

  it('/admin vai para o painel no host app com a locadora como sugestão', () => {
    const response = prod(A + '/admin/orcamentos?status=novo')
    expect(response.status).toBe(308)
    expect(getRedirectUrl(response)).toBe(
      APP + '/admin/orcamentos?status=novo&locadora=locadora-a'
    )
    expect(getRedirectUrl(prod(A + '/admin'))).toBe(
      APP + '/admin?locadora=locadora-a'
    )
  })

  it('?tenantSlug igual ao host: 308 sem o parâmetro; diferente: 404 neutro', async () => {
    const same = prod(A + '/equipamentos?categoria=x&tenantSlug=locadora-a')
    expect(same.status).toBe(308)
    expect(getRedirectUrl(same)).toBe(A + '/equipamentos?categoria=x')
    await expectPageNotFound(prod(A + '/equipamentos?tenantSlug=locadora-b'))
    await expectPageNotFound(
      prod(A + '/?tenantSlug=locadora-a&tenantSlug=locadora-b')
    )
  })

  it('entradas de public/ seguem para next, exceto robots.txt, sitemap.xml e manifest.json', () => {
    expectNext(prod(A + '/favicon.ico'))
    expectNext(prod(A + '/openapi.json'))
    expectNext(prod(A + '/GB%20Loca%C3%A7%C3%B5es.png'))
    expectRewrite(prod(A + '/robots.txt'), A + '/locadora-a/robots.txt')
    expectRewrite(prod(A + '/sitemap.xml'), A + '/locadora-a/sitemap.xml')
    expectRewrite(prod(A + '/manifest.json'), A + '/locadora-a/manifest.json')
  })

  it('modo legacy: login e área do cliente respondem 404 antes de renderizar; com Better Auth são reescritos', async () => {
    for (const path of [
      '/entrar',
      '/login',
      '/cadastro',
      '/recuperar-senha',
      '/reset-password',
      '/auth/callback',
      '/area-cliente',
      '/area-cliente/historico/r1',
      '/vincular',
    ]) {
      await expectPageNotFound(prod(A + path))
      for (const authMode of ['better-auth', 'better-auth-v2'] as const) {
        expectRewrite(
          run({ ...prodEnv, authMode }, A + path),
          A + '/locadora-a' + path
        )
      }
      await expectPageNotFound(
        run({ ...prodEnv, authMode: 'legacy' }, A + path)
      )
    }
    // Vitrine, cotação anônima e contato continuam.
    for (const path of ['/orcamento', '/contato', '/equipamentos'])
      expectRewrite(prod(A + path), A + '/locadora-a' + path)
    // A API de sessão continua acessível (o shell consulta a sessão em qualquer modo).
    expectRewrite(
      prod(A + '/api/auth/session'),
      'https://backend.example/api/auth/session'
    )
  })

  it('caminhos internos do Next passam sem reescrita', () => {
    expectNext(prod(A + '/_next/webpack-hmr'))
    expectNext(prod(A + '/__nextjs_original-stack-frames'))
  })
})

describe('T3: APIs no host de locadora', () => {
  it('API permitida segue ao backend com a borda da locadora e tenantSlug injetado nas GETs públicas', () => {
    const response = prod(A + '/api/equipamentos/search?q=betoneira', {
      headers: {
        'x-platform-host-kind': 'app',
        'x-platform-tenant-slug': 'locadora-b',
        'x-platform-edge-auth': 'forjado',
        'x-real-ip': '203.0.113.9',
      },
    })
    expectRewrite(
      response,
      'https://backend.example/api/equipamentos/search?q=betoneira&tenantSlug=locadora-a'
    )
    const headers = forwarded(response)
    expect(headers.get('x-platform-edge-auth')).toBe(SECRET)
    expect(headers.get('x-platform-host-kind')).toBe('tenant')
    expect(headers.get('x-platform-tenant-slug')).toBe('locadora-a')
    expect(headers.get('x-platform-origin')).toBe(A)
    expect(headers.get('x-platform-client-ip')).toBe('203.0.113.9')
  })

  it('documento legal da vitrine (onda 134): a GET sem tenantSlug segue ao backend com o da locadora do host', () => {
    expectRewrite(
      prod(A + '/api/settings/public/legal-documents/terms'),
      'https://backend.example/api/settings/public/legal-documents/terms?tenantSlug=locadora-a'
    )
  })

  it('tenantSlug igual ao host é mantido; diferente responde 400 TENANT_CONFLICT sem chegar ao backend', async () => {
    expectRewrite(
      prod(A + '/api/equipments?tenantSlug=locadora-a'),
      'https://backend.example/api/equipments?tenantSlug=locadora-a'
    )
    await expectJson(
      prod(A + '/api/equipments?tenantSlug=locadora-b'),
      400,
      CONFLICT
    )
    await expectJson(
      prod(A + '/api/quotes?tenantSlug=locadora-b', { method: 'POST' }),
      400,
      CONFLICT
    )
    await expectJson(
      prod(A + '/api/categories?tenantSlug=locadora-a&tenantSlug=locadora-b'),
      400,
      CONFLICT
    )
  })

  it('detalhe público usa a locadora do host sem liberar subrotas administrativas ou internas', async () => {
    const detail = prod(A + '/api/equipments/eq1')
    expectRewrite(
      detail,
      'https://backend.example/api/equipments/eq1?tenantSlug=locadora-a'
    )
    expect(forwarded(detail).get('x-platform-tenant-slug')).toBe('locadora-a')
    expectRewrite(
      prod(A + '/api/equipments/eq1?tenantSlug=locadora-a'),
      'https://backend.example/api/equipments/eq1?tenantSlug=locadora-a'
    )
    await expectJson(
      prod(A + '/api/equipments/eq1?tenantSlug=locadora-b'),
      400,
      CONFLICT
    )
    for (const path of [
      '/api/admin/equipments/eq1',
      '/api/equipments/eq1/units',
      '/api/equipments/eq1/internal',
      '/api/internal/equipments/eq1',
    ]) {
      await expectJson(prod(A + path), 404, API_NOT_FOUND)
    }
  })

  it('POST não recebe tenantSlug injetado; o cookie de seleção sai e os demais ficam', () => {
    const response = prod(A + '/api/quotes', {
      method: 'POST',
      headers: {
        cookie: 'a=1; selected-tenant-id=tenant-b; locadora.session_token=abc',
      },
    })
    expectRewrite(response, 'https://backend.example/api/quotes')
    expect(forwarded(response).get('cookie')).toBe(
      'a=1; locadora.session_token=abc'
    )
    const onlySelection = prod(A + '/api/client/rentals', {
      headers: { cookie: 'selected-tenant-id=tenant-b' },
    })
    expect(forwarded(onlySelection).has('cookie')).toBe(false)
  })

  it('allowlist: organizações do usuário, painel e demais APIs ficam fora; /current, drei-proxy e auth passam', async () => {
    const account = (url: string, init?: { method?: string }) =>
      run({ ...prodEnv, authMode: 'better-auth' }, url, init)
    await expectJson(account(A + '/api/auth/organizations'), 404, API_NOT_FOUND)
    await expectJson(
      account(A + '/api/auth/organizations/selection', { method: 'POST' }),
      404,
      API_NOT_FOUND
    )
    await expectJson(prod(A + '/api/admin/equipments'), 404, API_NOT_FOUND)
    await expectJson(
      prod(A + '/api/upload', { method: 'POST' }),
      404,
      API_NOT_FOUND
    )
    await expectJson(prod(A + '/api'), 404, API_NOT_FOUND)
    await expectJson(
      prod(A + '/api/public/tenants/locadora-b'),
      404,
      API_NOT_FOUND
    )
    expectRewrite(
      account(A + '/api/auth/organizations/current'),
      'https://backend.example/api/auth/organizations/current'
    )
    expectRewrite(
      prod(A + '/api/auth/session'),
      'https://backend.example/api/auth/session'
    )
    expectRewrite(
      prod(A + '/api/drei-proxy/assets/model.glb'),
      'https://backend.example/api/drei-proxy/assets/model.glb'
    )
    expectRewrite(prod(A + '/api/health'), 'https://backend.example/api/health')
  })

  it('API de conta: a entrada do cliente só com login por subdomínio; sessões, perfil e exclusão só no app', async () => {
    const account = (url: string, init?: { method?: string }) =>
      run({ ...prodEnv, authMode: 'better-auth' }, url, init)
    for (const path of [
      '/api/auth/get-session',
      '/api/auth/sign-in/email',
      '/api/auth/sign-out',
      '/api/auth/callback/google/oauth-proxy',
      '/api/auth/register',
      '/api/auth/organizations/current',
    ]) {
      await expectJson(prod(A + path, { method: 'POST' }), 404, API_NOT_FOUND)
      expectRewrite(
        account(A + path, { method: 'POST' }),
        'https://backend.example' + path
      )
    }
    for (const path of [
      '/api/auth/list-sessions',
      '/api/auth/revoke-sessions',
      '/api/auth/update-user',
      '/api/auth/delete-user',
      '/api/auth/v2/list-sessions',
      '/api/auth/callback/google',
    ]) {
      await expectJson(
        account(A + path, { method: 'POST' }),
        404,
        API_NOT_FOUND
      )
      expectRewrite(
        prod(APP + path, { method: 'POST' }),
        'https://backend.example' + path
      )
    }
  })

  it('API de conta por modo: a entrada do cliente só no basePath do Better Auth do modo, nunca no NextAuth (achado 9)', async () => {
    const at = (
      authMode: 'legacy' | 'better-auth' | 'better-auth-v2',
      path: string
    ) => run({ ...prodEnv, authMode }, A + path, { method: 'POST' })
    // better-auth-v2: /api/auth/* é o NextAuth (backend em AUTH_MODE=legacy); a entrada do cliente fica em /api/auth/v2.
    for (const path of [
      '/api/auth/v2/get-session',
      '/api/auth/v2/sign-in/email',
      '/api/auth/v2/callback/google/oauth-proxy',
      '/api/auth/register',
      '/api/auth/organizations/current',
    ]) {
      expectRewrite(
        at('better-auth-v2', path),
        'https://backend.example' + path
      )
    }
    // O callback de credenciais do NextAuth com um segmento a mais (o NextAuth ignora o resto) não passa em nenhum
    // modo em que /api/auth é o NextAuth; nem a entrada do Better Auth fora do basePath do modo.
    for (const path of [
      '/api/auth/callback/credentials/oauth-proxy',
      '/api/auth/callback/google/oauth-proxy',
      '/api/auth/get-session',
      '/api/auth/sign-in/email',
      '/api/auth/sign-out',
    ]) {
      await expectJson(at('better-auth-v2', path), 404, API_NOT_FOUND)
      await expectJson(at('legacy', path), 404, API_NOT_FOUND)
    }
    for (const path of [
      '/api/auth/v2/get-session',
      '/api/auth/v2/callback/google/oauth-proxy',
    ]) {
      await expectJson(at('better-auth', path), 404, API_NOT_FOUND)
      await expectJson(at('legacy', path), 404, API_NOT_FOUND)
    }
  })

  it('codificação não contorna a allowlist nem a negação', async () => {
    await expectJson(prod(A + '/api/auth/%6frganizations'), 404, API_NOT_FOUND)
    await expectJson(prod(A + '/api/quotes%2F..%2Fadmin'), 404, API_NOT_FOUND)
    await expectJson(prod(A + '/api/%E0%A4%A'), 404, API_NOT_FOUND)
    expect(getRedirectUrl(prod(A + '/%61dmin'))).toBe(
      APP + '/admin?locadora=locadora-a'
    )
  })
})

describe('T3: host app', () => {
  it('painel e fluxos da equipe seguem para next; demais páginas 404', async () => {
    expectNext(prod(APP + '/admin'))
    expectNext(prod(APP + '/admin/orcamentos/q1'))
    expectNext(prod(APP + '/admin/login'))
    // Login da equipe (achado 25): antes respondia o 404 neutro e o painel ficava sem entrada.
    expectNext(prod(APP + '/login?callbackUrl=%2Fadmin%2Frentals'))
    await expectPageNotFound(prod(APP + '/entrar'))
    await expectPageNotFound(prod(APP + '/cadastro'))
    expectNext(prod(APP + '/recuperar-senha'))
    expectNext(prod(APP + '/reset-password?token=x'))
    expectNext(prod(APP + '/auth/callback'))
    expectNext(prod(APP + '/favicon.ico'))
    await expectPageNotFound(prod(APP + '/equipamentos'))
    await expectPageNotFound(prod(APP + '/locadora-a/equipamentos'))
    await expectPageNotFound(prod(APP + '/area-cliente'))
  })

  it('/ vai para /admin (307) e robots.txt nega tudo', async () => {
    const root = prod(APP + '/')
    expect(root.status).toBe(307)
    expect(getRedirectUrl(root)).toBe(APP + '/admin')
    const robots = prod(APP + '/robots.txt')
    expect(robots.status).toBe(200)
    expect(await robots.text()).toBe('User-agent: *\nDisallow: /\n')
  })

  it('laboratório só com PLATFORM_LABS_ENABLED fora de produção, inclusive /admin/teste-toast', async () => {
    await expectPageNotFound(prod(APP + '/catalog'))
    await expectPageNotFound(prod(APP + '/admin/teste-toast'))
    await expectPageNotFound(prod(APP + '/playground/icon-customization'))
    expectNext(run(devEnv, 'http://app.localhost:3001/catalog'))
    expectNext(run(devEnv, 'http://app.localhost:3001/admin/teste-toast'))
  })

  it('todo /api segue ao backend com borda app e sem slug de locadora, mesmo forjado', () => {
    const response = prod(APP + '/api/admin/equipments', {
      headers: {
        'x-platform-tenant-slug': 'locadora-b',
        'x-tenant-id': 'tenant-a',
        cookie: 'selected-tenant-id=tenant-a',
      },
    })
    expectRewrite(response, 'https://backend.example/api/admin/equipments')
    const headers = forwarded(response)
    expect(headers.get('x-platform-host-kind')).toBe('app')
    expect(headers.get('x-platform-origin')).toBe(APP)
    expect(headers.has('x-platform-tenant-slug')).toBe(false)
    expect(headers.get('x-tenant-id')).toBe('tenant-a')
    expect(headers.get('cookie')).toBe('selected-tenant-id=tenant-a')
    // O mobile continua com tenantSlug explícito no host app; nada é injetado nem negado aqui.
    expectRewrite(
      prod(APP + '/api/equipments?tenantSlug=locadora-b'),
      'https://backend.example/api/equipments?tenantSlug=locadora-b'
    )
  })
})

describe('T3: apex', () => {
  it('páginas vão para /plataforma; /a vira /plataforma/a (inexistente → 404)', () => {
    expectRewrite(prod(APEX + '/'), APEX + '/plataforma')
    expectRewrite(prod(APEX + '/a'), APEX + '/plataforma/a')
    expectRewrite(
      prod(APEX + '/locadora-a/equipamentos'),
      APEX + '/plataforma/locadora-a/equipamentos'
    )
    expectRewrite(prod(APEX + '/robots.txt'), APEX + '/plataforma/robots.txt')
    expectRewrite(
      prod(APEX + '/l/locadora-a/equipamentos'),
      APEX + '/plataforma/l/locadora-a/equipamentos'
    )
    expectRewrite(
      prod(APEX + '/.well-known/apple-app-site-association'),
      APEX + '/plataforma/well-known/apple-app-site-association'
    )
    expectNext(prod(APEX + '/openapi.json'))
  })

  it('?tenantSlug válido: 308 para o host da locadora sem o parâmetro', () => {
    const response = prod(
      APEX + '/equipamentos?categoria=x&tenantSlug=locadora-a'
    )
    expect(response.status).toBe(308)
    expect(getRedirectUrl(response)).toBe(A + '/equipamentos?categoria=x')
    expectRewrite(
      prod(APEX + '/?tenantSlug=admin'),
      APEX + '/plataforma?tenantSlug=admin'
    )
  })

  it('só o diretório e o catálogo de planos públicos', async () => {
    const response = prod(APEX + '/api/public/tenants/locadora-a')
    expectRewrite(
      response,
      'https://backend.example/api/public/tenants/locadora-a'
    )
    expect(forwarded(response).get('x-platform-host-kind')).toBe('apex')
    expectRewrite(
      prod(APEX + '/api/public/tenants?q=abc'),
      'https://backend.example/api/public/tenants?q=abc'
    )
    await expectJson(
      prod(APEX + '/api/equipments?tenantSlug=locadora-a'),
      404,
      API_NOT_FOUND
    )
    await expectJson(prod(APEX + '/api/auth/session'), 404, API_NOT_FOUND)
  })
  it('o catálogo de planos tem caminho exato no apex e app, sem abrir o host de locadora', async () => {
    expectRewrite(
      prod(APEX + '/api/public/plans'),
      'https://backend.example/api/public/plans'
    )
    expectRewrite(
      prod('https://app.plataforma.example/api/public/plans'),
      'https://backend.example/api/public/plans'
    )
    await expectJson(
      prod(APEX + '/api/public/plans/private'),
      404,
      API_NOT_FOUND
    )
    await expectJson(
      prod('https://locadora-a.plataforma.example/api/public/plans'),
      404,
      API_NOT_FOUND
    )
  })
})

describe('T3: www, reservados e inválidos', () => {
  it('www responde 308 para o apex preservando caminho e query', () => {
    const response = prod('https://www.plataforma.example/equipamentos?x=1')
    expect(response.status).toBe(308)
    expect(getRedirectUrl(response)).toBe(APEX + '/equipamentos?x=1')
  })

  it.each([
    'https://api.plataforma.example/',
    'https://auth.plataforma.example/equipamentos',
    'https://a.b.plataforma.example/',
    'https://evil.example/',
    'https://1.2.3.4/',
    'https://x.plataforma.example/',
  ])('%s responde 404 neutro', async (url) => {
    await expectPageNotFound(prod(url))
  })

  it('API em host reservado responde 404 JSON', async () => {
    await expectJson(
      prod('https://api.plataforma.example/api/equipments'),
      404,
      API_NOT_FOUND
    )
  })
})

describe('T3: APIs negadas em qualquer host', () => {
  it.each([
    '/api/test-login',
    '/api/fix-storage',
    '/api/supabase-setup',
    '/api/cron/auto-convert-quotes',
    '/api/webhooks/whatsapp',
    '/api/payments/boleto/webhook',
    '/api/payments/pix/webhook/int-1',
    '/api/contracts/zapsign-webhook',
    '/api/contracts/zapsign-webhook/int-1',
    '/api/internal/revalidate',
    '/api/%74est-login',
  ])('%s', async (path) => {
    for (const origin of [A, APP, APEX])
      await expectJson(
        prod(origin + path, { method: 'POST' }),
        404,
        API_NOT_FOUND
      )
  })
})

describe('falha fechada', () => {
  it('ambiente inválido responde 503 sem repassar nada', async () => {
    const page = run(null, A + '/')
    expect(page.status).toBe(503)
    expect(isRewrite(page)).toBe(false)
    const api = run(null, A + '/api/equipments')
    expect(api.status).toBe(503)
    expect((await api.json()).code).toBe('PLATFORM_UNAVAILABLE')
  })

  it('sem segredo de borda (ou sem backend) nenhuma API é repassada; páginas seguem', async () => {
    const noSecret = resolvePlatformEnv({
      PLATFORM_ENV: 'development',
      WEB_API_ORIGIN: 'http://127.0.0.1:3000',
    })
    expect(
      (
        await run(
          noSecret,
          'http://locadora-a.localhost:3001/api/equipments'
        ).json()
      ).code
    ).toBe('PLATFORM_UNAVAILABLE')
    expectRewrite(
      run(noSecret, 'http://locadora-a.localhost:3001/sobre'),
      'http://locadora-a.localhost:3001/locadora-a/sobre'
    )
    const noBackend = resolvePlatformEnv({
      PLATFORM_ENV: 'development',
      PLATFORM_EDGE_SECRET: SECRET,
    })
    expect(run(noBackend, 'http://app.localhost:3001/api/health').status).toBe(
      503
    )
  })

  it('em desenvolvimento a origem da borda leva a porta pública', () => {
    const response = run(
      devEnv,
      'http://locadora-a.localhost:3001/api/categories'
    )
    expectRewrite(
      response,
      'http://127.0.0.1:3000/api/categories?tenantSlug=locadora-a'
    )
    expect(forwarded(response).get('x-platform-origin')).toBe(
      'http://locadora-a.localhost:3001'
    )
  })
})

describe('decide (pura)', () => {
  it('não depende de nada além dos argumentos', () => {
    const host = {
      kind: 'tenant',
      slug: 'locadora-a',
      origin: A,
      preview: null,
    } as const
    expect(
      decide(prodEnv, host, { pathname: '/sobre', search: '', method: 'GET' })
    ).toEqual({
      type: 'rewrite',
      pathname: '/locadora-a/sobre',
      search: '',
    })
  })

  it('canonicalPathname recusa ., .., barras codificadas, NUL e codificação malformada', () => {
    expect(canonicalPathname('/a/%2e%2e/b')).toBeNull()
    expect(canonicalPathname('/a/%2F')).toBeNull()
    expect(canonicalPathname('/a/%5C')).toBeNull()
    expect(canonicalPathname('/a/%00')).toBeNull()
    expect(canonicalPathname('/%E0%A4%A')).toBeNull()
    expect(canonicalPathname('/GB%20Loca%C3%A7%C3%B5es.png')).toEqual({
      decoded: '/GB Locações.png',
      encoded: '/GB%20Loca%C3%A7%C3%B5es.png',
    })
  })

  it('withoutCookie remove só o nome exato', () => {
    expect(
      withoutCookie(
        'selected-tenant-id=1; x-selected-tenant-id=2;selected-tenant-idx=3',
        'selected-tenant-id'
      )
    ).toBe('x-selected-tenant-id=2; selected-tenant-idx=3')
    expect(withoutCookie(null, 'selected-tenant-id')).toBe('')
  })
})

describe('T4: matcher do proxy', () => {
  it.each([
    '/',
    '/api/x',
    '/robots.txt',
    '/b/equipamentos/x.png',
    '/.well-known/x',
    '/_next/data/b/x.json',
    '/fonts',
    '/favicon.ico',
    '/modelsx/a',
  ])('cobre %s', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true)
  })

  it.each([
    '/_next/static/x.js',
    '/_next/image?url=%2Fx.png&w=64&q=75',
    '/_vercel/insights/view',
    '/models/a.glb',
    '/fonts/a.woff2',
    '/email-templates/a.html',
  ])('não cobre %s', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false)
  })
})

describe('proxy do processo (src/proxy.ts): a mesma decisão com o ambiente de process.env', () => {
  // Tudo que resolvePlatformEnv e hostAuthMode leem; `undefined` apaga o valor herdado do processo de teste.
  const PROCESS_ENV: Record<string, string | undefined> = {
    VERCEL_ENV: undefined,
    NODE_ENV: 'test',
    PLATFORM_ENV: 'production',
    PLATFORM_ROOT_DOMAIN: 'plataforma.example',
    PLATFORM_PUBLIC_PORT: undefined,
    PLATFORM_EDGE_SECRET: SECRET,
    PLATFORM_EDGE_SECRET_PREVIOUS: undefined,
    PLATFORM_LABS_ENABLED: undefined,
    WEB_API_ORIGIN: 'https://backend.example',
    NEXT_PUBLIC_AUTH_MODE: undefined,
  }

  /** Instância nova de src/proxy.ts (o módulo guarda o ambiente resolvido na primeira requisição). */
  async function processProxy(env: Record<string, string | undefined> = {}) {
    for (const [name, value] of Object.entries({ ...PROCESS_ENV, ...env }))
      vi.stubEnv(name, value)
    vi.resetModules()
    // Os caminhos deste bloco (entrada, API e ambiente inválido) não consultam o modo do site (S13): resposta síncrona.
    return (await import('../../proxy')).default as (
      request: NextRequest
    ) => NextResponse
  }
  const request = (
    url: string,
    init: { method?: string; headers?: Record<string, string> } = {}
  ) =>
    new NextRequest(url, {
      method: init.method ?? 'GET',
      headers: { host: new URL(url).host, ...init.headers },
    })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('NEXT_PUBLIC_AUTH_MODE inválido: 503 em página e API, sem repassar e sem vazar o segredo no log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const handler = await processProxy({ NEXT_PUBLIC_AUTH_MODE: 'magic-link' })
    const page = handler(request(A + '/entrar'))
    expect(page.status).toBe(503)
    expect(isRewrite(page)).toBe(false)
    const api = handler(request(A + '/api/equipments'))
    expect(api.status).toBe(503)
    expect((await api.json()).code).toBe('PLATFORM_UNAVAILABLE')
    expect(log).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(log.mock.calls)).not.toContain(SECRET)
  })

  it('ambiente da plataforma inválido: 503', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const handler = await processProxy({ PLATFORM_ROOT_DOMAIN: undefined })
    expect(handler(request(APP + '/admin')).status).toBe(503)
  })

  it('login e área do cliente seguem o modo de autenticação do processo', async () => {
    const legacy = await processProxy()
    await expectPageNotFound(legacy(request(A + '/entrar')))
    await expectJson(
      legacy(request(A + '/api/auth/get-session')),
      404,
      API_NOT_FOUND
    )
    // A entrada do cliente passa só no basePath do Better Auth do modo; no better-auth-v2, /api/auth é o NextAuth.
    for (const [mode, base, other] of [
      ['better-auth', '/api/auth', '/api/auth/v2'],
      ['better-auth-v2', '/api/auth/v2', '/api/auth'],
    ] as const) {
      const handler = await processProxy({ NEXT_PUBLIC_AUTH_MODE: mode })
      expectRewrite(handler(request(A + '/entrar')), A + '/locadora-a/entrar')
      expectRewrite(
        handler(request(A + base + '/get-session')),
        'https://backend.example' + base + '/get-session'
      )
      await expectJson(
        handler(request(A + other + '/get-session')),
        404,
        API_NOT_FOUND
      )
    }
    const v2 = await processProxy({ NEXT_PUBLIC_AUTH_MODE: 'better-auth-v2' })
    await expectJson(
      v2(
        request(A + '/api/auth/callback/credentials/oauth-proxy', {
          method: 'POST',
        })
      ),
      404,
      API_NOT_FOUND
    )
  })

  it('API segue ao backend do processo com o segredo e a borda do processo', async () => {
    const handler = await processProxy({
      WEB_API_ORIGIN: 'https://outro-backend.example',
    })
    const response = handler(
      request(A + '/api/categories', {
        headers: { 'x-platform-edge-auth': 'forjado' },
      })
    )
    expectRewrite(
      response,
      'https://outro-backend.example/api/categories?tenantSlug=locadora-a'
    )
    const headers = forwarded(response)
    expect(headers.get('x-platform-edge-auth')).toBe(SECRET)
    expect(headers.get('x-platform-host-kind')).toBe('tenant')
    expect(headers.get('x-platform-origin')).toBe(A)
  })

  it('o ambiente é resolvido uma vez: mudar process.env depois não troca a decisão', async () => {
    const handler = await processProxy()
    await expectPageNotFound(handler(request(A + '/entrar')))
    vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', 'better-auth')
    vi.stubEnv('PLATFORM_ROOT_DOMAIN', 'outra.example')
    await expectPageNotFound(handler(request(A + '/entrar')))
  })
})
