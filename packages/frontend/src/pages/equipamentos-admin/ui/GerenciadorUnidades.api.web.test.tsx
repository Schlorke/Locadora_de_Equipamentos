import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
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
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { EquipmentUnitsManager } from './GerenciadorUnidades'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast: notify }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  MotionGlobalConfig.skipAnimations = false
})

it.each([
  { hourMeter: '1.234', odometer: '12.6', hour: '1.2h', km: '13km' },
  { hourMeter: 1.234, odometer: 12.6, hour: '1.2h', km: '13km' },
  { hourMeter: '0', odometer: '0', hour: '0.0h', km: '0km' },
  { hourMeter: 0, odometer: 0, hour: '0.0h', km: '0km' },
  { hourMeter: null, odometer: null, hour: null, km: null },
])(
  'renderiza medidores $hourMeter/$odometer preservando arredondamento e null',
  async ({ hourMeter, odometer, hour, km }) => {
    MotionGlobalConfig.skipAnimations = true
    const client = createHttpClient({
      fetcher: async () =>
        Response.json([
          {
            id: 'unit',
            uniqueCode: 'UNIT',
            status: 'AVAILABLE',
            hourMeter,
            odometer,
          },
        ]),
    })
    render(
      <ApiClientProvider client={client}>
        <FrontendSessionFixture>
          <EquipmentUnitsManager equipmentId="eq" />
        </FrontendSessionFixture>
      </ApiClientProvider>
    )
    expect(await screen.findByText('UNIT')).toBeTruthy()
    if (hour !== null) expect(screen.getByText(hour)).toBeTruthy()
    else expect(screen.queryByText(/Horímetro:/)).toBeNull()
    if (km !== null) expect(screen.getByText(km)).toBeTruthy()
    else expect(screen.queryByText(/Odômetro:/)).toBeNull()
  }
)

it('envia criação pelo host configurado e conserva campos opcionais e recusa', async () => {
  MotionGlobalConfig.skipAnimations = true
  const fetcher = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async (_url, init) =>
      init?.method === 'GET'
        ? Response.json([])
        : Response.json({ error: 'Código já cadastrado' }, { status: 400 })
    )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
    getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
  })
  render(
    <ApiClientProvider client={client}>
      <FrontendSessionFixture>
        <EquipmentUnitsManager equipmentId="eq /1" />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
  fireEvent.click(await screen.findByRole('button', { name: /Nova Unidade/ }))
  fireEvent.change(screen.getByLabelText('Código Único *'), {
    target: { value: ' BET-001 ' },
  })
  fireEvent.change(screen.getByLabelText('Horímetro (horas)'), {
    target: { value: '0' },
  })
  fireEvent.change(screen.getByLabelText('Odômetro (km)'), {
    target: { value: '1.234' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Criar' }))
  await waitFor(() =>
    expect(notify.error).toHaveBeenCalledWith('Código já cadastrado')
  )
  const [, init] = fetcher.mock.calls.find(
    ([, options]) => options?.method === 'POST'
  )!
  expect(JSON.parse(init!.body as string)).toEqual({
    uniqueCode: 'BET-001',
    status: 'AVAILABLE',
    hourMeter: 0,
    odometer: 1.234,
    equipmentId: 'eq /1',
  })
  expect(init).toMatchObject({
    credentials: 'include',
    headers: { 'x-tenant-id': 'alfa' },
  })
  expect(screen.getByLabelText('Código Único *')).toBeTruthy()
  expect(notify.success).not.toHaveBeenCalled()
})

it('troca de equipamento encerra leitura e formulário antigos', async () => {
  MotionGlobalConfig.skipAnimations = true
  let finish!: (response: Response) => void
  const fetcher = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async (url) =>
      url.endsWith('equipmentId=old')
        ? new Promise((resolve) => {
            finish = resolve
          })
        : Response.json([])
    )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  const view = render(
    <ApiClientProvider client={client}>
      <FrontendSessionFixture>
        <EquipmentUnitsManager equipmentId="old" />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  view.rerender(
    <ApiClientProvider client={client}>
      <FrontendSessionFixture>
        <EquipmentUnitsManager equipmentId="new" />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
  expect(
    await screen.findByRole('button', { name: /Nova Unidade/ })
  ).toBeTruthy()
  expect(fetcher.mock.calls[0]![1]!.signal!.aborted).toBe(true)
  await act(async () =>
    finish(Response.json([{ id: 'old', uniqueCode: 'OLD' }]))
  )
  expect(screen.queryByText('OLD')).toBeNull()
  expect(notify.error).not.toHaveBeenCalled()
})

it('fechar o formulário invalida uma criação atrasada sem fechar o próximo rascunho', async () => {
  MotionGlobalConfig.skipAnimations = true
  let finish!: (response: Response) => void
  const fetcher = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async (_url, init) =>
      init?.method === 'POST'
        ? new Promise((resolve) => {
            finish = resolve
          })
        : Response.json([])
    )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  render(
    <ApiClientProvider client={client}>
      <FrontendSessionFixture>
        <EquipmentUnitsManager equipmentId="eq" />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
  fireEvent.click(await screen.findByRole('button', { name: /Nova Unidade/ }))
  fireEvent.change(screen.getByLabelText('Código Único *'), {
    target: { value: 'OLD' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Criar' }))
  await waitFor(() =>
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
      true
    )
  )
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  fireEvent.click(screen.getByRole('button', { name: /Nova Unidade/ }))
  fireEvent.change(screen.getByLabelText('Código Único *'), {
    target: { value: 'NEW' },
  })
  expect(
    fetcher.mock.calls.find(([, init]) => init?.method === 'POST')![1]!.signal!
      .aborted
  ).toBe(true)
  await act(async () => finish(Response.json({ id: 'old' }, { status: 201 })))
  expect(
    (screen.getByLabelText('Código Único *') as HTMLInputElement).value
  ).toBe('NEW')
  expect(notify.success).not.toHaveBeenCalled()
  expect(notify.error).not.toHaveBeenCalled()
})
