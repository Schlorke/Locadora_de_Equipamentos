'use client'

import { AreaClienteLayout } from '../../packages/frontend/src/widgets/cabecalho/ui/AreaCliente.web'

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AreaClienteLayout>{children}</AreaClienteLayout>
}
