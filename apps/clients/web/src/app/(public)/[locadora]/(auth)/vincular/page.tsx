import { notFound } from 'next/navigation'
import { isTenantSlug } from '@gb-locacoes/contracts/platform'
import { VincularLocadoraPage } from '@gb-locacoes/frontend/pages/vincular-locadora'
import { getTenantSite } from '../../../../../host/server/public-api'

/**
 * Vínculo explícito do cliente com a locadora do host (`{slug}.<raiz>/vincular`). Oculto em `legacy` pelo layout do
 * grupo `(auth)` e pelo proxy (desenho 4.6). O nome vem do mesmo cartão que o layout já leu, no escopo da área do
 * cliente (S13; B.5, linha "Área do cliente final"): continua com o site em pausa ou desligado por falta de
 * publicação. A locadora do vínculo é decidida só pelo backend, a partir do Host.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ locadora: string }>
}) {
  const { locadora } = await params
  if (!isTenantSlug(locadora)) notFound()
  const site = await getTenantSite(locadora)
  if (!site) notFound()
  return <VincularLocadoraPage tenantName={site.name} />
}
