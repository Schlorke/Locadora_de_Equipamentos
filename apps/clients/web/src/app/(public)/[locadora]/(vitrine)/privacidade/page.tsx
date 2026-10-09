import { notFound } from 'next/navigation'
import { isTenantSlug } from '@gb-locacoes/contracts/platform'
import { PrivacidadePage } from '@gb-locacoes/frontend/pages/privacidade'
import { getPublicLegalDocument } from '../../../../../host/server/public-api'
import { molduraDaPausa } from '../pausa'
import { metadataDaVitrine } from '../seo'

interface Props {
  params: Promise<{ locadora: string }>
}

// SEO da própria locadora (onda 135, A4): título, descrição, canonical e Open Graph na origem dela.
export async function generateMetadata({ params }: Props) {
  return metadataDaVitrine((await params).locadora, 'privacidade')
}

/**
 * Documento legal publicado pela própria locadora (onda 134; decisão do dono de 2026-10-06, item 3), lido no servidor.
 * Sem documento (404 do backend), o 404 dentro da moldura da locadora; outra falha lança (nunca um 404 falso). Em pausa
 * (S13), a página continua no ar com a moldura neutra (o proxy responde 200, noindex e sem cache).
 */
export default async function Page({ params }: Props) {
  const { locadora } = await params
  if (!isTenantSlug(locadora)) notFound()
  const [documento, moldura] = await Promise.all([
    getPublicLegalDocument(locadora, 'privacy'),
    molduraDaPausa(locadora),
  ])
  if (!documento) notFound()
  return <PrivacidadePage documento={documento} moldura={moldura} />
}
