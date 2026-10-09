/// <reference types="node" />
// T1 e T2 da ADR docs/architecture/adr-tenant-hosts.md (seção de testes).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import platformJson from './platform.json'
import {
  AUTH_MODES,
  BETTER_AUTH_BASE_PATHS,
  PLATFORM,
  PLATFORM_EDGE_HEADER,
  PLATFORM_EDGE_HEADERS,
  PlatformEnvError,
  TENANT_SLUG_RE,
  betterAuthBasePath,
  canonicalOrigin,
  classifyHost,
  hasBlockedSlugTerm,
  isDisposableEmail,
  isReservedSubdomain,
  isSignupSlug,
  isTenantSlug,
  parseAuthMode,
  platformOrigins,
  resolvePlatformEnv,
  resolveWebPlatformEnv,
  tenantOrigin,
  type HostClass,
  type PlatformEnvSource,
} from './platform'

const srcDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(srcDir, '..', '..', '..')

// Valores fictícios de teste (nunca segredos reais).
const FAKE_SECRET = 'segredo-de-teste-com-32-caracteres!'
const PROD_SOURCE: PlatformEnvSource = {
  PLATFORM_ENV: 'production',
  PLATFORM_ROOT_DOMAIN: 'plataforma.example',
  PLATFORM_EDGE_SECRET: FAKE_SECRET,
  WEB_API_ORIGIN: 'https://legado.example',
}
const prod = resolvePlatformEnv(PROD_SOURCE)
const preview = resolvePlatformEnv({
  PLATFORM_ENV: 'preview',
  VERCEL_ENV: 'preview',
  PLATFORM_ROOT_DOMAIN: 'staging.plataforma.example',
})
const previewWithoutVercel = resolvePlatformEnv({
  PLATFORM_ENV: 'preview',
  PLATFORM_ROOT_DOMAIN: 'staging.plataforma.example',
})
const dev = resolvePlatformEnv({ PLATFORM_ENV: 'development' })

function summary(host: HostClass): string {
  switch (host.kind) {
    case 'tenant':
      return `tenant:${host.slug}`
    case 'reserved':
      return `reserved:${host.label}`
    case 'invalid':
      return `invalid:${host.reason}`
    default:
      return host.kind
  }
}

const SLUG_63 = `a${'b'.repeat(61)}c`
const LABEL_64 = `a${'b'.repeat(62)}c`
const DEPLOY = 'locadora-web-git-feat-team'

describe('T1: isTenantSlug e TENANT_SLUG_RE', () => {
  const cases: Array<[unknown, boolean]> = [
    ['ab', true],
    ['acme', true],
    ['a-b', true],
    ['acme-locacoes', true],
    ['0123', true],
    ['a1', true],
    [SLUG_63, true],
    ['a', false],
    ['', false],
    [LABEL_64, false],
    ['a--b', false],
    ['xn--80ak6aa92e', false],
    ['-ab', false],
    ['ab-', false],
    ['AB', false],
    ['Acme', false],
    ['a_b', false],
    ['a.b', false],
    ['açme', false],
    [' ab', false],
    ['ab\n', false],
    ['admin', false],
    ['app', false],
    ['www', false],
    ['api', false],
    ['plataforma', false],
    ['equipamentos', false],
    ['backoffice', false],
    ['console', false],
    ['ops', false],
    ['comecar', false],
    ['planos', false],
    ['vincular', false],
    [123, false],
    [null, false],
    [undefined, false],
  ]

  it.each(cases)('isTenantSlug(%j) = %s', (value, expected) => {
    expect(isTenantSlug(value)).toBe(expected)
  })

  it('TENANT_SLUG_RE já embute a proibição de "--" e o tamanho 2..63', () => {
    expect(TENANT_SLUG_RE.test('a--b')).toBe(false)
    expect(TENANT_SLUG_RE.test('xn--abc')).toBe(false)
    expect(TENANT_SLUG_RE.test('a')).toBe(false)
    expect(TENANT_SLUG_RE.test(LABEL_64)).toBe(false)
    expect(TENANT_SLUG_RE.test(SLUG_63)).toBe(true)
  })

  it('reservado passa na sintaxe, mas não é locadora', () => {
    expect(TENANT_SLUG_RE.test('admin')).toBe(true)
    expect(isReservedSubdomain('admin')).toBe(true)
    expect(isReservedSubdomain('acme')).toBe(false)
    expect(isTenantSlug('admin')).toBe(false)
  })
})

describe('T1: classifyHost em produção', () => {
  const cases: Array<[string | null | undefined, string]> = [
    ['plataforma.example', 'apex'],
    ['PLATAFORMA.EXAMPLE', 'apex'],
    ['plataforma.example:443', 'apex'],
    ['plataforma.example.', 'apex'],
    ['www.plataforma.example', 'www'],
    ['app.plataforma.example', 'app'],
    ['App.Plataforma.Example:8443', 'app'],
    ['acme.plataforma.example', 'tenant:acme'],
    ['Acme.plataforma.example', 'tenant:acme'],
    ['ACME.PLATAFORMA.EXAMPLE', 'tenant:acme'],
    ['acme.plataforma.example.', 'tenant:acme'],
    ['acme.plataforma.example:3000', 'tenant:acme'],
    ['ab.plataforma.example', 'tenant:ab'],
    ['a-b.plataforma.example', 'tenant:a-b'],
    [`${SLUG_63}.plataforma.example`, `tenant:${SLUG_63}`],
    ['a.plataforma.example', 'invalid:invalid-label'],
    [`${LABEL_64}.plataforma.example`, 'invalid:invalid-label'],
    ['xn--80ak6aa92e.plataforma.example', 'invalid:invalid-label'],
    ['a--b.plataforma.example', 'invalid:invalid-label'],
    ['-ab.plataforma.example', 'invalid:invalid-label'],
    ['ab-.plataforma.example', 'invalid:invalid-label'],
    ['api.plataforma.example', 'reserved:api'],
    ['auth.plataforma.example', 'reserved:auth'],
    ['admin.plataforma.example', 'reserved:admin'],
    ['equipamentos.plataforma.example', 'reserved:equipamentos'],
    ['m.plataforma.example', 'reserved:m'],
    ['backoffice.plataforma.example', 'reserved:backoffice'],
    ['console.plataforma.example', 'reserved:console'],
    ['ops.plataforma.example', 'reserved:ops'],
    ['comecar.plataforma.example', 'reserved:comecar'],
    ['planos.plataforma.example', 'reserved:planos'],
    ['vincular.plataforma.example', 'reserved:vincular'],
    ['a.b.plataforma.example', 'invalid:multi-level'],
    ['www.acme.plataforma.example', 'invalid:multi-level'],
    ['app.acme.plataforma.example', 'invalid:multi-level'],
    ['evilplataforma.example', 'invalid:outside-root'],
    ['plataforma.example.evil.test', 'invalid:outside-root'],
    ['acme.plataforma.example.evil.test', 'invalid:outside-root'],
    ['localhost', 'invalid:outside-root'],
    ['localhost:3001', 'invalid:outside-root'],
    ['acme.localhost:3001', 'invalid:outside-root'],
    ['127.0.0.1', 'invalid:ip-literal'],
    ['127.0.0.1:3001', 'invalid:ip-literal'],
    ['[::1]:3001', 'invalid:ip-literal'],
    [`acme---${DEPLOY}.vercel.app`, 'invalid:outside-root'],
    [`${DEPLOY}.vercel.app`, 'invalid:outside-root'],
    ['', 'invalid:missing'],
    [null, 'invalid:missing'],
    [undefined, 'invalid:missing'],
    [' acme.plataforma.example', 'invalid:malformed'],
    ['acme .plataforma.example', 'invalid:malformed'],
    ['acme_x.plataforma.example', 'invalid:malformed'],
    ['acme..plataforma.example', 'invalid:malformed'],
    ['.plataforma.example', 'invalid:malformed'],
    ['plataforma.example..', 'invalid:malformed'],
    ['plataforma.example:', 'invalid:malformed'],
    ['plataforma.example:abc', 'invalid:malformed'],
    ['plataforma.example:0', 'invalid:malformed'],
    ['plataforma.example:99999', 'invalid:malformed'],
    ['user@acme.plataforma.example', 'invalid:malformed'],
    ['acme.plataforma.example/equipamentos', 'invalid:malformed'],
    ['acme.plataforma.example,evil.test', 'invalid:malformed'],
    ['açme.plataforma.example', 'invalid:malformed'],
    ['Kcme.plataforma.example', 'invalid:malformed'],
    ['::1', 'invalid:malformed'],
  ]

  it.each(cases)('%j → %s', (host, expected) => {
    expect(summary(classifyHost(host, prod))).toBe(expected)
  })
})

describe('T1: classifyHost no preview da Vercel', () => {
  const withVercel: Array<[string, string]> = [
    [`${DEPLOY}.vercel.app`, 'apex'],
    [`acme---${DEPLOY}.vercel.app`, 'tenant:acme'],
    [`ACME---${DEPLOY.toUpperCase()}.VERCEL.APP`, 'tenant:acme'],
    [`app---${DEPLOY}.vercel.app`, 'app'],
    [`www---${DEPLOY}.vercel.app`, 'www'],
    [`api---${DEPLOY}.vercel.app`, 'reserved:api'],
    [`a---${DEPLOY}.vercel.app`, 'invalid:invalid-label'],
    [`a--b---${DEPLOY}.vercel.app`, 'invalid:invalid-label'],
    [`xn--80ak6aa92e---${DEPLOY}.vercel.app`, 'invalid:invalid-label'],
    [`---${DEPLOY}.vercel.app`, 'invalid:invalid-label'],
    ['acme---.vercel.app', 'invalid:invalid-label'],
    [`acme----${DEPLOY}.vercel.app`, 'invalid:invalid-label'],
    [`acme---${DEPLOY}---x.vercel.app`, 'invalid:invalid-label'],
    [`acme---${DEPLOY}.foo.vercel.app`, 'invalid:multi-level'],
    ['vercel.app', 'invalid:outside-root'],
    ['staging.plataforma.example', 'apex'],
    ['app.staging.plataforma.example', 'app'],
    ['acme.staging.plataforma.example', 'tenant:acme'],
    ['acme.plataforma.example', 'invalid:outside-root'],
    ['127.0.0.1', 'invalid:ip-literal'],
  ]

  it.each(withVercel)('VERCEL_ENV=preview: %j → %s', (host, expected) => {
    expect(summary(classifyHost(host, preview))).toBe(expected)
  })

  const withoutVercel: Array<[string, string]> = [
    [`acme---${DEPLOY}.vercel.app`, 'invalid:outside-root'],
    [`app---${DEPLOY}.vercel.app`, 'invalid:outside-root'],
    [`${DEPLOY}.vercel.app`, 'invalid:outside-root'],
    ['acme.staging.plataforma.example', 'tenant:acme'],
  ]

  it.each(withoutVercel)(
    'sem VERCEL_ENV=preview: %j → %s',
    (host, expected) => {
      expect(summary(classifyHost(host, previewWithoutVercel))).toBe(expected)
    }
  )

  it('o preview carrega o rótulo do deploy e a origem do próprio deploy', () => {
    const host = classifyHost(`Acme---${DEPLOY}.vercel.app:443`, preview)
    expect(host).toEqual({
      kind: 'tenant',
      slug: 'acme',
      origin: `https://acme---${DEPLOY}.vercel.app`,
      preview: DEPLOY,
    })
  })
})

describe('T1: classifyHost em development', () => {
  const cases: Array<[string, string]> = [
    ['localhost', 'apex'],
    ['localhost:3001', 'apex'],
    ['app.localhost:3001', 'app'],
    ['www.localhost:3001', 'www'],
    ['acme.localhost:3001', 'tenant:acme'],
    ['ACME.LOCALHOST:3001', 'tenant:acme'],
    ['api.localhost:3001', 'reserved:api'],
    ['a.b.localhost:3001', 'invalid:multi-level'],
    ['127.0.0.1:3001', 'app'],
    ['192.168.0.10:3001', 'app'],
    ['[::1]:3001', 'app'],
    ['[::1', 'invalid:malformed'],
    ['999.1.1.1', 'invalid:outside-root'],
    [`acme---${DEPLOY}.vercel.app`, 'invalid:outside-root'],
    ['plataforma.example', 'invalid:outside-root'],
  ]

  it.each(cases)('%j → %s', (host, expected) => {
    expect(summary(classifyHost(host, dev))).toBe(expected)
  })
})

describe('T1: origem recalculada, nunca o texto cru do Host', () => {
  it('normaliza caixa, porta e ponto final em produção', () => {
    expect(classifyHost('ACME.Plataforma.Example.:8443', prod)).toEqual({
      kind: 'tenant',
      slug: 'acme',
      origin: 'https://acme.plataforma.example',
      preview: null,
    })
    expect(classifyHost('plataforma.example', prod)).toEqual({
      kind: 'apex',
      origin: 'https://plataforma.example',
      preview: null,
    })
  })

  it('em development usa a porta configurada, não a do Host', () => {
    expect(classifyHost('acme.localhost:9999', dev)).toMatchObject({
      origin: 'http://acme.localhost:3001',
    })
    expect(classifyHost('192.168.0.10:9999', dev)).toMatchObject({
      kind: 'app',
      origin: 'http://192.168.0.10:3001',
    })
    expect(classifyHost('[::1]:3001', dev)).toMatchObject({
      origin: 'http://[::1]:3001',
    })
  })
})

describe('resolvePlatformEnv', () => {
  const expectError = (source: PlatformEnvSource, pattern: RegExp) => {
    expect(() => resolvePlatformEnv(source)).toThrow(PlatformEnvError)
    expect(() => resolvePlatformEnv(source)).toThrow(pattern)
  }

  it('development tem padrões locais e é imutável', () => {
    const env = resolvePlatformEnv({})
    expect(env).toEqual({
      environment: 'development',
      rootDomain: 'localhost',
      protocol: 'http',
      publicPort: 3001,
      vercelPreview: false,
      edgeSecret: null,
      edgeSecretPrevious: null,
      apiOrigin: null,
      labsEnabled: false,
    })
    expect(Object.isFrozen(env)).toBe(true)
  })

  it('produção completa', () => {
    expect(prod).toMatchObject({
      environment: 'production',
      rootDomain: 'plataforma.example',
      protocol: 'https',
      publicPort: null,
      edgeSecret: FAKE_SECRET,
      apiOrigin: 'https://legado.example',
    })
  })

  it('falha fechada: sem PLATFORM_ENV, NODE_ENV/VERCEL_ENV=production contam como produção', () => {
    expectError({ NODE_ENV: 'production' }, /PLATFORM_ROOT_DOMAIN/)
    expectError({ VERCEL_ENV: 'production' }, /PLATFORM_ROOT_DOMAIN/)
    expect(
      resolvePlatformEnv({
        ...PROD_SOURCE,
        PLATFORM_ENV: undefined,
        NODE_ENV: 'production',
      }).environment
    ).toBe('production')
    expect(resolvePlatformEnv({ NODE_ENV: 'test' }).environment).toBe(
      'development'
    )
  })

  it('VERCEL_ENV=preview liga os prefixos e usa https', () => {
    const env = resolvePlatformEnv({
      VERCEL_ENV: 'preview',
      PLATFORM_ROOT_DOMAIN: 'staging.plataforma.example',
    })
    expect(env).toMatchObject({
      environment: 'preview',
      vercelPreview: true,
      protocol: 'https',
      publicPort: null,
    })
    expect(prod.vercelPreview).toBe(false)
  })

  it('recusa PLATFORM_ENV desconhecido e development em deploy da Vercel', () => {
    expectError({ PLATFORM_ENV: 'prod' }, /PLATFORM_ENV/)
    expectError(
      { PLATFORM_ENV: 'development', VERCEL_ENV: 'production' },
      /development/
    )
    expectError(
      { PLATFORM_ENV: 'development', VERCEL_ENV: 'preview' },
      /development/
    )
  })

  it('produção exige PLATFORM_ROOT_DOMAIN e PLATFORM_EDGE_SECRET', () => {
    expectError(
      { ...PROD_SOURCE, PLATFORM_ROOT_DOMAIN: undefined },
      /PLATFORM_ROOT_DOMAIN/
    )
    expectError(
      { ...PROD_SOURCE, PLATFORM_EDGE_SECRET: '' },
      /PLATFORM_EDGE_SECRET/
    )
    expectError({ ...PROD_SOURCE, PLATFORM_EDGE_SECRET: 'x'.repeat(31) }, /32/)
  })

  // Achados 1 e 24 da revisão: WEB_API_ORIGIN é variável só do processo web
  // (ADR, tabela de variáveis). O backend em produção valida a borda com este
  // mesmo contrato e não pode depender dela.
  it.each([
    ['PLATFORM_ENV=production', { PLATFORM_ENV: 'production' }],
    [
      'NODE_ENV=production',
      { PLATFORM_ENV: undefined, NODE_ENV: 'production' },
    ],
    [
      'VERCEL_ENV=production',
      { PLATFORM_ENV: undefined, VERCEL_ENV: 'production' },
    ],
  ])(
    'backend em produção (%s) sem WEB_API_ORIGIN resolve o ambiente da borda',
    (_name, overrides) => {
      const env = resolvePlatformEnv({
        ...PROD_SOURCE,
        WEB_API_ORIGIN: undefined,
        ...overrides,
      })
      expect(env).toMatchObject({
        environment: 'production',
        rootDomain: 'plataforma.example',
        protocol: 'https',
        edgeSecret: FAKE_SECRET,
        apiOrigin: null,
      })
    }
  )

  it('backend ignora um WEB_API_ORIGIN do web inválido para o ambiente (sem lançar)', () => {
    for (const origin of [
      'http://127.0.0.1:3000',
      'https://legado.example/api',
      'nao-e-origem',
    ])
      expect(
        resolvePlatformEnv({ ...PROD_SOURCE, WEB_API_ORIGIN: origin })
      ).toMatchObject({ environment: 'production', apiOrigin: null })
  })

  it.each([
    'https://plataforma.example',
    'plataforma.example:443',
    'plataforma.example/x',
    'Plataforma.example',
    'plataforma.example.',
    '*.plataforma.example',
    '127.0.0.1',
    'localhost',
    'app.localhost',
    'plataforma',
  ])('recusa PLATFORM_ROOT_DOMAIN=%j fora de development', (root) => {
    expectError(
      { ...PROD_SOURCE, PLATFORM_ROOT_DOMAIN: root },
      /PLATFORM_ROOT_DOMAIN/
    )
  })

  it('WEB_API_ORIGIN válida é normalizada', () => {
    expect(
      resolvePlatformEnv({
        ...PROD_SOURCE,
        WEB_API_ORIGIN: 'HTTPS://Legado.Example:443/',
      }).apiOrigin
    ).toBe('https://legado.example')
    expect(
      resolvePlatformEnv({ WEB_API_ORIGIN: 'http://127.0.0.1:3000' }).apiOrigin
    ).toBe('http://127.0.0.1:3000')
  })

  it('mensagens de erro nunca repetem segredos', () => {
    const shortSecret = 'segredo-curto-ficticio'
    try {
      resolvePlatformEnv({ ...PROD_SOURCE, PLATFORM_EDGE_SECRET: shortSecret })
      expect.unreachable()
    } catch (error) {
      expect(String(error)).not.toContain(shortSecret)
    }
    try {
      resolveWebPlatformEnv({
        ...PROD_SOURCE,
        WEB_API_ORIGIN: 'https://user:senha-ficticia@legado.example',
      })
      expect.unreachable()
    } catch (error) {
      expect(String(error)).not.toContain('senha-ficticia')
    }
  })

  it('rotação do segredo de borda', () => {
    const env = resolvePlatformEnv({
      ...PROD_SOURCE,
      PLATFORM_EDGE_SECRET_PREVIOUS: `${FAKE_SECRET}-anterior`,
    })
    expect(env.edgeSecretPrevious).toBe(`${FAKE_SECRET}-anterior`)
    expectError(
      { ...PROD_SOURCE, PLATFORM_EDGE_SECRET_PREVIOUS: 'curto' },
      /PLATFORM_EDGE_SECRET_PREVIOUS/
    )
    expectError(
      { PLATFORM_EDGE_SECRET_PREVIOUS: FAKE_SECRET },
      /PLATFORM_EDGE_SECRET_PREVIOUS/
    )
  })

  it('labs nunca em produção', () => {
    expect(
      resolvePlatformEnv({ ...PROD_SOURCE, PLATFORM_LABS_ENABLED: 'true' })
        .labsEnabled
    ).toBe(false)
    expect(
      resolvePlatformEnv({
        PLATFORM_ENV: 'staging',
        PLATFORM_ROOT_DOMAIN: 'staging.plataforma.example',
        PLATFORM_LABS_ENABLED: 'true',
      }).labsEnabled
    ).toBe(true)
    expect(
      resolvePlatformEnv({ PLATFORM_LABS_ENABLED: 'yes' }).labsEnabled
    ).toBe(false)
  })

  it('PLATFORM_PUBLIC_PORT só vale em development', () => {
    expect(
      resolvePlatformEnv({ PLATFORM_PUBLIC_PORT: '4000' }).publicPort
    ).toBe(4000)
    for (const port of ['0', '70000', 'abc', '30.1']) {
      expectError({ PLATFORM_PUBLIC_PORT: port }, /PLATFORM_PUBLIC_PORT/)
    }
    expect(
      resolvePlatformEnv({ ...PROD_SOURCE, PLATFORM_PUBLIC_PORT: '4000' })
        .publicPort
    ).toBeNull()
  })
})

describe('resolveWebPlatformEnv (processo web: proxy e gateway)', () => {
  const expectWebError = (source: PlatformEnvSource, pattern: RegExp) => {
    expect(() => resolveWebPlatformEnv(source)).toThrow(PlatformEnvError)
    expect(() => resolveWebPlatformEnv(source)).toThrow(pattern)
  }

  it('é o ambiente comum mais WEB_API_ORIGIN validada', () => {
    expect(resolveWebPlatformEnv(PROD_SOURCE)).toEqual(prod)
    expect(
      resolveWebPlatformEnv({
        ...PROD_SOURCE,
        WEB_API_ORIGIN: 'HTTPS://Legado.Example:443/',
      }).apiOrigin
    ).toBe('https://legado.example')
    expect(Object.isFrozen(resolveWebPlatformEnv(PROD_SOURCE))).toBe(true)
  })

  it('produção exige WEB_API_ORIGIN em https', () => {
    expectWebError(
      { ...PROD_SOURCE, WEB_API_ORIGIN: undefined },
      /WEB_API_ORIGIN é obrigatória em produção/
    )
    expectWebError({ ...PROD_SOURCE, WEB_API_ORIGIN: '  ' }, /obrigatória/)
    expectWebError(
      { ...PROD_SOURCE, WEB_API_ORIGIN: 'http://legado.example' },
      /https/
    )
    expectWebError(
      {
        PLATFORM_ENV: 'staging',
        PLATFORM_ROOT_DOMAIN: 'staging.plataforma.example',
        WEB_API_ORIGIN: 'http://legado.example',
      },
      /https/
    )
  })

  it('fora de produção a variável é opcional; em development aceita http', () => {
    expect(
      resolveWebPlatformEnv({
        PLATFORM_ENV: 'staging',
        PLATFORM_ROOT_DOMAIN: 'staging.plataforma.example',
      }).apiOrigin
    ).toBeNull()
    expect(
      resolveWebPlatformEnv({ WEB_API_ORIGIN: 'http://127.0.0.1:3000' })
        .apiOrigin
    ).toBe('http://127.0.0.1:3000')
  })

  it('WEB_API_ORIGIN precisa ser só a origem', () => {
    for (const origin of [
      'https://legado.example/api',
      'https://legado.example?x=1',
      'https://user:senha-ficticia@legado.example',
      'ftp://legado.example',
    ]) {
      expectWebError(
        { ...PROD_SOURCE, WEB_API_ORIGIN: origin },
        /WEB_API_ORIGIN deve conter somente a origem/
      )
    }
  })

  it('os erros do ambiente comum continuam valendo', () => {
    expectWebError(
      { ...PROD_SOURCE, PLATFORM_EDGE_SECRET: undefined },
      /PLATFORM_EDGE_SECRET/
    )
    expectWebError({ PLATFORM_ENV: 'prod' }, /PLATFORM_ENV/)
  })
})

describe('origens', () => {
  it('platformOrigins', () => {
    expect(platformOrigins(prod)).toEqual({
      apex: 'https://plataforma.example',
      www: 'https://www.plataforma.example',
      app: 'https://app.plataforma.example',
    })
    expect(platformOrigins(dev)).toEqual({
      apex: 'http://localhost:3001',
      www: 'http://www.localhost:3001',
      app: 'http://app.localhost:3001',
    })
  })

  it('tenantOrigin recusa slug inválido ou reservado', () => {
    expect(tenantOrigin(prod, 'acme')).toBe('https://acme.plataforma.example')
    expect(tenantOrigin(dev, 'acme')).toBe('http://acme.localhost:3001')
    for (const slug of ['admin', 'app', 'a--b', 'x', 'Acme', 'acme.evil']) {
      expect(() => tenantOrigin(prod, slug)).toThrow(TypeError)
    }
  })

  it('no preview, as origens irmãs ficam no mesmo deploy', () => {
    const host = classifyHost(`acme---${DEPLOY}.vercel.app`, preview)
    if (host.kind !== 'tenant')
      throw new Error(`esperado tenant, veio ${host.kind}`)
    expect(platformOrigins(preview, host)).toEqual({
      apex: `https://${DEPLOY}.vercel.app`,
      www: `https://www---${DEPLOY}.vercel.app`,
      app: `https://app---${DEPLOY}.vercel.app`,
    })
    expect(tenantOrigin(preview, 'outra', host)).toBe(
      `https://outra---${DEPLOY}.vercel.app`
    )
    expect(platformOrigins(preview).app).toBe(
      'https://app.staging.plataforma.example'
    )
  })

  it('canonicalOrigin ignora o preview', () => {
    expect(canonicalOrigin(prod, 'apex')).toBe('https://plataforma.example')
    expect(canonicalOrigin(prod, 'app')).toBe('https://app.plataforma.example')
    expect(canonicalOrigin(prod, { slug: 'acme' })).toBe(
      'https://acme.plataforma.example'
    )
    expect(canonicalOrigin(preview, { slug: 'acme' })).toBe(
      'https://acme.staging.plataforma.example'
    )
    expect(() => canonicalOrigin(prod, { slug: 'api' })).toThrow(TypeError)
  })
})

describe('contexto de borda', () => {
  it('lista todos os cabeçalhos x-platform-*, únicos e em minúsculas', () => {
    expect([...PLATFORM_EDGE_HEADERS]).toEqual(
      Object.values(PLATFORM_EDGE_HEADER)
    )
    expect(PLATFORM_EDGE_HEADERS).toHaveLength(5)
    expect(new Set(PLATFORM_EDGE_HEADERS).size).toBe(
      PLATFORM_EDGE_HEADERS.length
    )
    for (const name of PLATFORM_EDGE_HEADERS) {
      expect(name).toMatch(/^x-platform-[a-z-]+$/)
    }
    expect(PLATFORM_EDGE_HEADERS).toEqual([
      'x-platform-edge-auth',
      'x-platform-host-kind',
      'x-platform-tenant-slug',
      'x-platform-origin',
      'x-platform-client-ip',
    ])
    expect(Object.isFrozen(PLATFORM_EDGE_HEADERS)).toBe(true)
    expect(Object.isFrozen(PLATFORM_EDGE_HEADER)).toBe(true)
  })
})

describe('platform.json', () => {
  it('nome provisório único da plataforma', () => {
    expect(PLATFORM).toMatchObject({
      name: 'locadora',
      displayName: 'Locadora',
      appScheme: 'locadora',
      mobile: { iosBundleIdentifier: null, androidPackage: null },
    })
    expect(PLATFORM.appScheme).toMatch(/^[a-z][a-z0-9+.-]*$/)
  })

  it('PLATFORM espelha o JSON e é imutável', () => {
    expect(PLATFORM).toEqual(platformJson)
    expect(Object.isFrozen(PLATFORM)).toBe(true)
    expect(Object.isFrozen(PLATFORM.reservedSubdomains)).toBe(true)
    expect(Object.isFrozen(PLATFORM.blockedSlugTerms)).toBe(true)
    expect(Object.isFrozen(PLATFORM.disposableEmailDomains)).toBe(true)
    expect(Object.isFrozen(PLATFORM.surfaces)).toBe(true)
    expect(Object.isFrozen(PLATFORM.mobile)).toBe(true)
  })

  it('reservados são rótulos DNS minúsculos e únicos', () => {
    const reserved = PLATFORM.reservedSubdomains
    expect(new Set(reserved).size).toBe(reserved.length)
    for (const label of reserved) {
      expect(label).toMatch(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/)
    }
  })

  it('hosts da plataforma, namespace interno e prefixo de link universal são reservados', () => {
    const deepLinkSegment = PLATFORM.deepLinkPrefix.replace(/^\//, '')
    expect(PLATFORM.deepLinkPrefix).toMatch(/^\/[a-z0-9-]+$/)
    for (const label of [
      'www',
      PLATFORM.surfaces.app,
      'api',
      'auth',
      'plataforma',
      'well-known',
      deepLinkSegment,
    ]) {
      expect(isReservedSubdomain(label)).toBe(true)
    }
  })
})

describe('platform.json: reservados da plataforma SaaS (adr-saas-subscription.md)', () => {
  it.each([
    // Backoffice, onboarding e página de planos (B.8, B.9); ops e console (R-10, A.4).
    'backoffice',
    'console',
    'ops',
    'comecar',
    'planos',
    // Rota de primeiro nível do host da locadora (adr-tenant-hosts.md).
    'vincular',
  ])('%s é reservado e nunca vira locadora', (label) => {
    expect(isReservedSubdomain(label)).toBe(true)
    expect(isTenantSlug(label)).toBe(false)
    expect(isSignupSlug(label)).toBe(false)
  })
})

describe('termos bloqueados no cadastro (blockedSlugTerms, B.8)', () => {
  it('os termos são palavras de slug, minúsculas, únicas e não vazias', () => {
    const terms = PLATFORM.blockedSlugTerms
    expect(terms.length).toBeGreaterThan(0)
    expect(new Set(terms).size).toBe(terms.length)
    for (const term of terms) {
      expect(term).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    }
  })

  it('cobre os exemplos do ADR: pix, asaas, gov, login, bancos e órgãos públicos', () => {
    for (const term of [
      'pix',
      'asaas',
      'gov',
      'login',
      'itau',
      'bradesco',
      'banco-do-brasil',
      'receita-federal',
      'inss',
    ]) {
      expect(PLATFORM.blockedSlugTerms).toContain(term)
    }
  })

  it.each([
    ['pix', true],
    ['pix-locacoes', true],
    ['locacoes-pix', true],
    ['acme-pix-maquinas', true],
    ['asaas', true],
    ['gov-sp', true],
    ['login-acme', true],
    ['loja-banco-do-brasil', true],
    ['bancodobrasil-maquinas', true],
    ['acme-receita-federal', true],
    ['pixel-locacoes', false],
    ['governador-valadares-locacoes', false],
    ['acme-locacoes', false],
    ['banco-do-norte', false],
    ['receitas-da-vovo', false],
    ['xpix', false],
  ])('hasBlockedSlugTerm(%j) = %s', (slug, expected) => {
    expect(hasBlockedSlugTerm(slug)).toBe(expected)
  })

  it('bloqueio vale só para slug novo; o roteamento continua por isTenantSlug', () => {
    expect(isTenantSlug('pix-locacoes')).toBe(true)
    expect(isSignupSlug('pix-locacoes')).toBe(false)
    expect(classifyHost('pix-locacoes.plataforma.example', prod)).toMatchObject(
      {
        kind: 'tenant',
        slug: 'pix-locacoes',
      }
    )
    expect(isSignupSlug('acme-locacoes')).toBe(true)
    expect(isSignupSlug('admin')).toBe(false)
    expect(isSignupSlug('a--b')).toBe(false)
    expect(isSignupSlug(42)).toBe(false)
  })
})

describe('e-mail descartável no cadastro (disposableEmailDomains, B.8)', () => {
  it('a lista tem domínios minúsculos e únicos', () => {
    const domains = PLATFORM.disposableEmailDomains
    expect(domains.length).toBeGreaterThan(0)
    expect(new Set(domains).size).toBe(domains.length)
    for (const domain of domains) {
      expect(domain).toMatch(/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/)
    }
  })

  it.each([
    ['pessoa@mailinator.com', true],
    ['Pessoa@MAILINATOR.COM', true],
    ['pessoa@mailinator.com.', true],
    ['pessoa@sub.mailinator.com', true],
    ['pessoa@yopmail.com', true],
    ['pessoa@locadora.example', false],
    ['pessoa@notmailinator.com', false],
    ['pessoa@mailinator.com.evil.example', false],
    ['sem-arroba', false],
    ['', false],
  ])('isDisposableEmail(%j) = %s', (email, expected) => {
    expect(isDisposableEmail(email)).toBe(expected)
  })
})

// --- T2: reservados cobrem as rotas de primeiro nível do host web e public/ ---

interface DirEntry {
  readonly name: string
  readonly dir: boolean
}
type ReadDir = (_directory: string) => readonly DirEntry[]

const ROUTE_GROUP_RE = /^\([^()]+\)$/
// Rotas de metadata geradas por código ficam sem extensão na URL (ex.: /opengraph-image).
const GENERATED_METADATA_RE =
  /^((?:icon|apple-icon|opengraph-image|twitter-image)\d*)\.[cm]?[jt]sx?$/

/**
 * Primeiros segmentos estáticos de URL de uma árvore do App Router: atravessa
 * grupos `(x)` e slots `@x`; ignora pastas privadas `_x`, dinâmicas `[x]` e de
 * interceptação `(.)x`.
 */
function firstStaticSegments(appDir: string, readDir: ReadDir): string[] {
  const found = new Set<string>()
  const visit = (dir: string): void => {
    for (const entry of readDir(dir)) {
      if (!entry.dir) {
        const generated = GENERATED_METADATA_RE.exec(entry.name)?.[1]
        if (generated) found.add(generated)
      } else if (
        ROUTE_GROUP_RE.test(entry.name) ||
        entry.name.startsWith('@')
      ) {
        visit(path.join(dir, entry.name))
      } else if (!/^[_[(]/.test(entry.name)) {
        found.add(entry.name)
      }
    }
  }
  visit(appDir)
  return [...found].sort()
}

const diskReadDir: ReadDir = (dir) =>
  readdirSync(dir, { withFileTypes: true }).map((entry) => ({
    name: entry.name,
    dir: entry.isSymbolicLink()
      ? statSync(path.join(dir, entry.name)).isDirectory()
      : entry.isDirectory(),
  }))

interface FakeTree {
  readonly [name: string]: FakeTree | null
}

function fakeReadDir(root: string, tree: FakeTree): ReadDir {
  return (dir) => {
    const relative = path.relative(root, dir)
    let node: FakeTree = tree
    for (const part of relative === '' ? [] : relative.split(path.sep)) {
      const next = node[part]
      if (!next)
        throw new Error(`diretório inexistente na árvore falsa: ${dir}`)
      node = next
    }
    return Object.entries(node).map(([name, child]) => ({
      name,
      dir: child !== null,
    }))
  }
}

describe('T2: varredura das rotas de primeiro nível', () => {
  it('a varredura atravessa grupos e slots e ignora privadas, dinâmicas e interceptação', () => {
    const root = path.join(repoRoot, 'fixture-app')
    const tree: FakeTree = {
      'layout.tsx': null,
      'robots.ts': null,
      'opengraph-image.tsx': null,
      'icon.png': null,
      '(public)': {
        'page.tsx': null,
        equipamentos: { '[id]': { 'page.tsx': null } },
        '[locadora]': { sobre: { 'page.tsx': null } },
        '(nested)': { entrar: { 'page.tsx': null } },
      },
      '@modal': {
        '(.)foto': { 'page.tsx': null },
        galeria: { 'page.tsx': null },
      },
      _privada: { interno: { 'page.tsx': null } },
      api: { saude: { 'route.ts': null } },
    }
    expect(firstStaticSegments(root, fakeReadDir(root, tree))).toEqual([
      'api',
      'entrar',
      'equipamentos',
      'galeria',
      'opengraph-image',
    ])
  })

  it('nenhum primeiro segmento estático de apps/clients/web/src/app pode ser slug de locadora', () => {
    const appDir = path.join(repoRoot, 'apps', 'clients', 'web', 'src', 'app')
    expect(existsSync(appDir)).toBe(true)
    const segments = firstStaticSegments(appDir, diskReadDir)
    expect(segments.length).toBeGreaterThan(0)
    expect(segments.filter((segment) => isTenantSlug(segment))).toEqual([])
  })

  it('nenhuma entrada de primeiro nível de public/ pode ser slug de locadora', () => {
    const rootPublic = path.join(repoRoot, 'public')
    expect(existsSync(rootPublic)).toBe(true)
    const webPublic = path.join(repoRoot, 'apps', 'clients', 'web', 'public')
    const entries = new Set<string>()
    for (const dir of [rootPublic, webPublic].filter((d) => existsSync(d))) {
      for (const name of readdirSync(dir)) entries.add(name)
    }
    expect(entries.size).toBeGreaterThan(0)
    expect([...entries].filter((name) => isTenantSlug(name)).sort()).toEqual([])
  })
})

// --- Pureza: o contrato é universal e nunca lê cabeçalhos encaminhados ---

function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1')
}

describe('contrato universal', () => {
  it.each([
    'platform.ts',
    'directory.ts',
    'entitlements.ts',
    'subscription.ts',
    'onboarding.ts',
    'payment-account.ts',
    'backoffice.ts',
  ])('%s só importa módulos universais', (file) => {
    const code = codeOnly(readFileSync(path.join(srcDir, file), 'utf8'))
    const specifiers = [
      ...code.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g),
      ...code.matchAll(/\bimport\s*\(?\s*['"]([^'"]+)['"]/g),
      ...code.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]/g),
    ].map((match) => match[1])
    expect(specifiers.length).toBeGreaterThan(0)
    for (const specifier of specifiers) {
      expect([
        './platform.json',
        './platform',
        './entitlements',
        './subscription',
        './onboarding',
        './payment-account',
        'zod',
      ]).toContain(specifier)
    }
    expect(code).not.toMatch(
      /\b(process|Buffer|require|globalThis|window|document|fetch|URL|TextEncoder|headers)\b/
    )
    expect(code.toLowerCase()).not.toContain('forwarded')
  })
})

// --- Autenticação: regra única modo → basePath do Better Auth (achado 113) ---

describe('autenticação: modos dos clientes e basePath do Better Auth', () => {
  it('os três modos, na ordem do contrato e imutáveis', () => {
    expect(AUTH_MODES).toEqual(['legacy', 'better-auth-v2', 'better-auth'])
    expect(Object.isFrozen(AUTH_MODES)).toBe(true)
  })

  it('better-auth em /api/auth, better-auth-v2 em /api/auth/v2; legacy e sem modo, nenhum (falha fechada)', () => {
    expect(betterAuthBasePath('better-auth')).toBe('/api/auth')
    expect(betterAuthBasePath('better-auth-v2')).toBe('/api/auth/v2')
    expect(betterAuthBasePath('legacy')).toBeNull()
    expect(betterAuthBasePath(undefined)).toBeNull()
  })

  it('a lista dos basePath é exatamente o que a regra dá aos modos, um por modo com Better Auth', () => {
    const given = AUTH_MODES.map((mode) => betterAuthBasePath(mode)).filter(
      (base) => base !== null
    )
    expect(new Set(given).size).toBe(given.length)
    expect([...given].sort()).toEqual([...BETTER_AUTH_BASE_PATHS].sort())
    expect(BETTER_AUTH_BASE_PATHS).toHaveLength(2)
    expect(Object.isFrozen(BETTER_AUTH_BASE_PATHS)).toBe(true)
  })

  it('parseAuthMode: cada modo passa; ausente ou vazio é legacy; o resto é recusado com o nome da variável', () => {
    for (const mode of AUTH_MODES)
      expect(parseAuthMode(mode, 'NEXT_PUBLIC_AUTH_MODE')).toBe(mode)
    expect(parseAuthMode(undefined, 'NEXT_PUBLIC_AUTH_MODE')).toBe('legacy')
    expect(parseAuthMode('', 'EXPO_PUBLIC_AUTH_MODE')).toBe('legacy')
    for (const value of [
      'magic-link',
      'Legacy',
      ' better-auth',
      'better-auth-v3',
    ]) {
      expect(() => parseAuthMode(value, 'NEXT_PUBLIC_AUTH_MODE')).toThrow(
        new Error('NEXT_PUBLIC_AUTH_MODE inválido.')
      )
      expect(() => parseAuthMode(value, 'EXPO_PUBLIC_AUTH_MODE')).toThrow(
        new Error('EXPO_PUBLIC_AUTH_MODE inválido.')
      )
    }
  })

  // O basePath da coexistência só existe no Better Auth: fora do contrato, um literal dele é uma cópia da regra (host
  // web, proxy, app mobile ou backend). Comentários e testes não contam. Varre o repositório (cerca de 2 mil arquivos):
  // o prazo é o de uma varredura de disco, não os 5 s de um teste unitário. A suíte roda junto com a compilação do
  // Tailwind sobre a raiz (index.styles-build.test.ts) e, no checkpoint, com outra suíte em paralelo: a varredura levou
  // 0,15 s sozinha e 11,5 s no checkpoint da onda 130 (achado 141).
  it('o basePath do Better Auth na coexistência só aparece como literal no contrato', () => {
    // Os hosts novos, a API compartilhada e os pacotes têm de existir; a raiz legada (`lib`, `app`) entra enquanto
    // existir e sai no bloco F da onda 135 sem que a varredura quebre por pasta ausente.
    const required = [
      'apps/clients/web/src',
      'apps/clients/mobile/src',
      'apps/services/api/src',
      'packages',
    ].map((dir) => path.join(repoRoot, dir))
    for (const dir of required) expect(existsSync(dir), dir).toBe(true)
    const roots = [
      ...required,
      ...['lib', 'app']
        .map((dir) => path.join(repoRoot, dir))
        .filter((dir) => existsSync(dir)),
    ]
    const skipped = new Set(['node_modules', 'dist', 'build', 'coverage'])
    const self = path.join(srcDir, 'platform.ts')
    const copies: string[] = []
    const visit = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        // Links (inclusive node_modules do pnpm) nunca são seguidos.
        if (entry.isDirectory()) {
          if (!skipped.has(entry.name) && !entry.name.startsWith('.'))
            visit(full)
        } else if (
          entry.isFile() &&
          /\.[cm]?[jt]sx?$/.test(entry.name) &&
          !/\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name) &&
          full !== self
        ) {
          const source = readFileSync(full, 'utf8')
          // Sem o texto do basePath não há cópia: só quem o tem passa pela remoção dos comentários.
          if (
            source.includes('/api/auth/v2') &&
            /['"`]\/api\/auth\/v2(?=['"`/])/.test(codeOnly(source))
          )
            copies.push(path.relative(repoRoot, full).split(path.sep).join('/'))
        }
      }
    }
    for (const root of roots) visit(root)
    expect(copies).toEqual([])
    // O próprio contrato continua sendo encontrado pela varredura.
    expect(
      /['"`]\/api\/auth\/v2(?=['"`/])/.test(
        codeOnly(readFileSync(self, 'utf8'))
      )
    ).toBe(true)
  }, 60_000)
})
