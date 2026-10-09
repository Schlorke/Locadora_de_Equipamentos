// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import {
  ApiClientProvider,
  type HttpClient,
  type HttpRequest,
} from '../../../shared/api'
import { ApplicationSessionProvider } from '../../../entities/sessao'
import {
  TenantProvider,
  PublicTenantProvider,
} from '../../../entities/organizacao'
import { useNotificationsModel } from './use-notifications-model'
import { useNotifications as useWebNotifications } from './use-notifications.web'
const notification = {
  id: 'n/1',
  type: 'QUOTE',
  title: 'Novo orçamento',
  message: 'Orçamento aprovado',
  isRead: false,
  createdAt: '2026-10-03T09:00:00.000Z',
  priority: 'HIGH',
  actionUrl: '/area-cliente/historico',
  metadata: { quoteId: 'q1' },
  readAt: null,
}
const payload = (title = 'Novo orçamento') => ({
  notifications: [{ ...notification, title }],
  pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
  stats: { total: 2, unread: 2, byType: { QUOTE: 2 } },
})
const json = (data: unknown = {}, ok = true) => ({
  data,
  ok,
  status: ok ? 200 : 500,
})
function transport(
  implementation: (
    path: string,
    options?: HttpRequest
  ) => Promise<unknown> = async () => json(payload())
) {
  const request = vi.fn(implementation)
  const client: HttpClient = {
    request: async <T,>(p: string, o?: HttpRequest) =>
      (await request(p, o)) as T,
  }
  return { request, client }
}
function harness(initial: HttpClient, role = 'CLIENT', web = false) {
  let client = initial,
    slug = 'alfa',
    user = 'ana',
    authenticated = true
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiClientProvider client={client}>
      <TenantProvider value={null}>
        <PublicTenantProvider value={slug}>
          <ApplicationSessionProvider
            value={{
              data: authenticated
                ? {
                    user: {
                      id: user,
                      name: 'Ana',
                      email: 'ana@example.test',
                      role,
                    },
                  }
                : null,
              status: authenticated ? 'authenticated' : 'unauthenticated',
              update: async () => null,
              signOut: async () => {},
            }}
          >
            {children}
          </ApplicationSessionProvider>
        </PublicTenantProvider>
      </TenantProvider>
    </ApiClientProvider>
  )
  const hook = renderHook(web ? useWebNotifications : useNotificationsModel, {
    wrapper,
  })
  return {
    ...hook,
    change: (kind: string, next?: HttpClient) => {
      if (kind === 'locadora') slug = 'bravo'
      if (kind === 'usuário') user = 'bia'
      if (kind === 'transporte') client = next!
      if (kind === 'logout') authenticated = false
      hook.rerender()
    },
  }
}
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('fetch relativo proibido')
    })
  )
  vi.spyOn(console, 'error').mockImplementation(() => {})
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
it('cliente usa transporte configurado, limite 50 e DTO com datas e prioridades', async () => {
  const { client, request } = transport(),
    h = harness(client)
  await waitFor(() => expect(h.result.current.isLoading).toBe(false))
  expect(request.mock.calls).toHaveLength(1)
  expect(request.mock.calls[0][0]).toBe('/api/client/notifications?limit=50')
  expect(request.mock.calls[0][1]?.responseType).toBe('json-response')
  expect(h.result.current.notifications[0]).toMatchObject({
    type: 'quote',
    priority: 'high',
    createdAt: new Date(notification.createdAt),
    metadata: { quoteId: 'q1' },
  })
  expect(h.result.current.highPriorityNotifications).toHaveLength(1)
})
it('ADMIN termina sync antes da listagem; CLIENT não chama sync', async () => {
  let done!: (v: unknown) => void
  const { client, request } = transport(async (p) =>
    p.includes('/admin/')
      ? new Promise((resolve) => {
          done = resolve
        })
      : json(payload())
  )
  const h = harness(client, 'ADMIN')
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
  expect(request.mock.calls[0][0]).toBe('/api/admin/notifications/sync')
  await act(async () => done(json()))
  await waitFor(() => expect(h.result.current.notifications).toHaveLength(1))
  expect(request.mock.calls.map(([p]) => p)).toEqual([
    '/api/admin/notifications/sync',
    '/api/client/notifications?limit=50',
  ])
})
it('read confirmado e repetido não desconta duas vezes; excluir lida preserva unread', async () => {
  const { client, request } = transport(),
    h = harness(client)
  await waitFor(() => expect(h.result.current.isLoading).toBe(false))
  await act(async () => h.result.current.markAsRead('n/1'))
  await act(async () => h.result.current.markAsRead('n/1'))
  expect(h.result.current.stats.unread).toBe(1)
  expect(h.result.current.notifications[0].isRead).toBe(true)
  expect(h.result.current.notifications[0].readAt).toBeInstanceOf(Date)
  await act(async () => h.result.current.removeNotification('n/1'))
  expect(h.result.current.stats).toMatchObject({ total: 1, unread: 1 })
  expect(
    request.mock.calls
      .filter(([, o]) => o?.method)
      .map(([p, o]) => [p, o?.method])
  ).toEqual([
    ['/api/client/notifications/n%2F1', 'PATCH'],
    ['/api/client/notifications/n%2F1', 'PATCH'],
    ['/api/client/notifications/n%2F1', 'DELETE'],
  ])
})
it('read-all conserva POST e limpar tudo continua local, sem DELETE implícito', async () => {
  const { client, request } = transport(),
    h = harness(client)
  await waitFor(() => expect(h.result.current.isLoading).toBe(false))
  await act(async () => h.result.current.markAllAsRead())
  expect(h.result.current.stats.unread).toBe(0)
  expect(h.result.current.stats.byType).toEqual({})
  expect(h.result.current.notifications.every((n) => n.isRead)).toBe(true)
  const count = request.mock.calls.length
  act(() => h.result.current.clearAll())
  expect(h.result.current.notifications).toEqual([])
  expect(h.result.current.stats.total).toBe(0)
  expect(request.mock.calls).toHaveLength(count)
  expect(request.mock.calls[1]).toMatchObject([
    '/api/client/notifications/mark-all-read',
    { method: 'POST' },
  ])
})
it('recusa de read conserva unread; delete falha sem remover; refresh recupera carga', async () => {
  let fail = false
  const { client } = transport(async () =>
      fail ? json({ error: 'Não autorizado' }, false) : json(payload())
    ),
    h = harness(client)
  await waitFor(() => expect(h.result.current.isLoading).toBe(false))
  fail = true
  await act(async () => h.result.current.markAsRead('n/1'))
  expect(h.result.current.stats.unread).toBe(2)
  expect(h.result.current.error).toBe('Não autorizado')
  await act(async () => {
    await expect(h.result.current.removeNotification('n/1')).rejects.toThrow(
      'Erro ao remover notificação'
    )
  })
  expect(h.result.current.notifications).toHaveLength(1)
  act(() => h.result.current.refresh())
  await waitFor(() =>
    expect(h.result.current.error).toBe('Erro ao carregar notificações')
  )
  fail = false
  act(() => h.result.current.refresh())
  await waitFor(() => expect(h.result.current.error).toBeNull())
})
it.each(['locadora', 'usuário', 'transporte', 'logout'])(
  'resposta privada antiga é descartada após %s',
  async (kind) => {
    let resolve!: (v: unknown) => void
    const old = transport(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    const next = transport(async () => json(payload('Atual')))
    const h = harness(old.client)
    await waitFor(() => expect(old.request).toHaveBeenCalled())
    const finish = resolve
    old.request.mockImplementation(async () => json(payload('Atual')))
    act(() => h.change(kind, next.client))
    if (kind === 'logout')
      await waitFor(() => expect(h.result.current.isLoading).toBe(false))
    else
      await waitFor(() =>
        expect(h.result.current.notifications[0]?.title).toBe('Atual')
      )
    await act(async () => finish(json(payload('Privado Alfa'))))
    expect(h.result.current.notifications.map((n) => n.title)).toEqual(
      kind === 'logout' ? [] : ['Atual']
    )
    expect(old.request.mock.calls[0][1]?.signal?.aborted).toBe(true)
  }
)
it('mutação encerrada não altera próxima locadora e não publica erro antigo', async () => {
  let resolve!: (v: unknown) => void
  const { client, request } = transport(async (p, o) =>
      o?.method === 'PATCH'
        ? new Promise((done) => {
            resolve = done
          })
        : json(payload())
    ),
    h = harness(client)
  await waitFor(() => expect(h.result.current.isLoading).toBe(false))
  let pending!: Promise<void>
  act(() => {
    pending = h.result.current.markAsRead('n/1')
  })
  await waitFor(() =>
    expect(request.mock.calls.some(([, o]) => o?.method === 'PATCH')).toBe(true)
  )
  act(() => h.change('locadora'))
  await waitFor(() => expect(h.result.current.isLoading).toBe(false))
  await act(async () => {
    resolve(json())
    await pending
  })
  expect(h.result.current.stats.unread).toBe(2)
  expect(h.result.current.notifications[0].isRead).toBe(false)
  expect(h.result.current.error).toBeNull()
})
it('refresh antigo não desfaz confirmação de leitura nem prende loading', async () => {
  let resolve!: (v: unknown) => void
  const { client, request } = transport(),
    h = harness(client)
  await waitFor(() => expect(h.result.current.isLoading).toBe(false))
  request.mockImplementation((_, o) =>
    o?.method
      ? Promise.resolve(json())
      : new Promise((done) => {
          resolve = done
        })
  )
  act(() => h.result.current.refresh())
  await waitFor(() => expect(h.result.current.isLoading).toBe(true))
  await act(async () => h.result.current.markAsRead('n/1'))
  expect(h.result.current.isLoading).toBe(false)
  await act(async () => resolve(json(payload())))
  expect(h.result.current.notifications[0].isRead).toBe(true)
  expect(h.result.current.stats.unread).toBe(1)
})
it('contador web conserva chave/evento e limpa o valor privado ao sair', async () => {
  const event = vi.fn()
  window.addEventListener('notificationUpdate', event)
  try {
    const { client } = transport(),
      h = harness(client, 'CLIENT', true)
    await waitFor(() =>
      expect(localStorage.getItem('gb-locacoes-unread-count')).toBe('2')
    )
    expect(event.mock.calls.at(-1)?.[0].detail).toEqual({ unreadCount: 2 })
    act(() => h.change('logout'))
    await waitFor(() =>
      expect(localStorage.getItem('gb-locacoes-unread-count')).toBe('0')
    )
    expect(h.result.current.notifications).toEqual([])
  } finally {
    window.removeEventListener('notificationUpdate', event)
  }
})
