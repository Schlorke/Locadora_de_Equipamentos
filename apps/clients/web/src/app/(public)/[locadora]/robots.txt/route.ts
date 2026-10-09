import { notFound } from 'next/navigation'
import {
  canonicalOrigin,
  isTenantSlug,
  resolveWebPlatformEnv,
} from '@gb-locacoes/contracts/platform'
import { fetchPublicSite } from '../../../../host/server/public-api'
import { SITE_PAUSED_PAGE } from '../../../../host/server/site-state'

export const dynamic = 'force-dynamic'

/**
 * Áreas privadas da vitrine: entrada e área do cliente (as mesmas de `TENANT_ACCOUNT_PATHS`, conferidas no teste; a
 * árvore [locadora] não importa a tabela do proxy), APIs, painel e a página de pausa.
 */
const PRIVATE_PATHS = [
  '/entrar',
  '/login',
  '/cadastro',
  '/recuperar-senha',
  '/reset-password',
  '/auth/callback',
  '/vincular',
  '/area-cliente',
  '/api/',
  '/admin',
  SITE_PAUSED_PAGE,
]

/**
 * robots.txt da locadora (S13 e ADR de hosts, D12 e "SEO"). Site desligado (OFF): o 404 neutro do D10. Site em pausa
 * ou ainda não indexável, e todo ambiente fora de produção: `Disallow: /`. No ar e indexável: as áreas privadas fora
 * e o sitemap na origem canônica.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ locadora: string }> }) {
  const { locadora } = await params
  if (!isTenantSlug(locadora)) notFound()
  const site = await fetchPublicSite(locadora)
  if (!site) notFound()
  const env = resolveWebPlatformEnv(process.env)
  const open = site.indexable && env.environment === 'production'
  const lines = open
    ? [
        'User-agent: *',
        'Allow: /',
        ...PRIVATE_PATHS.map((path) => 'Disallow: ' + path),
        '',
        'Sitemap: ' + canonicalOrigin(env, { slug: site.slug }) + '/sitemap.xml',
      ]
    : ['User-agent: *', 'Disallow: /']
  return new Response(lines.join('\n') + '\n', {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': site.mode === 'PAUSED' ? 'no-store' : 'public, max-age=300',
    },
  })
}
