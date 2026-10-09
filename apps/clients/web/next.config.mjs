import path from 'node:path'

const workspaceRoot = path.join(import.meta.dirname, '..', '..', '..')

const ENVIRONMENTS = ['development', 'preview', 'staging', 'production']
const ROOT_DOMAIN_RE =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Subconjunto de `resolvePlatformEnv` (@gb-locacoes/contracts/platform) que a configuração precisa em tempo de
 * build: ambiente, domínio raiz e porta pública de desenvolvimento. Mesma precedência (PLATFORM_ENV, VERCEL_ENV,
 * NODE_ENV); a paridade é provada em src/host/routing/next-config.test.ts. A validação completa (segredos,
 * WEB_API_ORIGIN em https) fica no proxy, que responde 503 quando o ambiente é inválido.
 */
export function readPlatformBuildEnv(env) {
  const read = (key) =>
    typeof env[key] === 'string' && env[key].trim() !== ''
      ? env[key].trim()
      : null
  const explicit = read('PLATFORM_ENV')
  const vercelEnv = read('VERCEL_ENV')
  if (explicit !== null && !ENVIRONMENTS.includes(explicit))
    throw new Error(`PLATFORM_ENV deve ser um de: ${ENVIRONMENTS.join(', ')}.`)
  const environment =
    explicit ??
    (vercelEnv === 'preview'
      ? 'preview'
      : vercelEnv === 'production' || read('NODE_ENV') === 'production'
        ? 'production'
        : 'development')
  const rootDomain = read('PLATFORM_ROOT_DOMAIN') ?? 'localhost'
  if (!ROOT_DOMAIN_RE.test(rootDomain))
    throw new Error(
      'PLATFORM_ROOT_DOMAIN deve ser um domínio em minúsculas, sem esquema, porta, caminho ou ponto final.'
    )
  const development = environment === 'development'
  const rawPort = development ? read('PLATFORM_PUBLIC_PORT') : null
  const publicPort = development
    ? rawPort === null
      ? 3001
      : Number(rawPort)
    : null
  if (
    publicPort !== null &&
    !(Number.isInteger(publicPort) && publicPort >= 1 && publicPort <= 65535)
  )
    throw new Error('PLATFORM_PUBLIC_PORT deve ser uma porta entre 1 e 65535.')
  const protocol = development ? 'http' : 'https'
  return { environment, rootDomain, protocol, publicPort }
}

/** Hosts de imagem remota que a raiz legada já aceitava (next.config.mjs da raiz), além do Supabase do projeto. */
const LEGACY_REMOTE_IMAGE_HOSTS = [
  'via.placeholder.com',
  'images.unsplash.com',
  'picsum.photos',
]

/**
 * Imagens remotas do next/image (onda 135, A3; E11 do plano de aposentadoria da raiz), como a raiz legada: as fotos dos
 * equipamentos, o logo e o carrossel vêm do Supabase Storage (`https://<projeto>.supabase.co/storage/...`). Sem o
 * hostname do Supabase em `remotePatterns`, o otimizador recusa a URL ("url" parameter is not allowed, HTTP 400) e a
 * foto não aparece. O hostname vem de NEXT_PUBLIC_SUPABASE_URL (a mesma variável do backend); URL inválida fica de fora,
 * só com a lista fixa da raiz.
 */
export function readImageRemotePatterns(env) {
  const patterns = LEGACY_REMOTE_IMAGE_HOSTS.map((hostname) => ({
    protocol: 'https',
    hostname,
  }))
  const supabase =
    typeof env.NEXT_PUBLIC_SUPABASE_URL === 'string'
      ? env.NEXT_PUBLIC_SUPABASE_URL.trim()
      : ''
  if (supabase !== '') {
    try {
      patterns.push({ protocol: 'https', hostname: new URL(supabase).hostname })
    } catch {
      // URL inválida: só a lista fixa (o otimizador continua recusando o que não está nela).
    }
  }
  return patterns
}

/**
 * Origens de script do host de locadora (onda 135, A11; R4 da ADR adr-tenant-hosts: tag e pixel só por allowlist, com CSP
 * por host). A vitrine põe a tag do Google da locadora (GA4 e Google Ads) só com os IDs validados dela; o resto da lista
 * são os scripts que a vitrine já carrega (mapa da loja e selos do Google). `'unsafe-inline'` cobre os scripts inline do
 * Next e a configuração da tag: o nonce exigiria ler os cabeçalhos na árvore [locadora], que a D4 proíbe. O que a lista
 * barra é script de outra origem. `'wasm-unsafe-eval'` só compila WebAssembly (decodificadores do carrossel 3D), não
 * libera eval de JavaScript; em desenvolvimento entram o eval do React e o script de depuração da Vercel.
 */
const TENANT_SCRIPT_SOURCES = [
  "'self'",
  "'unsafe-inline'",
  "'wasm-unsafe-eval'",
  // Tag do Google da locadora (gtag.js) e as conversões do Google Ads.
  'https://*.googletagmanager.com',
  'https://www.googleadservices.com',
  'https://googleads.g.doubleclick.net',
  'https://www.google.com',
  // Mapa da loja: Extended Component Library e Maps JavaScript API.
  'https://ajax.googleapis.com',
  'https://maps.googleapis.com',
  'https://maps.gstatic.com',
  // Selos do Google Avaliações do Consumidor e do Merchant Center.
  'https://apis.google.com',
  'https://www.gstatic.com',
]
const DEVELOPMENT_SCRIPT_SOURCES = [
  "'unsafe-eval'",
  'https://va.vercel-scripts.com',
]

/** Content-Security-Policy do host de locadora (vitrine e área do cliente). */
export function tenantContentSecurityPolicy({ development }) {
  const scripts = [
    ...TENANT_SCRIPT_SOURCES,
    ...(development ? DEVELOPMENT_SCRIPT_SOURCES : []),
  ]
  return [
    `script-src ${scripts.join(' ')}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ')
}

export function createNextConfig(env = process.env) {
  const platform = readPlatformBuildEnv(env)
  const root = escapeRegExp(platform.rootDomain)
  const apexOrigin = `${platform.protocol}://${platform.rootDomain}${platform.publicPort === null ? '' : ':' + platform.publicPort}`
  const noindex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]
  const tenantCsp = tenantContentSecurityPolicy({
    development: env.NODE_ENV === 'development',
  })
  return {
    reactStrictMode: true,
    images: {
      unoptimized: true,
      remotePatterns: readImageRemotePatterns(env),
    },
    transpilePackages: [
      '@gb-locacoes/frontend',
      '@gb-locacoes/ui',
      '@gb-locacoes/design-tokens',
      '@gb-locacoes/contracts',
    ],
    outputFileTracingRoot: workspaceRoot,
    turbopack: { root: workspaceRoot },
    async headers() {
      return [
        // Painel e fluxos da equipe nunca são indexados; fora de produção, nenhum host é.
        {
          source: '/:path*',
          has: [{ type: 'host', value: `app\\.${root}` }],
          headers: noindex,
        },
        ...(platform.environment === 'production'
          ? []
          : [{ source: '/:path*', headers: noindex }]),
        // CSP por host (onda 135, A11): só o host de uma locadora ({slug}.<raiz>), onde entra a tag do Google dela.
        {
          source: '/:path*',
          has: [
            {
              type: 'host',
              value: `[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.${root}`,
            },
          ],
          missing: [{ type: 'host', value: `(?:app|www)\\.${root}` }],
          headers: [{ key: 'Content-Security-Policy', value: tenantCsp }],
        },
      ]
    },
    async redirects() {
      // www responde 308 para o apex antes do proxy; o proxy repete como rede de segurança (preview incluso).
      return [
        {
          source: '/:path*',
          has: [{ type: 'host', value: `www\\.${root}` }],
          destination: `${apexOrigin}/:path*`,
          permanent: true,
        },
      ]
    },
    async rewrites() {
      // Todo /api/* passa pelo proxy (rewrite externo com contexto de borda); a entrada /api saiu do fallback.
      // public/ pertence ao cliente web, independente do destino da API. O predev/prebuild sincroniza a fonte
      // canônica da raiz para uma pasta real em apps/clients/web/public; o Next serve essa cópia antes das rotas dinâmicas.
      return {
        beforeFiles: [],
        afterFiles: [],
        fallback: [],
      }
    },
  }
}

export default createNextConfig()
