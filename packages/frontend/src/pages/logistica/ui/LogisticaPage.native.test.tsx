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
import { AdminLogisticsPage } from './LogisticaPage.native'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import {
  delivery,
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

function setup(
  options: {
    denyPatch?: boolean
    denyUpload?: boolean
    pick?: () => Promise<FormData[]>
  } = {}
) {
  const rows = Array.from({ length: 12 }, (_, i) => delivery(i)),
    pick = options.pick ?? vi.fn(async () => [new FormData()])
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    const pathname = new URL(url).pathname
    if (init?.method === 'PATCH')
      return new Response('', { status: options.denyPatch ? 409 : 200 })
    if (pathname === '/api/upload')
      return Response.json(
        options.denyUpload
          ? { error: 'Upload recusado' }
          : { url: 'https://images.example.test/photo.png' },
        { status: options.denyUpload ? 403 : 200 }
      )
    if (pathname === '/api/admin/vehicles')
      return Response.json({
        vehicles: [
          {
            id: 'v1',
            plate: 'TEST-0001',
            brand: 'Marca',
            model: 'Modelo',
            type: 'TRUCK',
            status: 'AVAILABLE',
          },
        ],
      })
    if (pathname === '/api/admin/drivers')
      return Response.json({
        drivers: [
          {
            id: 'd1',
            name: 'Motorista Local',
            phone: 'telefone',
            status: 'ACTIVE',
          },
        ],
      })
    return Response.json({ deliveries: rows })
  })
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
    getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
  })
  const tree = (id = 'alfa') => (
    <ApiClientProvider client={client}>
      <FrontendSessionFixture tenant={operationsTenant(id)}>
        <AdminLogisticsPage
          pickImages={pick}
          image={({ src, alt }) => <img src={src} alt={alt} />}
        />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
  const view = render(tree())
  return { fetcher, pick, view, tree }
}
it('paginação de dez, filtros e auxiliares AVAILABLE/ACTIVE preservados sem classes nativas', async () => {
  const { fetcher } = setup()
  await screen.findByRole('button', { name: 'Exibir entrega entrega 0' })
  expect(
    screen.queryByRole('button', { name: 'Exibir entrega entrega 10' })
  ).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
  expect(
    await screen.findByRole('button', { name: 'Exibir entrega entrega 10' })
  ).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Buscar por cliente...'), {
    target: { value: 'Cliente 1' },
  })
  expect(
    await screen.findByRole('button', { name: 'Exibir entrega entrega 1' })
  ).toBeTruthy()
  expect(
    screen.queryByRole('button', { name: 'Exibir entrega entrega 0' })
  ).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Resetar filtros' }))
  await screen.findByRole('button', { name: 'Exibir entrega entrega 0' })
  expect(fetcher.mock.calls.map(([url]) => url)).toContain(
    'https://api.example.test/api/admin/vehicles?status=AVAILABLE'
  )
  expect(fetcher.mock.calls.map(([url]) => url)).toContain(
    'https://api.example.test/api/admin/drivers?status=ACTIVE'
  )
  expect(captured.classes).toEqual([])
})
it('editor compartilha PATCH, checklist e bytes multipart autenticados', async () => {
  const { fetcher } = setup()
  fireEvent.click(
    await screen.findByRole('button', { name: 'Editar entrega entrega 0' })
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'TEST-0001 - Marca Modelo' })
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Motorista Local - telefone' })
  )
  fireEvent.change(screen.getByLabelText('Distância (km)'), {
    target: { value: '8' },
  })
  fireEvent.click(
    screen.getByRole('checkbox', {
      name: 'Equipamento verificado e funcionando',
    })
  )
  fireEvent.change(screen.getByLabelText('Leitura do odômetro/horímetro'), {
    target: { value: '42' },
  })
  fireEvent.change(screen.getByLabelText('Observações'), {
    target: { value: 'Texto de teste' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Escolher arquivos' }))
  await screen.findByRole('img', { name: 'Imagem 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
  await waitFor(() =>
    expect(captured.success).toHaveBeenCalledWith(
      'Entrega/coleta atualizada com sucesso'
    )
  )
  const upload = fetcher.mock.calls.find(
    ([url]) => new URL(url).pathname === '/api/upload'
  )!
  expect(upload[1]).toMatchObject({
    method: 'POST',
    credentials: 'include',
    headers: { 'x-tenant-id': 'alfa' },
  })
  expect(upload[1]!.body).toBeInstanceOf(FormData)
  const patch = fetcher.mock.calls.find(([, init]) => init?.method === 'PATCH')!
  expect(patch[0]).toBe(
    'https://api.example.test/api/admin/logistics/entrega%200'
  )
  expect(patch[1]).toMatchObject({ method: 'PATCH', credentials: 'include' })
  expect(JSON.parse(patch[1]!.body as string)).toEqual({
    vehicleId: 'v1',
    driverId: 'd1',
    driverName: 'Motorista Local',
    distance: 8,
    photos: ['https://images.example.test/photo.png'],
    checklist: { equipment_checked: true, odometer_reading: 42 },
    notes: 'Texto de teste',
  })
})
it('PATCH e upload recusados não fecham edição nem fabricam sucesso ou foto', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const { fetcher } = setup({ denyPatch: true, denyUpload: true })
  fireEvent.click(
    await screen.findByRole('button', { name: 'Editar entrega entrega 0' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Escolher arquivos' }))
  await screen.findByRole('alert')
  expect(screen.queryByRole('img', { name: 'Imagem 1' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
  await waitFor(() =>
    expect(captured.error).toHaveBeenCalledWith(
      'Erro ao atualizar entrega/coleta'
    )
  )
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeTruthy()
  expect(captured.success).not.toHaveBeenCalled()
  expect(
    fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH')
  ).toHaveLength(1)
})
it('cancelar enquanto o seletor nativo aguarda não envia foto nem reaplica rascunho', async () => {
  let finish!: (files: FormData[]) => void
  const pick = vi.fn(
    () =>
      new Promise<FormData[]>((resolve) => {
        finish = resolve
      })
  )
  const { fetcher } = setup({ pick })
  fireEvent.click(
    await screen.findByRole('button', { name: 'Editar entrega entrega 0' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Escolher arquivos' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  await act(async () => finish([new FormData()]))
  expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
    false
  )
  expect(screen.queryByRole('img', { name: 'Imagem 1' })).toBeNull()
  expect(captured.success).not.toHaveBeenCalled()
})
it('transições enviam somente status e agenda abre o mesmo editor', async () => {
  const { fetcher } = setup()
  fireEvent.click(
    await screen.findByRole('button', { name: 'Iniciar entrega entrega 0' })
  )
  await waitFor(() =>
    expect(captured.success).toHaveBeenCalledWith(
      'Status atualizado com sucesso'
    )
  )
  const patch = fetcher.mock.calls.find(([, init]) => init?.method === 'PATCH')!
  expect(JSON.parse(patch[1]!.body as string)).toEqual({ status: 'IN_TRANSIT' })
  fireEvent.click(screen.getByRole('button', { name: 'Calendário' }))
  fireEvent.click(
    await screen.findByRole('button', { name: 'Exibir evento entrega 0' })
  )
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeTruthy()
  expect(screen.getByText('Checklist de Entrega · 0/8 concluídos')).toBeTruthy()
})
it('troca de locadora com mesmo transporte encerra edição e limpa busca', async () => {
  const { view, tree } = setup()
  fireEvent.click(
    await screen.findByRole('button', { name: 'Editar entrega entrega 0' })
  )
  fireEvent.change(screen.getByLabelText('Buscar por cliente...'), {
    target: { value: 'Cliente 1' },
  })
  view.rerender(tree('bravo'))
  await screen.findByRole('button', { name: 'Editar entrega entrega 0' })
  expect(
    (screen.getByLabelText('Buscar por cliente...') as HTMLInputElement).value
  ).toBe('')
  expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull()
})
