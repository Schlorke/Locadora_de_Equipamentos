import 'server-only'
import {
  getPublicSettings,
  getPublicSite,
  type PublicSettings,
} from '../../../../host/server/public-api'

/** Quais textos legais a locadora publicou (só `true` conta; fora do contrato, nenhum). */
export interface DocumentosPublicados {
  readonly terms: boolean
  readonly privacy: boolean
  readonly returnPolicy: boolean
}

/** Moldura neutra das páginas legais em pausa: o cartão da locadora e os documentos publicados. */
export interface MolduraDaPausaDoHost {
  readonly nome: string
  readonly cidade: string | null
  readonly uf: string | null
  readonly logoUrl: string | null
  readonly documentos: DocumentosPublicados | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** `legalDocuments` da leitura pública das configurações, só com os booleanos verdadeiros. */
export function documentosPublicados(
  settings: Pick<PublicSettings, 'legalDocuments'> | null
): DocumentosPublicados | null {
  const lidos = settings?.legalDocuments
  if (!isRecord(lidos)) return null
  return {
    terms: lidos.terms === true,
    privacy: lidos.privacy === true,
    returnPolicy: lidos.returnPolicy === true,
  }
}

/**
 * Páginas legais em pausa (onda 134; decisão do dono de 2026-10-06, item 4; S13): o proxy as entrega com 200, noindex e
 * sem cache, e o TenantSiteProviders tira a moldura da vitrine. A página se embrulha na moldura neutra com o cartão da
 * locadora e os links dos documentos publicados. Com o site no ar, nenhuma moldura (`null`). Leituras deduplicadas na
 * requisição (as mesmas do layout).
 */
export async function molduraDaPausa(
  slug: string
): Promise<MolduraDaPausaDoHost | null> {
  const site = await getPublicSite(slug)
  if (site?.mode !== 'PAUSED') return null
  return {
    nome: site.name,
    cidade: site.city,
    uf: site.state,
    logoUrl: site.logoUrl,
    documentos: documentosPublicados(await getPublicSettings(slug)),
  }
}
