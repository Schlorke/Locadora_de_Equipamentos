// apps/clients/web/next.config.mjs: www → apex (T3), noindex e public/ independente da API.
import {
  getRedirectUrl,
  isRewrite,
  getRewrittenUrl,
  unstable_getResponseFromNextConfig,
} from 'next/experimental/testing/server'
import { getImgProps } from 'next/dist/shared/lib/get-img-props'
import { imageConfigDefault } from 'next/dist/shared/lib/image-config'
import defaultLoader from 'next/dist/shared/lib/image-loader'
import { hasRemoteMatch } from 'next/dist/shared/lib/match-remote-pattern'
import { describe, expect, it } from 'vitest'
import {
  resolvePlatformEnv,
  resolveWebPlatformEnv,
} from '@gb-locacoes/contracts/platform'
import {
  createNextConfig,
  readImageRemotePatterns,
  readPlatformBuildEnv,
  tenantContentSecurityPolicy,
} from '../../../next.config.mjs'
import { HOST_OWNED_PUBLIC_FILES } from './route-table'
import { PUBLIC_DIRECTORIES, PUBLIC_FILES } from './public-entries.generated'

const DEV = {
  PLATFORM_ENV: 'development',
  PLATFORM_ROOT_DOMAIN: 'localhost',
  PLATFORM_PUBLIC_PORT: '3001',
  WEB_API_ORIGIN: 'http://127.0.0.1:3000',
}
const PROD = {
  PLATFORM_ENV: 'production',
  PLATFORM_ROOT_DOMAIN: 'plataforma.example',
  WEB_API_ORIGIN: 'https://backend.example',
}

describe('next.config: redirects e headers por host', () => {
  it('www responde 308 para o apex antes do proxy', async () => {
    const response = await unstable_getResponseFromNextConfig({
      url: 'https://www.plataforma.example/equipamentos?x=1',
      headers: { host: 'www.plataforma.example' },
      nextConfig: createNextConfig(PROD),
    })
    expect(response.status).toBe(308)
    expect(getRedirectUrl(response)).toBe(
      'https://plataforma.example/equipamentos?x=1'
    )
  })

  it('em desenvolvimento o destino do apex leva a porta pública', async () => {
    // O utilitário de teste do Next monta a URL só com o hostname (descarta a porta do destino); o servidor usa o
    // destino inteiro. A porta é conferida na regra e no smoke em `next start` (www.localhost:<porta>).
    const redirects = await createNextConfig(DEV).redirects!()
    expect(redirects).toEqual([
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www\\.localhost' }],
        destination: 'http://localhost:3001/:path*',
        permanent: true,
      },
    ])
    const response = await unstable_getResponseFromNextConfig({
      url: 'http://www.localhost:3001/',
      headers: { host: 'www.localhost:3001' },
      nextConfig: createNextConfig(DEV),
    })
    expect(response.status).toBe(308)
  })

  it('outros hosts não são redirecionados por www', async () => {
    for (const host of [
      'plataforma.example',
      'locadora-www.plataforma.example',
      'wwwx.plataforma.example',
    ]) {
      const response = await unstable_getResponseFromNextConfig({
        url: `https://${host}/`,
        headers: { host },
        nextConfig: createNextConfig(PROD),
      })
      expect(getRedirectUrl(response)).toBeNull()
    }
  })

  it('X-Robots-Tag noindex no host app sempre e em todo host fora de produção', async () => {
    const at = async (env: Record<string, string>, host: string) =>
      (
        await unstable_getResponseFromNextConfig({
          url: `https://${host}/admin`,
          headers: { host },
          nextConfig: createNextConfig(env),
        })
      ).headers.get('x-robots-tag')
    expect(await at(PROD, 'app.plataforma.example')).toBe('noindex, nofollow')
    expect(await at(PROD, 'locadora-a.plataforma.example')).toBeNull()
    expect(await at(PROD, 'plataforma.example')).toBeNull()
    expect(
      await at(
        { ...PROD, PLATFORM_ENV: 'staging' },
        'locadora-a.plataforma.example'
      )
    ).toBe('noindex, nofollow')
    expect(await at(DEV, 'locadora-a.localhost')).toBe('noindex, nofollow')
  })
})

describe('next.config: rewrites', () => {
  it.each(['https://legacy.example', 'https://api.example'])(
    'arquivos públicos não são encaminhados ao destino da API %s',
    async (apiOrigin) => {
      const config = createNextConfig({ ...PROD, WEB_API_ORIGIN: apiOrigin })
      expect(await config.rewrites!()).toEqual({
        beforeFiles: [],
        afterFiles: [],
        fallback: [],
      })
      const paths = [
        ...PUBLIC_FILES.map((name) => '/' + name),
        ...PUBLIC_DIRECTORIES.map((name) => `/${name}/file`),
      ]
      expect(paths).toContain('/favicon.ico')
      expect(paths).toContain('/models/file')
      for (const path of paths) {
        const response = await unstable_getResponseFromNextConfig({
          url: 'https://locadora-a.plataforma.example' + path,
          nextConfig: config,
        })
        expect(isRewrite(response), path).toBe(false)
        expect(getRewrittenUrl(response), path).toBeNull()
      }
    }
  )

  it('não toca nas APIs nem nos arquivos de metadata servidos pelas rotas do host', async () => {
    const nextConfig = createNextConfig(PROD)
    for (const path of [
      '/api/equipments',
      ...HOST_OWNED_PUBLIC_FILES.map((name) => '/' + name),
    ]) {
      const response = await unstable_getResponseFromNextConfig({
        url: 'https://locadora-a.plataforma.example' + path,
        nextConfig,
      })
      expect(isRewrite(response)).toBe(false)
    }
  })

  it('sem WEB_API_ORIGIN nenhum rewrite (public/ local serve os assets)', async () => {
    const rewrites = await createNextConfig({ PLATFORM_ENV: 'development' })
      .rewrites!()
    expect(rewrites).toEqual({ beforeFiles: [], afterFiles: [], fallback: [] })
  })

  it('transpila o contrato da plataforma', () => {
    expect(createNextConfig(DEV).transpilePackages).toContain(
      '@gb-locacoes/contracts'
    )
  })
})

// Onda 135, A3 (E11 do plano de aposentadoria da raiz): as fotos do Supabase Storage pelo next/image. Antes, o host web
// não tinha `images`: o next/image apontava a foto para /_next/image e o otimizador respondia 400 ("url" parameter is
// not allowed), provado em `next start` com uma URL do Supabase. Agora, como a raiz legada, sem o otimizador.
describe('next.config: imagens remotas (A3)', () => {
  const SUPABASE = 'https://abcdefghijklmnopqrst.supabase.co'
  const FOTO = `${SUPABASE}/storage/v1/object/public/equipments/andaime.jpg`
  const comSupabase = { ...PROD, NEXT_PUBLIC_SUPABASE_URL: SUPABASE }

  /** O `<img>` que o next/image monta com a configuração de imagens dada (o mesmo código do componente). */
  const imgSrc = (images: Record<string, unknown> | undefined) =>
    getImgProps(
      { src: FOTO, alt: 'Andaime', width: 640, height: 480 },
      {
        defaultLoader,
        imgConf: { ...imageConfigDefault, ...images },
        showAltText: false,
        blurComplete: false,
      }
    ).props.src

  it('como a raiz legada: sem o otimizador e com o Supabase do projeto nos remotePatterns', () => {
    const { images } = createNextConfig(comSupabase)
    expect(images?.unoptimized).toBe(true)
    expect(images?.remotePatterns).toEqual([
      { protocol: 'https', hostname: 'via.placeholder.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'abcdefghijklmnopqrst.supabase.co' },
    ])
  })

  it('a foto do Supabase sai direto da origem; sem a configuração, ia para o /_next/image recusado', () => {
    expect(imgSrc(createNextConfig(comSupabase).images)).toBe(FOTO)
    // O defeito provado antes da correção: sem `images`, o next/image monta a URL do otimizador...
    expect(imgSrc(undefined)).toMatch(
      /^\/_next\/image\?url=https%3A%2F%2Fabcdefghijklmnopqrst\.supabase\.co/
    )
    // ...e o otimizador só aceita o que está nos remotePatterns: o Supabase do projeto passa, outro host não.
    const patterns = createNextConfig(comSupabase).images!.remotePatterns!
    expect(hasRemoteMatch([], patterns, new URL(FOTO))).toBe(true)
    expect(hasRemoteMatch([], [], new URL(FOTO))).toBe(false)
    expect(
      hasRemoteMatch([], patterns, new URL('https://outro.example/x.jpg'))
    ).toBe(false)
  })

  it('sem NEXT_PUBLIC_SUPABASE_URL ou com URL inválida: só a lista fixa da raiz', () => {
    for (const env of [
      PROD,
      { ...PROD, NEXT_PUBLIC_SUPABASE_URL: '  ' },
      { ...PROD, NEXT_PUBLIC_SUPABASE_URL: 'nao é url' },
    ])
      expect(
        readImageRemotePatterns(env).map((pattern) => pattern.hostname)
      ).toEqual(['via.placeholder.com', 'images.unsplash.com', 'picsum.photos'])
  })
})

// Onda 135, A11 (decisão do dono D4; R4 da ADR adr-tenant-hosts): a tag do Google da locadora só por allowlist, com CSP
// no host dela. O painel (app.) e o apex ficam como estavam.
describe('next.config: CSP por host (A11)', () => {
  const csp = async (env: Record<string, string>, host: string) =>
    (
      await unstable_getResponseFromNextConfig({
        url: `https://${host}/`,
        headers: { host },
        nextConfig: createNextConfig(env),
      })
    ).headers.get('content-security-policy')

  it('host de locadora recebe a CSP; app., www., o apex e outro domínio não', async () => {
    expect(await csp(PROD, 'locadora-a.plataforma.example')).toBe(
      tenantContentSecurityPolicy({ development: false })
    )
    expect(await csp(DEV, 'locadora-a.localhost:3001')).toBe(
      tenantContentSecurityPolicy({ development: false })
    )
    for (const host of [
      'app.plataforma.example',
      'www.plataforma.example',
      'plataforma.example',
      'a.b.plataforma.example',
      'locadora-a.outro.example',
    ])
      expect(await csp(PROD, host), host).toBeNull()
  })

  it('allowlist de script: a tag do Google, o mapa e os selos que a vitrine já carrega; nada de origem aberta', () => {
    const policy = tenantContentSecurityPolicy({ development: false })
    const directives = Object.fromEntries(
      policy.split('; ').map((directive) => {
        const [name, ...values] = directive.split(' ')
        return [name, values]
      })
    ) as Record<string, string[]>
    expect(Object.keys(directives)).toEqual([
      'script-src',
      'worker-src',
      'object-src',
      'base-uri',
    ])
    expect(directives['script-src']).toEqual([
      "'self'",
      "'unsafe-inline'",
      "'wasm-unsafe-eval'",
      'https://*.googletagmanager.com',
      'https://www.googleadservices.com',
      'https://googleads.g.doubleclick.net',
      'https://www.google.com',
      'https://ajax.googleapis.com',
      'https://maps.googleapis.com',
      'https://maps.gstatic.com',
      'https://apis.google.com',
      'https://www.gstatic.com',
    ])
    // Nenhuma origem aberta (curinga, esquema solto, http, data: ou blob:) nem eval de JavaScript em produção.
    for (const value of directives['script-src']!) {
      expect(value).not.toMatch(/^(?:\*|https?:|data:|blob:)$|^http:\/\//)
      expect(value).not.toBe("'unsafe-eval'")
    }
    expect(directives['object-src']).toEqual(["'none'"])
    expect(directives['base-uri']).toEqual(["'self'"])
  })

  it('em desenvolvimento entram o eval do React e o script de depuração da Vercel', async () => {
    const policy = tenantContentSecurityPolicy({ development: true })
    expect(policy).toContain("'unsafe-eval'")
    expect(policy).toContain('https://va.vercel-scripts.com')
    expect(
      await csp(
        { ...DEV, NODE_ENV: 'development' },
        'locadora-a.localhost:3001'
      )
    ).toBe(policy)
  })
})

describe('next.config: paridade com o contrato', () => {
  it.each([
    [{}],
    [{ NODE_ENV: 'production', PLATFORM_ROOT_DOMAIN: 'plataforma.example' }],
    [{ VERCEL_ENV: 'preview', PLATFORM_ROOT_DOMAIN: 'plataforma.example' }],
    [
      {
        PLATFORM_ENV: 'staging',
        PLATFORM_ROOT_DOMAIN: 'staging.plataforma.example',
      },
    ],
    [{ PLATFORM_ENV: 'development', PLATFORM_PUBLIC_PORT: '4000' }],
    [{ PLATFORM_ENV: ' development ', PLATFORM_ROOT_DOMAIN: ' localhost ' }],
    [
      {
        PLATFORM_ENV: 'production',
        VERCEL_ENV: 'preview',
        PLATFORM_ROOT_DOMAIN: 'plataforma.example',
      },
    ],
  ])(
    'ambiente, domínio, protocolo e porta iguais a resolvePlatformEnv: %j',
    (env: Record<string, string>) => {
      const secrets = {
        PLATFORM_EDGE_SECRET: 'x'.repeat(32),
        WEB_API_ORIGIN: 'https://backend.example',
      }
      const contract = resolvePlatformEnv({ ...secrets, ...env })
      expect(readPlatformBuildEnv(env)).toEqual({
        environment: contract.environment,
        rootDomain: contract.rootDomain,
        protocol: contract.protocol,
        publicPort: contract.publicPort,
      })
    }
  )

  it('recusa PLATFORM_ENV e domínio inválidos, como o contrato', () => {
    expect(() => readPlatformBuildEnv({ PLATFORM_ENV: 'prod' })).toThrow(
      'PLATFORM_ENV'
    )
    expect(() => resolvePlatformEnv({ PLATFORM_ENV: 'prod' })).toThrow(
      'PLATFORM_ENV'
    )
    for (const domain of [
      'https://x.example',
      'x.example:443',
      'x.example/',
      'X..example',
    ]) {
      expect(() =>
        readPlatformBuildEnv({ PLATFORM_ROOT_DOMAIN: domain })
      ).toThrow('PLATFORM_ROOT_DOMAIN')
    }
  })

  it('WEB_API_ORIGIN só com a origem', () => {
    const env = { ...PROD, PLATFORM_EDGE_SECRET: 'x'.repeat(32) }
    // A validação continua na fonte única lida pelo proxy/gateway, sem cópia no next.config.
    expect(
      resolveWebPlatformEnv({
        ...env,
        WEB_API_ORIGIN: 'https://backend.example/',
      }).apiOrigin
    ).toBe('https://backend.example')
    expect(
      resolveWebPlatformEnv({ PLATFORM_ENV: 'development' }).apiOrigin
    ).toBeNull()
    expect(() =>
      resolveWebPlatformEnv({
        ...env,
        WEB_API_ORIGIN: 'https://backend.example/api',
      })
    ).toThrow()
    expect(() =>
      resolveWebPlatformEnv({
        ...env,
        WEB_API_ORIGIN: 'https://u:p@backend.example',
      })
    ).toThrow()
  })
})
