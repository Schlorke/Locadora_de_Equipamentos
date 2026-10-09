import type { ReactNode } from 'react'
import {
  TenantProvider,
  type TenantContext,
} from '../../packages/frontend/src/entities/organizacao'
import { ApplicationSessionProvider } from '../../packages/frontend/src/entities/sessao'

export function FrontendSessionFixture({
  children,
  tenant = null,
  userId = 'catalog-user',
}: {
  children: ReactNode
  tenant?: TenantContext | null
  userId?: string
}) {
  return (
    <TenantProvider value={tenant}>
      <ApplicationSessionProvider
        value={{
          data: { user: { id: userId } },
          status: 'authenticated',
          update: async () => null,
          signOut: async () => {},
        }}
      >
        {children}
      </ApplicationSessionProvider>
    </TenantProvider>
  )
}
