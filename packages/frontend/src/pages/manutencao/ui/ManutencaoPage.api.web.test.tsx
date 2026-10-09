// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, expect, it, vi } from 'vitest'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { AdminMaintenancePage } from './ManutencaoPage.web'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  MotionGlobalConfig.skipAnimations = false
})
const tenant = (id: string) => ({
  tenant: { id, slug: id, name: id, status: 'ACTIVE' as const },
  membershipId: id,
  role: 'ADMIN' as const,
})

it('troca real de locadora reinicia pesquisa mesmo com o mesmo HttpClient', async () => {
  MotionGlobalConfig.skipAnimations = true
  let selected = 'alfa'
  const fetcher = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async () => Response.json({ maintenances: [] }))
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
    getHeaders: () => ({ 'x-tenant-id': selected }),
  })
  const tree = (id: string) => (
    <ApiClientProvider client={client}>
      <FrontendSessionFixture tenant={tenant(id)}>
        <AdminMaintenancePage />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
  const view = render(tree('alfa'))
  const input = await screen.findByPlaceholderText(
    'Buscar por equipamento ou técnico...'
  )
  fireEvent.change(input, { target: { value: 'antiga' } })
  selected = 'bravo'
  view.rerender(tree('bravo'))
  expect(
    (
      (await screen.findByPlaceholderText(
        'Buscar por equipamento ou técnico...'
      )) as HTMLInputElement
    ).value
  ).toBe('')
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4))
  expect(
    fetcher.mock.calls
      .slice(2)
      .every(
        ([, init]) =>
          init!.headers &&
          (init!.headers as Record<string, string>)['x-tenant-id'] === 'bravo'
      )
  ).toBe(true)
})

it('troca de usuário encerra a consulta pendente da sessão anterior', async () => {
  MotionGlobalConfig.skipAnimations = true
  let first = true
  let finish!: (response: Response) => void
  const fetcher = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async (url) =>
      url.endsWith('/maintenance') && first
        ? new Promise((resolve) => {
            finish = resolve
          })
        : Response.json({ maintenances: [] })
    )
  const client = createHttpClient({ fetcher })
  const tree = (userId: string) => (
    <ApiClientProvider client={client}>
      <FrontendSessionFixture tenant={tenant('alfa')} userId={userId}>
        <AdminMaintenancePage />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
  const view = render(tree('old'))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  first = false
  view.rerender(tree('new'))
  expect(await screen.findByText('Nenhuma manutenção encontrada')).toBeTruthy()
  expect(fetcher.mock.calls[0]![1]!.signal!.aborted).toBe(true)
  await act(async () =>
    finish(
      Response.json({
        maintenances: [{ id: 'old', equipment: { name: 'Old secret' } }],
      })
    )
  )
  expect(screen.queryByText('Old secret')).toBeNull()
})
