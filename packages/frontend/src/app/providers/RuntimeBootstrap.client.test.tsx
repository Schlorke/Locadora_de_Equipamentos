// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  useApiClient,
  type HttpClient,
  type HttpRequest,
} from '../../shared/api'
import { switchCartScope } from '../../features/carrinho'

const state = vi.hoisted(() => ({ id: 'tenant-a', slug: 'alfa' }))
vi.mock('../../features/selecionar-locadora', () => ({
  useTenantSelection: () => ({
    selection: {
      tenant: {
        id: state.id,
        slug: state.slug,
        name: state.slug,
        status: 'ACTIVE',
      },
      membershipId: state.id,
      role: 'ADMIN',
    },
    loading: false,
    memberships: [],
    clear: vi.fn(),
    select: vi.fn(),
    refresh: vi.fn(),
  }),
  useHostTenantMembership: () => ({
    membership: {
      tenant: {
        id: state.id,
        slug: state.slug,
        name: state.slug,
        status: 'ACTIVE',
      },
      membershipId: state.id,
      role: 'ADMIN',
    },
    status: 'ready',
    refresh: vi.fn(),
  }),
  useTenantSuggestion: () => ({
    pending: null,
    accept: vi.fn(),
    dismiss: vi.fn(),
  }),
  TenantSelector: () => null,
  HostMembershipNotice: () => null,
}))
import { RuntimeBootstrap } from './RuntimeBootstrap'

const clients: HttpClient[] = []
function Capture() {
  clients.push(useApiClient())
  return null
}
afterEach(async () => {
  cleanup()
  await switchCartScope(null)
  clients.length = 0
  state.id = 'tenant-a'
  state.slug = 'alfa'
})
it('um cliente capturado mantém o header da locadora original após trocar a seleção', async () => {
  const request = vi.fn(async (_path: string, _options?: HttpRequest) => ({}))
  const props = {
    apiClient: { request } as HttpClient,
    auth: { getSession: async () => null, signOut: async () => undefined },
    initialSession: { user: { id: 'ana' }, expires: '2099-01-01' },
    publicTenantSlug: 'alfa',
    privateArea: true,
    tenantMode: 'selection' as const,
  }
  const view = render(
    <RuntimeBootstrap {...props}>
      <Capture />
    </RuntimeBootstrap>
  )
  const original = clients.at(-1)!
  state.id = 'tenant-b'
  state.slug = 'bravo'
  view.rerender(
    <RuntimeBootstrap {...props}>
      <Capture />
    </RuntimeBootstrap>
  )
  const current = clients.at(-1)!
  await original.request('/api/user/profile', { method: 'PUT' })
  await current.request('/api/user/profile', { method: 'PUT' })
  expect(
    request.mock.calls.map(([, options]) => options?.headers?.['x-tenant-id'])
  ).toEqual(['tenant-a', 'tenant-b'])
  expect(original).not.toBe(current)
})
it('o modo host não envia seleção por header', async () => {
  const request = vi.fn(async (_path: string, _options?: HttpRequest) => ({}))
  render(
    <RuntimeBootstrap
      apiClient={{ request } as HttpClient}
      auth={{ getSession: async () => null, signOut: async () => undefined }}
      initialSession={{ user: { id: 'ana' }, expires: '2099-01-01' }}
      publicTenantSlug="alfa"
      privateArea
      tenantMode="host"
    >
      <Capture />
    </RuntimeBootstrap>
  )
  await clients.at(-1)!.request('/api/user/profile')
  expect(request.mock.calls[0]![1]?.headers).not.toHaveProperty('x-tenant-id')
})
