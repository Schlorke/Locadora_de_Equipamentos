import { notFound } from 'next/navigation'
import { isTenantSlug } from '@gb-locacoes/contracts/platform'
import { CookiesPage } from '@gb-locacoes/frontend/pages/cookies'
import { molduraDaPausa } from '../pausa'
import { metadataDaVitrine } from '../seo'

interface Props {
  params: Promise<{ locadora: string }>
}

// SEO da própria locadora (onda 135, A4): título, descrição, canonical e Open Graph na origem dela.
export async function generateMetadata({ params }: Props) {
  return metadataDaVitrine((await params).locadora, 'cookies')
}

/** Política de Cookies (texto da plataforma). Em pausa continua no ar, com a moldura neutra da locadora (onda 134). */
export default async function Page({ params }: Props) {
  const { locadora } = await params
  if (!isTenantSlug(locadora)) notFound()
  return <CookiesPage moldura={await molduraDaPausa(locadora)} />
}
