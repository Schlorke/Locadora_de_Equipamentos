import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { getPublicSite } from '../../../../host/server/public-api'

/**
 * Vitrine da locadora (S13; B.5, linha "Site público"): no ar ou em pausa. Com o site desligado (não publicado), a
 * locadora ainda tem a área do cliente (o layout pai a atende), mas a vitrine é o 404 neutro do D10. O proxy já
 * entrega esse 404 antes de renderizar (status real também nas páginas que esperam a sessão); aqui é a mesma decisão
 * quando a leitura do proxy falhou. Mesma leitura do layout pai, deduplicada na requisição.
 */
export default async function StorefrontLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locadora: string }>
}) {
  const { locadora } = await params
  if (!(await getPublicSite(locadora))) notFound()
  return <>{children}</>
}
