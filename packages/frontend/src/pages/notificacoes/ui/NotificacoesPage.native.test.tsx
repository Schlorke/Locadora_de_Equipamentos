// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  ApiClientProvider,
  type HttpClient,
  type HttpRequest,
} from '../../../shared/api'
import { ApplicationSessionProvider } from '../../../entities/sessao'
import {
  PublicTenantProvider,
  TenantProvider,
} from '../../../entities/organizacao'
const captured = vi.hoisted(() => ({ classes: [] as string[], error: vi.fn() }))
vi.mock('react-native', async () =>
  (
    await import('../../../../../../tests/helpers/native-screen')
  ).createNativeHost(captured.classes)
)
vi.mock('@gb-locacoes/ui', async () =>
  (await import('../../../../../../tests/helpers/native-screen')).nativeUi()
)
vi.mock('../../../shared/lib/toast', () => ({ toast: captured }))
// Vitest resolve .web por padrão; Metro escolhe este mesmo adapter .native.
vi.mock('../../../features/notificacoes', async () => ({
  ...(await import('../../../features/notificacoes/model/use-notifications.native')),
  useNotificationScope: (
    await import('../../../features/notificacoes/model/use-notifications-model')
  ).useNotificationScope,
}))
import { NavigationProvider } from '@gb-locacoes/ui'
import { NotificacoesPage } from './NotificacoesPage.native'
const item = {
  id: 'n/1',
  type: 'QUOTE',
  priority: 'HIGH',
  title: 'Novo orçamento',
  message: 'Motivo: Aprovado',
  isRead: false,
  createdAt: '2026-10-03T09:00:00Z',
  actionUrl: '/area-cliente/historico',
}
function setup() {
  let deleted = false,
    fail = false
  const request = vi.fn(
    async (_p: string, o?: HttpRequest): Promise<unknown> => {
      if (fail) return { ok: false, status: 500, data: {} }
      if (o?.method === 'DELETE') deleted = true
      return {
        ok: true,
        status: 200,
        data: {
          notifications: deleted ? [] : [item],
          stats: {
            total: deleted ? 0 : 1,
            unread: deleted ? 0 : 1,
            byType: { QUOTE: 1 },
          },
          pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        },
      }
    }
  )
  const client: HttpClient = {
    request: async <T,>(p: string, o?: HttpRequest) =>
      (await request(p, o)) as T,
  }
  const navigate = vi.fn()
  const view = render(
    <NavigationProvider navigate={navigate}>
      <ApiClientProvider client={client}>
        <TenantProvider value={null}>
          <PublicTenantProvider value="alfa">
            <ApplicationSessionProvider
              value={{
                data: {
                  user: {
                    id: 'ana',
                    name: 'Ana',
                    email: 'ana@example.test',
                    role: 'CLIENT',
                  },
                },
                status: 'authenticated',
                update: async () => null,
                signOut: async () => {},
              }}
            >
              <NotificacoesPage />
            </ApplicationSessionProvider>
          </PublicTenantProvider>
        </TenantProvider>
      </ApiClientProvider>
    </NavigationProvider>
  )
  return {
    view,
    request,
    navigate,
    setFail: (v: boolean) => {
      fail = v
    },
  }
}
beforeEach(() => {
  captured.classes.length = 0
  captured.error.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('fetch relativo proibido')
    })
  )
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('lista, lê, navega e exclui com transporte compartilhado e primitivas nativas reais', async () => {
  const { request, navigate } = setup()
  await screen.findByText('Novo orçamento')
  expect(screen.getByText('Motivo: Aprovado')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Lido' }))
  await waitFor(() => expect(screen.queryByText('Não lida')).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: 'Ver' }))
  expect(navigate).toHaveBeenCalledWith('/area-cliente/historico')
  fireEvent.click(
    screen.getByRole('button', { name: 'Excluir Novo orçamento' })
  )
  await screen.findByText('Nenhuma notificação')
  expect(
    request.mock.calls.some(
      ([p, o]) =>
        p === '/api/client/notifications/n%2F1' && o?.method === 'DELETE'
    )
  ).toBe(true)
  expect(captured.classes).toEqual([])
})
it('recusas não anunciam leitura ou exclusão; nova tentativa recupera', async () => {
  const { setFail } = setup()
  await screen.findByText('Novo orçamento')
  setFail(true)
  fireEvent.click(screen.getByRole('button', { name: 'Lido' }))
  await screen.findByRole('alert')
  expect(screen.getByText('Não lida')).toBeTruthy()
  fireEvent.click(
    screen.getByRole('button', { name: 'Excluir Novo orçamento' })
  )
  await waitFor(() =>
    expect(captured.error).toHaveBeenCalledWith(
      'Falha ao remover notificação. Tente novamente.'
    )
  )
  expect(screen.getByText('Novo orçamento')).toBeTruthy()
  setFail(false)
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
})
