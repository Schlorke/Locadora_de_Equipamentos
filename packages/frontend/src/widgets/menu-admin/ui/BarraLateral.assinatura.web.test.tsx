// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import {
  subscriptionFixture,
  subscriptionTenant,
} from '../../../../../../tests/helpers/subscription-account'
vi.mock('next/navigation', () => ({ usePathname: () => '/admin/assinatura' }))
vi.mock('../../../features/selos-admin', () => ({
  useAdminBadges: () => ({ badges: {} }),
}))
import AdminSidebar from './BarraLateral.web'
import MobileSidebar from './BarraLateralMobile.web'
afterEach(cleanup)
it.each(['desktop', 'mobile'] as const)(
  'menu %s espera confirmação do servidor e aponta para a slice compartilhada',
  async (mode) => {
    const fetcher = vi.fn(async () => Response.json(subscriptionFixture()))
    render(
      <ApiClientProvider client={createHttpClient({ fetcher })}>
        <FrontendSessionFixture tenant={subscriptionTenant()}>
          {mode === 'desktop' ? (
            <AdminSidebar />
          ) : (
            <MobileSidebar isOpen onClose={() => {}} />
          )}
        </FrontendSessionFixture>
      </ApiClientProvider>
    )
    const label = await screen.findByText('Assinatura')
    expect(label.closest('a')?.getAttribute('href')).toBe('/admin/assinatura')
    expect(
      screen.getByText('Recebimentos').closest('a')?.getAttribute('href')
    ).toBe('/admin/recebimentos')
    expect(label.closest('a')?.className).toContain('text-white')
    expect(fetcher).toHaveBeenCalledTimes(1)
  }
)
it.each(['desktop', 'mobile'] as const)(
  'menu %s não confunde ADMIN com dono',
  async (mode) => {
    const fetcher = vi.fn(async () =>
      Response.json({ code: 'OWNER_REQUIRED' }, { status: 403 })
    )
    render(
      <ApiClientProvider client={createHttpClient({ fetcher })}>
        <FrontendSessionFixture tenant={subscriptionTenant()}>
          {mode === 'desktop' ? (
            <AdminSidebar />
          ) : (
            <MobileSidebar isOpen onClose={() => {}} />
          )}
        </FrontendSessionFixture>
      </ApiClientProvider>
    )
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Assinatura')).toBeNull()
    expect(screen.queryByText('Recebimentos')).toBeNull()
  }
)
