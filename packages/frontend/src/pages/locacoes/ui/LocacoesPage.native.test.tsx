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
import { AdminRentalsPage } from './LocacoesPage.native'
import type { Rental } from '../model/contracts'
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
const rentals = Array.from({ length: 11 }, (_, i): Rental => ({
  id: 'r' + i,
  status: 'PENDING',
  createdat: '2026-10-03T12:00:00',
  startdate: '2026-10-03T12:00:00',
  enddate: '2026-10-05T12:00:00',
  total: 100,
  users: {
    id: 'u' + i,
    name: 'Cliente ' + i,
    email: 'ana@example.test',
    phone: '123',
  },
  rental_items: [
    {
      id: 'item' + i,
      quantity: 2,
      totaldays: 3,
      totalprice: 100,
      equipments: { id: 'e1', name: 'Furadeira', images: [] },
    },
  ],
  payments: [
    { id: 'p' + i, amount: 100, status: 'PAID', method: 'PIX', paidAt: null },
  ],
}))
function setup(fail = false) {
  let list = structuredClone(rentals)
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/documents')) return Response.json({ documents: [] })
    if (url.endsWith('/contract'))
      return Response.json({
        contract: {
          id: 'c',
          status: 'PENDING',
          pdfUrl: 'https://storage.example.test/contract.pdf',
        },
      })
    if (url.endsWith('/client-documents'))
      return Response.json(
        fail ? { error: 'Arquivo inválido' } : { document: { id: 'doc' } },
        { status: fail ? 400 : 200 }
      )
    if (init?.method === 'PATCH') {
      const id = url.split('/').at(-1)
      list = list.map((r) =>
        r.id === id ? { ...r, ...JSON.parse(String(init.body)) } : r
      )
      return Response.json({ ok: true })
    }
    return Response.json({ rentals: list })
  })
  return {
    fetcher,
    client: createHttpClient({
      baseUrl: 'https://api.example.test',
      fetcher,
      getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
    }),
  }
}
function tree(
  client: ReturnType<typeof createHttpClient>,
  pickDocument = async () => null as FormData | null,
  user = 'ana',
  openDocument = vi.fn(async (_url: string) => {})
) {
  return (
    <ApiClientProvider client={client}>
      <FrontendSessionFixture
        userId={user}
        tenant={{
          tenant: { id: 'alfa', slug: 'alfa', name: 'Alfa', status: 'ACTIVE' },
          membershipId: 'm',
          role: 'ADMIN',
        }}
      >
        <AdminRentalsPage
          pickDocument={pickDocument}
          openDocument={openDocument}
        />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
}
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
  captured.classes.length = 0
})
it('lista pagina dez, busca/reseta sem alterar status, calendário navega e abre detalhe', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-03T12:00:00'))
  const { client } = setup()
  render(tree(client))
  await screen.findByRole('button', { name: 'Exibir r0' })
  expect(screen.queryByRole('button', { name: 'Exibir r10' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
  await screen.findByRole('button', { name: 'Exibir r10' })
  fireEvent.change(screen.getByRole('textbox', { name: 'Buscar locações' }), {
    target: { value: 'Cliente 2' },
  })
  await screen.findByRole('button', { name: 'Exibir r2' })
  expect(screen.queryByRole('button', { name: 'Exibir r10' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Resetar filtros' }))
  await screen.findByRole('button', { name: 'Exibir r0' })
  fireEvent.click(screen.getByRole('button', { name: 'Calendário' }))
  await screen.findByRole('heading', { name: 'Calendário de Locações' })
  expect(
    screen.getByRole('button', { name: 'Exibir r0 em 03/10/2026' })
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Próximo período' }))
  expect(
    screen.queryByRole('button', { name: 'Exibir r0 em 03/10/2026' })
  ).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Período anterior' }))
  fireEvent.click(
    screen.getByRole('button', { name: 'Exibir r0 em 03/10/2026' })
  )
  await screen.findByText('Detalhes da Locação')
  expect(screen.getAllByText('Furadeira').length).toBeGreaterThan(0)
  expect(captured.classes).toEqual([])
})
it('contrato/PDF, documentos multipart e check-in/check-out usam os mesmos DTOs e credenciais', async () => {
  const { client, fetcher } = setup(),
    body = new FormData()
  body.append(
    'file',
    new File(['private'], 'proof.pdf', { type: 'application/pdf' })
  )
  const pick = vi.fn(async () => body),
    open = vi.fn(async (_url: string) => {})
  render(tree(client, pick, 'ana', open))
  fireEvent.click(await screen.findByRole('button', { name: 'Exibir r0' }))
  await screen.findByText('Detalhes da Locação')
  fireEvent.click(screen.getByRole('button', { name: 'Gerar contrato' }))
  await screen.findByRole('button', { name: 'Abrir PDF' })
  fireEvent.click(screen.getByRole('button', { name: 'Abrir PDF' }))
  expect(open).toHaveBeenCalledWith('https://storage.example.test/contract.pdf')
  fireEvent.click(
    screen.getByRole('button', { name: 'Enviar Documento de identidade' })
  )
  await waitFor(() =>
    expect(
      fetcher.mock.calls.some(([url]) => url.endsWith('/client-documents'))
    ).toBe(true)
  )
  const [, init] = fetcher.mock.calls.find(([url]) =>
      url.endsWith('/client-documents')
    )!,
    form = init!.body as FormData
  expect(form.get('type')).toBe('ID_DOCUMENT')
  expect(form.get('file')).toMatchObject({
    name: 'proof.pdf',
    type: 'application/pdf',
  })
  expect(JSON.parse(String(form.get('captureMetadata')))).toMatchObject({
    source: 'admin-rentals-page',
  })
  expect(init).toMatchObject({
    credentials: 'include',
    method: 'POST',
    headers: { 'x-tenant-id': 'alfa' },
  })
  expect(init?.headers).not.toHaveProperty('Content-Type')
  await waitFor(() =>
    expect(captured.success).toHaveBeenCalledWith(
      'Documento enviado com sucesso'
    )
  )
  fireEvent.click(screen.getByRole('button', { name: 'Realizar Check-in' }))
  await waitFor(() =>
    expect(screen.queryByText('Detalhes da Locação')).toBeNull()
  )
  fireEvent.click(screen.getByRole('button', { name: 'Ativa' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Exibir r0' }))
  fireEvent.click(screen.getByRole('button', { name: 'Realizar Check-out' }))
  await waitFor(() =>
    expect(screen.queryByText('Detalhes da Locação')).toBeNull()
  )
  const payloads = fetcher.mock.calls
    .filter(([, init]) => init?.method === 'PATCH')
    .map(([, init]) => JSON.parse(String(init!.body)))
  expect(payloads).toEqual([
    { checkInAt: expect.any(String), status: 'ACTIVE' },
    { checkOutAt: expect.any(String), status: 'COMPLETED' },
  ])
})
it('cancelamento não envia; falha conserva detalhe e permite retry', async () => {
  const { client, fetcher } = setup(true),
    pick = vi.fn<() => Promise<FormData | null>>(async () => null)
  render(tree(client, pick))
  fireEvent.click(await screen.findByRole('button', { name: 'Exibir r0' }))
  const button = await screen.findByRole('button', {
    name: 'Enviar Selfie do cliente',
  })
  fireEvent.click(button)
  await waitFor(() =>
    expect((button as HTMLButtonElement).disabled).toBe(false)
  )
  expect(
    fetcher.mock.calls.some(([url]) => url.endsWith('/client-documents'))
  ).toBe(false)
  pick.mockImplementation(async () => {
    const form = new FormData()
    form.append('file', new File(['photo'], 'selfie.jpg'))
    return form
  })
  fireEvent.click(button)
  await waitFor(() =>
    expect(captured.error).toHaveBeenCalledWith('Arquivo inválido')
  )
  expect(screen.getByText('Detalhes da Locação')).toBeTruthy()
  expect((button as HTMLButtonElement).disabled).toBe(false)
})
it.each(['close', 'session'] as const)(
  'descarta picker após %s sem enviar documento antigo',
  async (change) => {
    const { client, fetcher } = setup()
    let resolve!: (body: FormData) => void
    const pick = vi.fn(() => new Promise<FormData>((done) => (resolve = done)))
    const rendered = render(tree(client, pick))
    fireEvent.click(await screen.findByRole('button', { name: 'Exibir r0' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Enviar CPF/CNPJ' })
    )
    await waitFor(() => expect(pick).toHaveBeenCalledTimes(1))
    if (change === 'session') rendered.rerender(tree(client, pick, 'bia'))
    else
      fireEvent.click(screen.getAllByRole('button', { name: 'Fechar' }).at(-1)!)
    const form = new FormData()
    form.append('file', new File(['old'], 'old.pdf'))
    await act(async () => resolve(form))
    await screen.findByRole('button', { name: 'Exibir r0' })
    expect(screen.queryByText('Detalhes da Locação')).toBeNull()
    expect(
      fetcher.mock.calls.some(([url]) => url.endsWith('/client-documents'))
    ).toBe(false)
    expect(captured.error).not.toHaveBeenCalled()
    expect(captured.success).not.toHaveBeenCalled()
  }
)
