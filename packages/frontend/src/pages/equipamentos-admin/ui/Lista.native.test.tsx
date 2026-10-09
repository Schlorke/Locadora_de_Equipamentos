// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import { NavigationProvider } from '@gb-locacoes/ui'
import { AdminEquipmentsPage } from './Lista.native'
const captured = vi.hoisted(() => ({
  classes: [] as string[],
  success: vi.fn(),
  error: vi.fn(),
}))
vi.mock('react-native', async () =>
  (
    await import('../../../../../../tests/helpers/native-screen')
  ).createNativeHost(captured.classes)
)
vi.mock('@gb-locacoes/ui', async () =>
  (await import('../../../../../../tests/helpers/native-screen')).nativeUi()
)
vi.mock('../../../shared/lib/toast', () => ({ toast: captured }))
const category = { id: 'cat', name: 'Concreto' },
  other = { id: 'other', name: 'Altura' }
const rows = Array.from({ length: 10 }, (_, index) => ({
  id: 'eq-' + index,
  name: 'Máquina ' + String(index).padStart(2, '0'),
  description: 'Obra',
  pricePerDay: 25 + index,
  isAvailable: index !== 0,
  images: ['/fotos/' + index + '.jpg'],
  createdAt: '2026-09-01',
  category: index === 1 ? other : category,
}))
function setup(fail = false) {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) =>
    init?.method === 'DELETE'
      ? Response.json(fail ? { error: 'Equipamento em uso' } : { ok: true }, {
          status: fail ? 409 : 200,
        })
      : Response.json(
          url.includes('/categories') ? [category, other] : { equipments: rows }
        )
  )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
    getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
  })
  return { fetcher, client }
}
function tree(
  client: ReturnType<typeof createHttpClient>,
  userId = 'ana',
  navigate = vi.fn(),
  tenantSlug?: string
) {
  return (
    <ApiClientProvider client={client}>
      <FrontendSessionFixture
        userId={userId}
        tenant={
          tenantSlug
            ? {
                tenant: {
                  id: tenantSlug,
                  slug: tenantSlug,
                  name: tenantSlug,
                  status: 'ACTIVE',
                },
                membershipId: 'member-' + tenantSlug,
                role: 'ADMIN',
              }
            : null
        }
      >
        <NavigationProvider navigate={navigate}>
          <AdminEquipmentsPage
            image={({ src, alt }) => <img src={src} alt={alt} />}
          />
        </NavigationProvider>
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
}
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  captured.classes.length = 0
})
it('lista ordenada, nove por página, pesquisa, categoria e disponibilidade usam o modelo comum', async () => {
  const { client, fetcher } = setup()
  render(tree(client))
  expect(await screen.findByText('Máquina 00')).toBeTruthy()
  expect(screen.queryByText('Máquina 09')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Próxima Página' }))
  expect(await screen.findByText('Máquina 09')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Buscar equipamentos'), {
    target: { value: 'Máquina 01' },
  })
  expect(await screen.findByText('Máquina 01')).toBeTruthy()
  expect(screen.getByText('Página 1 de 1')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Buscar equipamentos'), {
    target: { value: '' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Altura' }))
  await waitFor(() => expect(screen.queryByText('Máquina 00')).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: 'Todas as Categorias' }))
  fireEvent.click(screen.getByRole('button', { name: 'Indisponíveis' }))
  await waitFor(() => expect(screen.queryByText('Máquina 01')).toBeNull())
  expect(screen.getByText('Máquina 00')).toBeTruthy()
  expect(fetcher.mock.calls[0]).toMatchObject([
    'https://api.example.test/api/admin/equipments?limit=1000',
    {
      method: 'GET',
      credentials: 'include',
      headers: { 'x-tenant-id': 'alfa' },
    },
  ])
  expect(captured.classes).toEqual([])
})
it('preview, galeria e links preservam destinos; confirmação cancelada não apaga e 409 mantém seleção', async () => {
  const { client, fetcher } = setup(true),
    navigate = vi.fn()
  render(tree(client, 'ana', navigate))
  await screen.findByText('Máquina 00')
  fireEvent.click(screen.getByRole('button', { name: 'Visualizar Máquina 00' }))
  expect(
    await screen.findByRole('button', { name: 'Ampliar Imagem' })
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Fechar Visualização' }))
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Máquina 00' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar Exclusão' }))
  expect(fetcher.mock.calls.some(([, o]) => o?.method === 'DELETE')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Máquina 00' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar Exclusão' }))
  await waitFor(() =>
    expect(captured.error).toHaveBeenCalledWith('Erro', {
      description: 'Equipamento em uso',
    })
  )
  expect(
    screen.getByRole('button', { name: 'Confirmar Exclusão' })
  ).toBeTruthy()
  expect(fetcher.mock.calls.find(([, o]) => o?.method === 'DELETE')?.[0]).toBe(
    'https://api.example.test/api/admin/equipments/eq-0'
  )
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar Exclusão' }))
  fireEvent.click(screen.getByRole('button', { name: 'Editar Máquina 00' }))
  expect(navigate).toHaveBeenCalledWith('/admin/equipamentos/eq-0/editar')
  expect(captured.success).not.toHaveBeenCalled()
})
it.each(['usuário', 'transporte', 'locadora'])(
  'trocar %s descarta lista atrasada',
  async (kind) => {
    let finish!: (response: Response) => void
    const oldFetcher = vi.fn(async (url: string) =>
      url.includes('/categories')
        ? Response.json([])
        : new Promise<Response>((resolve) => {
            finish = resolve
          })
    )
    const old = createHttpClient({ fetcher: oldFetcher })
    const current = createHttpClient({
      fetcher: async (url) =>
        Response.json(
          url.includes('/categories') ? [] : { equipments: [rows[1]] }
        ),
    })
    const view = render(
      tree(old, 'ana', vi.fn(), kind === 'locadora' ? 'alfa' : undefined)
    )
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    if (kind !== 'transporte')
      oldFetcher.mockImplementation(async (url) =>
        Response.json(
          url.includes('/categories') ? [] : { equipments: [rows[1]] }
        )
      )
    view.rerender(
      tree(
        kind !== 'transporte' ? old : current,
        kind === 'usuário' ? 'bia' : 'ana',
        vi.fn(),
        kind === 'locadora' ? 'bravo' : undefined
      )
    )
    expect(await screen.findByText('Máquina 01')).toBeTruthy()
    await act(async () => finish(Response.json({ equipments: [rows[0]] })))
    expect(screen.queryByText('Máquina 00')).toBeNull()
    expect(captured.success).not.toHaveBeenCalled()
  }
)
