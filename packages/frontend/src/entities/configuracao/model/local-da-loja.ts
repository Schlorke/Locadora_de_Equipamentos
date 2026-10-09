// Local da loja da própria locadora (onda 134, lote vitrine-conteúdo): o `storeLocation` do conteúdo institucional no
// formato do localizador do Google (Quick Builder) que `features/mapa-loja` desenha. Sem local declarado, nenhum mapa.
import type { SiteContent } from '@gb-locacoes/contracts/settings'

/** Endereço da loja no formato do Quick Builder do Google (o mesmo de `features/mapa-loja`). */
export interface LocalDaLojaPublico {
  title: string
  address1: string
  address2?: string
  coords: { lat: number; lng: number }
  placeId?: string
}

/** Local para o mapa: o nome do cartão da locadora e o `storeLocation` dela; sem um dos dois, `null`. */
export function localDaLoja(
  conteudo: Pick<SiteContent, 'storeLocation'> | null | undefined,
  nome: string | null | undefined
): LocalDaLojaPublico | null {
  const local = conteudo?.storeLocation
  const titulo = nome?.trim()
  if (!local || !titulo) return null
  return {
    title: titulo,
    address1: local.addressLine1,
    ...(local.addressLine2 ? { address2: local.addressLine2 } : {}),
    coords: { lat: local.latitude, lng: local.longitude },
    ...(local.placeId ? { placeId: local.placeId } : {}),
  }
}

/** Link do mapa (`hasMap` do JSON-LD), como a produção: `https://www.google.com/maps?q=<lat>,<lng>&hl=pt-BR`. */
export function linkDoMapa(
  conteudo: Pick<SiteContent, 'storeLocation'> | null | undefined
): string | null {
  const local = conteudo?.storeLocation
  return local
    ? `https://www.google.com/maps?q=${local.latitude},${local.longitude}&hl=pt-BR`
    : null
}
