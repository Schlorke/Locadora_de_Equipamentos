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
import { EquipmentDetailsPage } from './Detalhe.native'
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
vi.mock('@gb-locacoes/ui', async () => ({
  ...(await (
    await import('../../../../../../tests/helpers/native-screen')
  ).nativeUi()),
  ...(await import('../../../../../ui/src/native/Select.native')),
  ...(await import('../../../../../ui/src/native/Textarea.native')),
}))
vi.mock('../../../shared/lib/toast', () => ({ toast: captured }))
const equipment = {
  id: 'eq /1',
  name: 'Betoneira',
  pricePerDay: 25,
  isAvailable: true,
  description: 'Obras',
  images: ['/a.jpg', '/b.jpg'],
  createdAt: '2026-09-01',
  updatedAt: '2026-09-02',
  category: { id: 'cat', name: 'Concreto' },
  specifications: { Motor: '2 CV' },
  _count: { quoteItems: 3, reviews: 5 },
}
const unit = {
  id: 'unit',
  uniqueCode: 'BET-001',
  status: 'MAINTENANCE',
  hourMeter: '1.234',
  odometer: '12.6',
  serialNumber: 'SN',
  notes: 'Revisão',
  createdAt: '2026-09-01',
  updatedAt: '2026-09-02',
}
function tree(
  client: ReturnType<typeof createHttpClient>,
  id: string | null = 'eq /1',
  user = 'ana',
  navigate = vi.fn()
) {
  return (
    <ApiClientProvider client={client}>
      <FrontendSessionFixture userId={user}>
        <NavigationProvider navigate={navigate}>
          <EquipmentDetailsPage
            equipmentId={id}
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
it('carrega detalhe, especificações, galeria/zoom e medidores Decimal, preservando caminhos codificados', async () => {
  const fetcher = vi.fn(async (url: string, _options?: RequestInit) =>
    Response.json(url.includes('equipment-units') ? [unit] : equipment)
  )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  render(tree(client))
  expect(await screen.findByText('Motor: 2 CV')).toBeTruthy()
  expect(await screen.findByText('Horímetro: 1.2h')).toBeTruthy()
  expect(screen.getByText('Odômetro: 13km')).toBeTruthy()
  expect(screen.getByText('Orçamentos: 3')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Próxima Imagem' }))
  expect(screen.getByAltText('Betoneira — imagem 2').getAttribute('src')).toBe(
    '/b.jpg'
  )
  fireEvent.click(screen.getByRole('button', { name: 'Ampliar Imagem' }))
  expect(
    await screen.findByRole('button', { name: 'Fechar Imagem' })
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Fechar Imagem' }))
  expect(fetcher.mock.calls[0]?.[0]).toBe(
    'https://api.example.test/api/admin/equipments/eq%20%2F1'
  )
  expect(captured.classes).toEqual([])
})
it('não apaga sem confirmar e 409 não navega; sucesso navega só após resposta', async () => {
  let fail = true
  const fetcher = vi.fn(async (url: string, options?: RequestInit) =>
    Response.json(
      options?.method === 'DELETE'
        ? fail
          ? { error: 'Em uso' }
          : { ok: true }
        : url.includes('equipment-units')
          ? []
          : equipment,
      { status: options?.method === 'DELETE' && fail ? 409 : 200 }
    )
  )
  const navigate = vi.fn(),
    client = createHttpClient({ fetcher })
  render(tree(client, 'eq /1', 'ana', navigate))
  await screen.findByText('Motor: 2 CV')
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Equipamento' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar Exclusão' }))
  expect(fetcher.mock.calls.some(([, o]) => o?.method === 'DELETE')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Equipamento' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar Exclusão' }))
  await waitFor(() =>
    expect(captured.error).toHaveBeenCalledWith(
      'Erro ao excluir equipamento: Em uso'
    )
  )
  expect(navigate).not.toHaveBeenCalled()
  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Equipamento' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar Exclusão' }))
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith('/admin/equipamentos')
  )
})
it('troca de registro fecha confirmação e não grava no equipamento antigo', async () => {
  const fetcher = vi.fn(async (url: string, _options?: RequestInit) =>
    Response.json(
      url.includes('equipment-units')
        ? []
        : { ...equipment, name: url.includes('/new') ? 'Atual' : 'Betoneira' }
    )
  )
  const client = createHttpClient({ fetcher }),
    view = render(tree(client))
  await screen.findByText('Motor: 2 CV')
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Equipamento' }))
  view.rerender(tree(client, 'new'))
  expect(await screen.findByText('Atual')).toBeTruthy()
  expect(
    screen.queryByRole('button', { name: 'Confirmar Exclusão' })
  ).toBeNull()
  expect(fetcher.mock.calls.some(([, o]) => o?.method === 'DELETE')).toBe(false)
})
it('resposta antiga não repõe detalhe após mudar transporte', async () => {
  let finish!: (r: Response) => void
  const old = createHttpClient({
    fetcher: async () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  })
  const current = createHttpClient({
    fetcher: async (url) =>
      Response.json(
        url.includes('equipment-units') ? [] : { ...equipment, name: 'Atual' }
      ),
  })
  const view = render(tree(old))
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  view.rerender(tree(current))
  expect(await screen.findByText('Atual')).toBeTruthy()
  await act(async () => finish(Response.json(equipment)))
  expect(screen.queryByText('Betoneira')).toBeNull()
})
it('sem id finaliza loading; não encontrado retorna à listagem sem unidades', async () => {
  const fetcher = vi.fn(async () =>
      Response.json({ error: 'Não encontrado' }, { status: 404 })
    ),
    client = createHttpClient({ fetcher }),
    navigate = vi.fn()
  const view = render(tree(client, null, 'ana', navigate))
  expect(await screen.findByText('Equipamento não encontrado')).toBeTruthy()
  expect(fetcher).not.toHaveBeenCalled()
  view.rerender(tree(client, 'ausente', 'ana', navigate))
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith('/admin/equipamentos')
  )
  expect(fetcher).toHaveBeenCalledTimes(1)
})
