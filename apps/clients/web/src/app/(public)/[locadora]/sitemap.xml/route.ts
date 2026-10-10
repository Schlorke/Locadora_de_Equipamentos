import { notFound } from 'next/navigation'
import {
  canonicalOrigin,
  isTenantSlug,
  resolveWebPlatformEnv,
} from '@gb-locacoes/contracts/platform'
import {
  fetchPublicSettings,
  fetchPublicSitemapCatalog,
  fetchPublicSite,
} from '../../../../host/server/public-api'

export const dynamic = 'force-dynamic'

type ChangeFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

/** Uma URL do sitemap; `lastmod` só quando há data (ISO). */
interface SitemapEntry {
  readonly path: string
  readonly lastmod?: string
  readonly changefreq: ChangeFrequency
  readonly priority: number
}

/**
 * Frequência e prioridade de cada página preservadas do antigo app/sitemap.ts, retirado com a raiz em F
 * (onda 135, A7; M3 do plano). As páginas fixas e as legais continuam levando a data da geração.
 */
const PAGE_RANK: ReadonlyMap<
  string,
  Pick<SitemapEntry, 'changefreq' | 'priority'>
> = new Map([
  ['/', { changefreq: 'daily', priority: 1 }],
  ['/equipamentos', { changefreq: 'weekly', priority: 0.9 }],
  ['/sobre', { changefreq: 'monthly', priority: 0.7 }],
  ['/contato', { changefreq: 'monthly', priority: 0.8 }],
  ['/orcamento', { changefreq: 'weekly', priority: 0.8 }],
  ['/privacidade', { changefreq: 'yearly', priority: 0.3 }],
  ['/termos', { changefreq: 'yearly', priority: 0.3 }],
  ['/cookies', { changefreq: 'yearly', priority: 0.3 }],
])
const EQUIPMENT_RANK = { changefreq: 'weekly', priority: 0.8 } as const
const CATEGORY_RANK = { changefreq: 'weekly', priority: 0.7 } as const

/** Páginas públicas fixas da vitrine (as mesmas do sitemap do host anterior, sem as legais da locadora). */
const PUBLIC_PAGES = ['/', '/equipamentos', '/sobre', '/contato', '/orcamento']

/**
 * Páginas legais do sitemap (as do host anterior), na ordem dele: Privacidade e Termos só quando a locadora os publicou
 * (onda 134; sem documento, a página é 404) e a Política de Cookies, da plataforma, sempre. A de Devolução continua fora,
 * como na produção.
 */
async function legalPages(slug: string): Promise<string[]> {
  const settings = await fetchPublicSettings(slug)
  const published =
    settings?.legalDocuments && typeof settings.legalDocuments === 'object'
      ? (settings.legalDocuments as Record<string, unknown>)
      : {}
  return [
    ...(published.privacy === true ? ['/privacidade'] : []),
    ...(published.terms === true ? ['/termos'] : []),
    '/cookies',
  ]
}

const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`)

/** Uma linha `<url>` do protocolo de sitemaps (loc, lastmod opcional, changefreq e priority). */
function urlElement(origin: string, entry: SitemapEntry): string {
  const loc = escapeXml(origin + (entry.path === '/' ? '/' : entry.path))
  const lastmod =
    entry.lastmod === undefined
      ? ''
      : `<lastmod>${escapeXml(entry.lastmod)}</lastmod>`
  return `  <url><loc>${loc}</loc>${lastmod}<changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority></url>\n`
}

/**
 * sitemap.xml da locadora (S13 e ADR de hosts, D12). Site desligado (OFF): o 404 neutro do D10. Site em pausa ou
 * ainda não indexável: sitemap vazio e `noindex`. No ar e indexável: páginas fixas, equipamentos disponíveis e as
 * categorias com equipamento disponível (`/equipamentos?categoria=`), na origem canônica da locadora, com a frequência,
 * a prioridade e a data de cada URL como o sitemap da raiz legada (onda 135, A7). O equipamento sai sem `lastmod`: a
 * leitura pública do catálogo não traz a data de alteração dele.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locadora: string }> }
) {
  const { locadora } = await params
  if (!isTenantSlug(locadora)) notFound()
  const site = await fetchPublicSite(locadora)
  if (!site) notFound()
  const entries: SitemapEntry[] = []
  if (site.indexable) {
    const generatedAt = new Date().toISOString()
    for (const path of [...PUBLIC_PAGES, ...(await legalPages(site.slug))])
      entries.push({ path, lastmod: generatedAt, ...PAGE_RANK.get(path)! })
    try {
      const catalog = await fetchPublicSitemapCatalog(site.slug)
      for (const id of catalog.equipmentIds)
        entries.push({
          path: '/equipamentos/' + encodeURIComponent(id),
          ...EQUIPMENT_RANK,
        })
      for (const category of catalog.categories)
        entries.push({
          path: '/equipamentos?categoria=' + encodeURIComponent(category.slug),
          ...(category.updatedAt === null
            ? {}
            : { lastmod: category.updatedAt }),
          ...CATEGORY_RANK,
        })
    } catch (error) {
      console.error(
        '[sitemap] catálogo da locadora indisponível; só as páginas fixas',
        {
          error: error instanceof Error ? error.message : 'unknown',
        }
      )
    }
  }
  const origin = canonicalOrigin(resolveWebPlatformEnv(process.env), {
    slug: site.slug,
  })
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.map((entry) => urlElement(origin, entry)).join('') +
    '</urlset>\n'
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control':
        site.mode === 'PAUSED' ? 'no-store' : 'public, max-age=300',
      ...(site.indexable ? {} : { 'x-robots-tag': 'noindex' }),
    },
  })
}
