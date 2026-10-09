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
import { EquipmentUnitsManager } from './GerenciadorUnidades.native'
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
const unit = {
  id: 'u /1',
  uniqueCode: 'BET-001',
  status: 'AVAILABLE',
  hourMeter: '0',
  odometer: null,
  serialNumber: 'SN',
  notes: 'Revisão',
  createdAt: '2026-09-01',
  updatedAt: '2026-09-02',
}
function tree(
  client: ReturnType<typeof createHttpClient>,
  id = 'eq /1',
  user = 'ana'
) {
  return (
    <ApiClientProvider client={client}>
      <FrontendSessionFixture userId={user}>
        <EquipmentUnitsManager equipmentId={id} />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
}
function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  captured.classes.length = 0
})
it('formulário de criação conserva validação, todos os estados e DTO; erro mantém rascunho', async () => {
  let fail = true
  const fetcher = vi.fn(async (_url: string, o?: RequestInit) =>
    Response.json(
      o?.method === 'GET'
        ? []
        : fail
          ? { error: 'Código repetido' }
          : { ok: true },
      { status: o?.method !== 'GET' && fail ? 409 : 200 }
    )
  )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
    getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
  })
  render(tree(client))
  fireEvent.click(await screen.findByRole('button', { name: 'Nova Unidade' }))
  fireEvent.click(screen.getByRole('button', { name: 'Criar' }))
  expect(captured.error).toHaveBeenCalledWith('Código único é obrigatório')
  expect(fetcher.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false)
  change('Código Único *', ' BET-002 ')
  change('Horímetro (horas)', '0')
  change('Odômetro (km)', '1.234')
  change('Número de Série', ' SN-2 ')
  change('Notas', ' Teste ')
  fireEvent.click(screen.getByRole('combobox'))
  for (const name of [
    'Disponível',
    'Reservado',
    'Locado',
    'Manutenção',
    'Baixado',
  ])
    expect(screen.getByRole('radio', { name })).toBeTruthy()
  fireEvent.click(screen.getByRole('radio', { name: 'Manutenção' }))
  fireEvent.click(screen.getByRole('button', { name: 'Criar' }))
  await waitFor(() =>
    expect(captured.error).toHaveBeenCalledWith('Código repetido')
  )
  const [url, init] = fetcher.mock.calls.find(([, o]) => o?.method === 'POST')!
  expect(url).toBe('https://api.example.test/api/admin/equipment-units')
  expect(JSON.parse(init!.body as string)).toEqual({
    uniqueCode: 'BET-002',
    status: 'MAINTENANCE',
    hourMeter: 0,
    odometer: 1.234,
    serialNumber: 'SN-2',
    notes: 'Teste',
    equipmentId: 'eq /1',
  })
  expect(init).toMatchObject({
    credentials: 'include',
    headers: { 'x-tenant-id': 'alfa' },
  })
  expect(
    (screen.getByLabelText('Código Único *') as HTMLInputElement).value
  ).toBe(' BET-002 ')
  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Criar' }))
  await waitFor(() =>
    expect(screen.queryByLabelText('Código Único *')).toBeNull()
  )
  expect(captured.success).toHaveBeenCalledWith('Unidade criada com sucesso!')
  expect(captured.classes).toEqual([])
})
it('edição usa PATCH sem equipmentId; exclusão cancelada não grava, 409 mantém unidade', async () => {
  const fetcher = vi.fn(async (_url: string, o?: RequestInit) =>
    Response.json(
      o?.method === 'GET'
        ? [unit]
        : o?.method === 'DELETE'
          ? { error: 'Unidade locada' }
          : { ok: true },
      { status: o?.method === 'DELETE' ? 409 : 200 }
    )
  )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  render(tree(client))
  await screen.findByText('BET-001')
  expect(screen.getByText('Horímetro: 0.0h')).toBeTruthy()
  expect(screen.queryByText(/Odômetro:/)).toBeNull()
  fireEvent.click(
    screen.getByRole('button', { name: 'Editar Unidade BET-001' })
  )
  change('Código Único *', ' BET-003 ')
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
  await waitFor(() =>
    expect(captured.success).toHaveBeenCalledWith(
      'Unidade atualizada com sucesso!'
    )
  )
  const [url, init] = fetcher.mock.calls.find(([, o]) => o?.method === 'PATCH')!
  expect(url).toBe(
    'https://api.example.test/api/admin/equipment-units/u%20%2F1'
  )
  expect(JSON.parse(init!.body as string)).toEqual({
    uniqueCode: 'BET-003',
    status: 'AVAILABLE',
    hourMeter: 0,
    serialNumber: 'SN',
    notes: 'Revisão',
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'Excluir Unidade BET-001' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar Exclusão' }))
  expect(fetcher.mock.calls.some(([, o]) => o?.method === 'DELETE')).toBe(false)
  fireEvent.click(
    screen.getByRole('button', { name: 'Excluir Unidade BET-001' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar Exclusão' }))
  await waitFor(() =>
    expect(captured.error).toHaveBeenCalledWith('Unidade locada')
  )
  expect(screen.getByText('BET-001')).toBeTruthy()
})
it('cancelamento de criação não grava; resposta aceita depois de fechar não reabre formulário', async () => {
  let finish!: (r: Response) => void
  const fetcher = vi.fn(async (_url: string, o?: RequestInit) =>
    o?.method === 'GET'
      ? Response.json([])
      : new Promise<Response>((resolve) => {
          finish = resolve
        })
  )
  const client = createHttpClient({ fetcher })
  render(tree(client))
  fireEvent.click(await screen.findByRole('button', { name: 'Nova Unidade' }))
  change('Código Único *', 'A')
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(fetcher.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Nova Unidade' }))
  change('Código Único *', 'B')
  fireEvent.click(screen.getByRole('button', { name: 'Criar' }))
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  await act(async () => finish(Response.json({ ok: true })))
  expect(screen.queryByLabelText('Código Único *')).toBeNull()
  expect(captured.success).not.toHaveBeenCalled()
})
it('troca de equipamento fecha confirmação/formulário e descarta leitura velha', async () => {
  let finish!: (r: Response) => void
  const fetcher = vi.fn(async (url: string, _options?: RequestInit) =>
    url.endsWith('old')
      ? new Promise<Response>((resolve) => {
          finish = resolve
        })
      : Response.json([unit])
  )
  const client = createHttpClient({ fetcher }),
    view = render(tree(client, 'old'))
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  view.rerender(tree(client, 'new'))
  await screen.findByText('BET-001')
  await act(async () => finish(Response.json([{ ...unit, uniqueCode: 'OLD' }])))
  expect(screen.queryByText('OLD')).toBeNull()
  fireEvent.click(
    screen.getByRole('button', { name: 'Excluir Unidade BET-001' })
  )
  view.rerender(tree(client, 'new', 'bia'))
  await screen.findByText('BET-001')
  expect(
    screen.queryByRole('button', { name: 'Confirmar Exclusão' })
  ).toBeNull()
  expect(fetcher.mock.calls.some(([, o]) => o?.method === 'DELETE')).toBe(false)
})
