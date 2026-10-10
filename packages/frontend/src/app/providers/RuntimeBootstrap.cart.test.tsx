// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AppProviders,
  PrivateAreaGate,
  type HttpClient,
  type TenantContext,
} from '../index.web'
import { useSession } from '../../entities/sessao'
import { switchCartScope, useCartStore } from '../../features/carrinho'

const ana = {
  user: { id: 'ana', name: 'Ana' },
  expires: '2099-01-01T00:00:00.000Z',
}
const membership: TenantContext = {
  tenant: {
    id: 'tenant-a',
    slug: 'locadora-a',
    name: 'Locadora A',
    status: 'ACTIVE',
  },
  membershipId: 'm-a',
  role: 'CLIENT',
}
const scope = JSON.stringify(['locadora-a', 'ana'])
const row = {
  equipmentId: 'servidor',
  quantity: 2,
  days: 7,
  pricePerDay: '90',
  finalPrice: '1260',
  equipment: { name: 'Betoneira', pricePerDay: '100', weeklyDiscount: 10 },
}
function Probe() {
  const items = useCartStore((state) => state.items),
    session = useSession()
  return (
    <>
      <h1>Orçamento</h1>
      <output>
        {items
          .map((item) => `${item.equipmentName}:${item.quantity}`)
          .join(',')}
      </output>
      <button
        onClick={() => {
          void session.update()
        }}
      >
        Atualizar sessão
      </button>
    </>
  )
}
function api(
  role: TenantContext['role'] = 'CLIENT',
  cart: () => Promise<unknown> = async () => ({ items: [row] })
) {
  const request = vi.fn(
    async (path: string, options?: Parameters<HttpClient['request']>[1]) => {
      if (path === '/api/auth/organizations/current')
        return { membership: { ...membership, role } }
      if (path === '/api/auth/organizations')
        return { memberships: [{ ...membership, role }] }
      if (path === '/api/auth/organizations/selection')
        return { selection: { ...membership, role } }
      if (path.startsWith('/api/cart/')) return cart()
      throw new Error(`Rota inesperada: ${path} ${options?.method ?? 'GET'}`)
    }
  )
  return { request, client: { request } as HttpClient }
}
beforeEach(async () => {
  await switchCartScope(null)
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('carrinho ligado ao bootstrap compartilhado', () => {
  it('a rota aguarda o carrinho CLIENT do host; a tela usa o resultado sem header de seleção', async () => {
    let finish!: (value: unknown) => void
    const { client, request } = api(
      'CLIENT',
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    render(
      <AppProviders
        apiClient={client}
        auth={{ getSession: async () => ana, signOut: async () => undefined }}
        initialSession={ana}
        publicTenantSlug="locadora-a"
        internalRoutePrefix="/locadora-a"
        awaitSession
        refreshKey="/orcamento"
      >
        <PrivateAreaGate>
          <Probe />
        </PrivateAreaGate>
      </AppProviders>
    )
    await waitFor(() =>
      expect(
        request.mock.calls.some((call) => call[0] === '/api/cart/sync')
      ).toBe(true)
    )
    expect(screen.queryByText('Orçamento')).toBeNull()
    await act(async () => {
      finish({ items: [row] })
    })
    expect(await screen.findByText('Orçamento')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Betoneira:2')
    expect(useCartStore.getState().getTotalPrice()).toBe(1260)
    expect(
      request.mock.calls
        .filter((call) => call[0].startsWith('/api/cart/'))
        .every((call) => !call[1]?.headers?.['x-tenant-id'])
    ).toBe(true)
  })

  it('seleção do app fixa x-tenant-id e usa o escopo da área, mesmo com outra vitrine aberta', async () => {
    const { client, request } = api()
    render(
      <AppProviders
        apiClient={client}
        auth={{ getSession: async () => ana, signOut: async () => undefined }}
        initialSession={ana}
        publicTenantSlug="locadora-b"
        privateArea
        refreshKey="/area-cliente"
      >
        <PrivateAreaGate>
          <Probe />
        </PrivateAreaGate>
      </AppProviders>
    )
    expect(await screen.findByText('Orçamento')).toBeTruthy()
    const calls = request.mock.calls.filter((call) =>
      call[0].startsWith('/api/cart/')
    )
    expect(calls).toHaveLength(1)
    expect(calls[0]![1]?.headers?.['x-tenant-id']).toBe('tenant-a')
    expect(useCartStore.persist.getOptions().name).toBe(
      'cart:' + encodeURIComponent(scope)
    )
  })

  it.each(['ADMIN', 'OPERATOR'] as const)(
    'papel %s não inicia sincronização do carrinho CLIENT',
    async (role) => {
      const { client, request } = api(role)
      render(
        <AppProviders
          apiClient={client}
          auth={{ getSession: async () => ana, signOut: async () => undefined }}
          initialSession={ana}
          publicTenantSlug="locadora-a"
          internalRoutePrefix="/locadora-a"
          awaitSession
        >
          <PrivateAreaGate>
            <Probe />
          </PrivateAreaGate>
        </AppProviders>
      )
      await screen.findByText('Orçamento')
      await act(async () => {
        await Promise.resolve()
      })
      expect(
        request.mock.calls.some((call) => call[0].startsWith('/api/cart/'))
      ).toBe(false)
    }
  )

  it('vitrine diferente da seleção não envia o carrinho para a locadora selecionada', async () => {
    const { client, request } = api()
    render(
      <AppProviders
        apiClient={client}
        auth={{ getSession: async () => ana, signOut: async () => undefined }}
        initialSession={ana}
        publicTenantSlug="locadora-b"
        awaitSession
      >
        <PrivateAreaGate>
          <Probe />
        </PrivateAreaGate>
      </AppProviders>
    )
    await screen.findByText('Orçamento')
    await act(async () => {
      await Promise.resolve()
    })
    expect(
      request.mock.calls.some((call) => call[0].startsWith('/api/cart/'))
    ).toBe(false)
  })

  it('login não transfere o carrinho anônimo; mescla apenas os itens persistidos do usuário nesta locadora', async () => {
    const guestScope = JSON.stringify(['locadora-a', 'anonymous'])
    const guestKey = 'cart:' + encodeURIComponent(guestScope)
    localStorage.setItem(
      guestKey,
      JSON.stringify({
        state: {
          items: [
            {
              equipmentId: 'visitante',
              equipmentName: 'Visitante',
              quantity: 1,
              days: 1,
              pricePerDay: 100,
            },
          ],
        },
        version: 0,
      })
    )
    localStorage.setItem(
      'cart:' + encodeURIComponent(scope),
      JSON.stringify({
        state: {
          items: [
            {
              equipmentId: 'usuario',
              equipmentName: 'Usuário',
              quantity: 2,
              days: 7,
              pricePerDay: 100,
            },
          ],
        },
        version: 0,
      })
    )
    const { client, request } = api()
    render(
      <AppProviders
        apiClient={client}
        auth={{ getSession: async () => ana, signOut: async () => undefined }}
        initialSession={null}
        publicTenantSlug="locadora-a"
        internalRoutePrefix="/locadora-a"
        awaitSession
      >
        <PrivateAreaGate>
          <Probe />
        </PrivateAreaGate>
      </AppProviders>
    )
    expect(await screen.findByText('Visitante:1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar sessão' }))
    await waitFor(() =>
      expect(
        request.mock.calls.some((call) => call[0] === '/api/cart/merge')
      ).toBe(true)
    )
    const options = request.mock.calls.find(
      (call) => call[0] === '/api/cart/merge'
    )![1]!
    expect(JSON.parse(options.body!)).toEqual({
      localCartItems: [{ equipmentId: 'usuario', quantity: 2, days: 7 }],
    })
    expect(
      JSON.parse(localStorage.getItem(guestKey)!).state.items.map(
        (item: { equipmentId: string }) => item.equipmentId
      )
    ).toEqual(['visitante'])
  })

  it('API indisponível mantém a rota e os itens locais, com tentativa explícita na interface', async () => {
    let offline = true
    const { client, request } = api('CLIENT', async () => {
      if (offline) throw new Error('offline')
      return { items: [row] }
    })
    render(
      <AppProviders
        apiClient={client}
        auth={{ getSession: async () => ana, signOut: async () => undefined }}
        initialSession={ana}
        publicTenantSlug="locadora-a"
        internalRoutePrefix="/locadora-a"
        awaitSession
      >
        <PrivateAreaGate>
          <Probe />
        </PrivateAreaGate>
      </AppProviders>
    )
    expect(await screen.findByText('Orçamento')).toBeTruthy()
    const retry = screen.getByRole('button', { name: 'Tentar sincronizar' })
    offline = false
    fireEvent.click(retry)
    await screen.findByText('Betoneira:2')
    expect(
      screen.queryByRole('button', { name: 'Tentar sincronizar' })
    ).toBeNull()
    expect(
      request.mock.calls.filter((call) => call[0].startsWith('/api/cart/'))
    ).toHaveLength(2)
  })
})
