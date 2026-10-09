// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../shared/api'
import { FrontendSessionFixture } from '../../../../../tests/helpers/frontend-session'
import {
  subscriptionFixture,
  subscriptionTenant,
} from '../../../../../tests/helpers/subscription-account'
import { AdminLayoutShell } from './AdminLayoutShell.web'
import { AppProviders } from './AppProviders'
import { PrivateAreaGate } from './RuntimeBootstrap'

const route = vi.hoisted(() => ({ pathname: '/admin/recebimentos' }))
vi.mock('next/navigation', () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('../../features/selos-admin', () => ({
  useAdminBadges: () => ({ badges: {} }),
}))
vi.mock('../../features/notificacoes', () => ({
  useNotifications: () => ({
    notifications: [],
    stats: { unread: 0 },
    isLoading: false,
  }),
}))

beforeEach(() => {
  route.pathname = '/admin/recebimentos'
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }))
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: vi.fn(),
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const tree = () => (
  <ApiClientProvider
    client={createHttpClient({
      fetcher: async () => Response.json(subscriptionFixture()),
    })}
  >
    <FrontendSessionFixture tenant={subscriptionTenant()}>
      <AdminLayoutShell>
        <p>Consulta da conta atual</p>
      </AdminLayoutShell>
    </FrontendSessionFixture>
  </ApiClientProvider>
)

it('composes the real owner menu, headers and content without another session provider', async () => {
  render(tree())
  expect(screen.getByRole('main').textContent).toContain(
    'Consulta da conta atual'
  )
  const entries = await screen.findAllByTitle('Recebimentos')
  expect(
    entries.every(
      (entry) => entry.getAttribute('href') === '/admin/recebimentos'
    )
  ).toBe(true)
  expect(document.body.classList.contains('admin-body-layout')).toBe(true)
  expect(
    screen.getByRole('button', { name: 'Abrir menu de navegação' })
  ).toBeTruthy()
})

it('coordinates desktop collapse and mobile open/Escape close through the existing widgets', async () => {
  render(tree())
  await screen.findAllByTitle('Recebimentos')
  fireEvent.click(screen.getByTitle('Recolher sidebar'))
  expect(screen.getByTitle('Expandir sidebar')).toBeTruthy()
  fireEvent.click(
    screen.getByRole('button', { name: 'Abrir menu de navegação' })
  )
  expect(document.body.style.overflow).toBe('hidden')
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(document.body.style.overflow).toBe('auto')
})

// Achado 148: o fundo do painel usa o token semântico do design-tokens (mesmo valor do gray-50 da produção), não a
// paleta escrita como classe (`bg-[var(--color-gray-50)]`, contada pela catraca tailwind-palette-class).
it('paints the panel canvas with the semantic token that keeps the production gray-50', async () => {
  const view = render(tree())
  await screen.findAllByTitle('Recebimentos')
  const shell = view.container.firstElementChild as HTMLElement
  const panel = screen.getByRole('main')
  for (const element of [shell, panel]) {
    expect(element.className).toContain('bg-[var(--surface-admin-canvas)]')
    expect(element.className).not.toMatch(/--color-|\bbg-gray-\d/)
  }
  const read = (file: string) =>
    readFileSync(
      new URL('../../../../design-tokens/src/' + file, import.meta.url),
      'utf8'
    )
  const valueOf = (css: string, name: string) =>
    new RegExp('\\n\\s*' + name + ':\\s*([^;]+);').exec(css)?.[1]?.trim()
  expect(valueOf(read('tokens.css'), '--surface-admin-canvas')).toBe(
    valueOf(read('palette.css'), '--color-gray-50')
  )
  expect(valueOf(read('palette.css'), '--color-gray-50')).toBe('#f9fafb')
})

it('leaves the login route outside the panel chrome and cleans up the body class', () => {
  route.pathname = '/admin/login'
  const view = render(tree())
  expect(screen.getByText('Consulta da conta atual')).toBeTruthy()
  expect(screen.queryByRole('main')).toBeNull()
  expect(screen.queryByTitle('Recebimentos')).toBeNull()
  view.unmount()
  expect(document.body.classList.contains('admin-body-layout')).toBe(false)
})

it('scrolls the panel main after visible route changes', () => {
  const view = render(tree())
  const panel = screen.getByRole('main')
  expect(panel.scrollTo).toHaveBeenCalledOnce()
  route.pathname = '/admin/assinatura'
  view.rerender(tree())
  expect(panel.scrollTo).toHaveBeenCalledTimes(2)
  expect(window.scrollTo).toHaveBeenCalledTimes(2)
})

function runtimeTree(selected: boolean) {
  const member = subscriptionTenant()
  const session = {
    user: { id: 'owner-alfa', name: 'Dono teste', role: 'ADMIN' },
    expires: '2099-01-01T00:00:00.000Z',
  }
  const client = createHttpClient({
    fetcher: async (path: string) =>
      Response.json(
        path === '/api/auth/organizations'
          ? { memberships: [member] }
          : path === '/api/auth/organizations/selection'
            ? { selection: selected ? member : null }
            : path === '/api/admin/subscription'
              ? subscriptionFixture()
              : { items: [] }
      ),
  })
  return (
    <AppProviders
      auth={{ getSession: async () => session, signOut: async () => {} }}
      apiClient={client}
      initialSession={session}
      privateArea
      refreshKey="/admin/recebimentos"
    >
      <PrivateAreaGate headerInContent>
        <AdminLayoutShell>
          <p>Conta reservada da locadora</p>
        </AdminLayoutShell>
      </PrivateAreaGate>
    </AppProviders>
  )
}

it('places the real selector within main after the unchanged session/selection gate opens', async () => {
  render(runtimeTree(true))
  const content = await screen.findByText('Conta reservada da locadora')
  const selector = screen.getByRole('region', { name: 'Locadora do painel' })
  expect(selector.closest('main')).toBe(content.closest('main'))
  expect(
    screen.getAllByRole('region', { name: 'Locadora do painel' })
  ).toHaveLength(1)
})

it('keeps selection accessible and private content closed when there is no selected membership', async () => {
  render(runtimeTree(false))
  await screen.findByRole('combobox')
  expect(
    screen.getByRole('region', { name: 'Locadora do painel' })
  ).toBeTruthy()
  expect(screen.queryByText('Conta reservada da locadora')).toBeNull()
  expect(screen.queryByRole('main')).toBeNull()
})
