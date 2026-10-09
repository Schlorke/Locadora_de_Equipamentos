// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InternalRoutePrefixProvider } from '../../../shared/lib/navigation'

const router = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('../../../entities/assinatura', () => ({
  useOwnerSubscription: () => ({
    state: { kind: 'problem', problem: 'owner' },
  }),
}))
vi.mock('next/navigation', () => ({ usePathname: () => router.pathname }))
vi.mock('../../../entities/sessao', () => ({
  useSession: () => ({ data: { user: { name: 'Ana', role: 'ADMIN' } } }),
  useSignOut: () => () => undefined,
}))
vi.mock('../../../features/selos-admin', () => ({
  useAdminBadges: () => ({ badges: {} }),
}))

import AdminSidebar from './BarraLateral.web'

afterEach(cleanup)

const isActive = (title: string) =>
  screen.getByTitle(title).className.split(/\s+/).includes('text-white')

describe('AdminSidebar: item ativo pelo caminho visível', () => {
  it('ignora o prefixo interno /{slug} do modo host', () => {
    // O slug contém uma palavra de rota; pelo caminho interno nenhum item casaria.
    router.pathname = '/whatsapp-sp/admin/settings'
    render(
      <InternalRoutePrefixProvider prefix="/whatsapp-sp">
        <AdminSidebar />
      </InternalRoutePrefixProvider>
    )
    expect(isActive('Configurações')).toBe(true)
    expect(isActive('WhatsApp')).toBe(false)
  })

  it('fora do modo host usa o caminho do roteador', () => {
    router.pathname = '/admin/whatsapp'
    render(<AdminSidebar />)
    expect(isActive('WhatsApp')).toBe(true)
    expect(isActive('Configurações')).toBe(false)
  })
})
