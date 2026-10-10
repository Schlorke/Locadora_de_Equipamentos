'use client'

import type { ReactNode } from 'react'
import { AreaClienteLayout } from '../../widgets/cabecalho'

/**
 * Moldura da área do cliente (onda 135, A5): menu lateral, contador de notificações não lidas e diálogo de saída, a
 * mesma composição que a antiga `app/area-cliente/layout.tsx`, retirada em F, montava. Mora na camada app, como a do
 * painel (`AdminLayoutShell`): o host só a escolhe no layout do grupo. Sessão e vínculo com a locadora continuam com o
 * portão da área privada do host (`PrivateAreaGate`), que só abre a rota com o cliente identificado.
 */
export function AccountLayoutShell({ children }: { children: ReactNode }) {
  return <AreaClienteLayout>{children}</AreaClienteLayout>
}
