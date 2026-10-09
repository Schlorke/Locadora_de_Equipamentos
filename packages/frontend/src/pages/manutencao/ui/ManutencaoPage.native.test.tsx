// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AdminMaintenancePage } from './ManutencaoPage.native'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import {
  maintenance,
  operationsTenant,
} from '../../../../../../tests/helpers/operation-fixtures'
const captured = vi.hoisted(() => ({
  classes: [] as string[],
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
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
  ...(await import('../../../../../ui/src/native/Checkbox.native')),
  ...(await import('../../../../../ui/src/native/ImageUpload.native')),
}))
vi.mock(
  '../../../widgets/calendario',
  async () =>
    await import('../../../widgets/calendario/ui/AdvancedCalendar.native')
)
vi.mock('../../../shared/lib/toast', () => ({ toast: captured }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  captured.classes.length = 0
})

function setup(denyScheduled = false) {
  const rows = Array.from({ length: 12 }, (_, i) => maintenance(i))
  const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
    async (url) =>
      new URL(url).pathname.endsWith('/scheduled')
        ? Response.json({}, { status: denyScheduled ? 409 : 200 })
        : Response.json({ maintenances: rows })
  )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  const tree = (id = 'alfa') => (
    <ApiClientProvider client={client}>
      <FrontendSessionFixture tenant={operationsTenant(id)}>
        <AdminMaintenancePage />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
  const view = render(tree())
  return { fetcher, view, tree }
}
it('consulta dois recursos, pagina dez e preserva filtros tipo/status/busca', async () => {
  const { fetcher } = setup()
  await screen.findByRole('button', { name: 'Exibir manutenção manutenção 0' })
  expect(
    screen.queryByRole('button', { name: 'Exibir manutenção manutenção 10' })
  ).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
  await screen.findByRole('button', { name: 'Exibir manutenção manutenção 10' })
  fireEvent.click(screen.getByRole('button', { name: 'Corretiva' }))
  await screen.findByRole('button', { name: 'Exibir manutenção manutenção 1' })
  expect(
    screen.queryByRole('button', { name: 'Exibir manutenção manutenção 10' })
  ).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Resetar filtros' }))
  await screen.findByRole('button', { name: 'Exibir manutenção manutenção 0' })
  expect(fetcher.mock.calls.map(([url]) => url)).toContain(
    'https://api.example.test/api/admin/maintenance/scheduled?includeOverdue=true'
  )
  expect(captured.classes).toEqual([])
})
it('detalhe exibe custos e notas e agenda usa equipamento real sem comandos inventados', async () => {
  const { fetcher } = setup()
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Exibir manutenção manutenção 0',
    })
  )
  expect(screen.getByText('Mão de Obra: R$ 10,00')).toBeTruthy()
  expect(screen.getByText('Peças: R$ 20,00')).toBeTruthy()
  expect(screen.getByText('Nota de teste')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Calendário' }))
  fireEvent.click(
    await screen.findByRole('button', { name: 'Exibir evento manutenção 0' })
  )
  expect(screen.getByText('Equipamento: Equipamento 0')).toBeTruthy()
  expect(
    fetcher.mock.calls.every(
      ([, init]) => !init?.method || init.method === 'GET'
    )
  ).toBe(true)
})
it('scheduled recusado impede apresentar lista parcial como carregamento bem sucedido', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  setup(true)
  await waitFor(() => expect(captured.error).toHaveBeenCalled())
  expect(
    screen.queryByRole('button', { name: 'Exibir manutenção manutenção 0' })
  ).toBeNull()
  expect(screen.getByText('Nenhuma manutenção encontrada')).toBeTruthy()
})
it('troca de locadora apaga filtro/seleção e criação continua explicitamente pendente', async () => {
  const { view, tree } = setup()
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Exibir manutenção manutenção 0',
    })
  )
  fireEvent.change(
    screen.getByLabelText('Buscar por equipamento ou técnico...'),
    { target: { value: 'Equipamento 1' } }
  )
  view.rerender(tree('bravo'))
  await screen.findByRole('button', { name: 'Exibir manutenção manutenção 0' })
  expect(
    (
      screen.getByLabelText(
        'Buscar por equipamento ou técnico...'
      ) as HTMLInputElement
    ).value
  ).toBe('')
  expect(screen.queryByText('Equipamento: Equipamento 0')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Agendar Manutenção' }))
  expect(captured.info).toHaveBeenCalledWith(
    'Funcionalidade em desenvolvimento'
  )
})
