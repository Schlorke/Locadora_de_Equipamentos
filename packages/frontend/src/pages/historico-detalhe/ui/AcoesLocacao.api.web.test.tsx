// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  ApiClientProvider,
  HttpError,
  type HttpClient,
  type HttpRequest,
} from '../../../shared/api'
import {
  ApplicationSessionProvider,
  type ApplicationSession,
} from '../../../entities/sessao'
import {
  PublicTenantProvider,
  TenantProvider,
} from '../../../entities/organizacao'
import { RentalActions } from './AcoesLocacao.web'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/area-cliente/historico',
}))
let session: ApplicationSession
function api() {
  const request = vi.fn(
    async (_path: string, _options?: HttpRequest): Promise<unknown> => ({
      success: true,
      message: 'Solicitação enviada',
    })
  )
  return { request, client: { request } as HttpClient }
}
function tree(
  client: HttpClient,
  slug = 'alfa',
  rentalId = 'rental-a',
  status = 'ACTIVE'
) {
  return (
    <ApplicationSessionProvider
      value={{
        data: session,
        status: session ? 'authenticated' : 'unauthenticated',
        update: vi.fn(),
        signOut: vi.fn(),
      }}
    >
      <ApiClientProvider client={client}>
        <TenantProvider value={null}>
          <PublicTenantProvider value={slug}>
            <RentalActions
              rentalId={rentalId}
              status={status}
              endDate={new Date('2030-01-01')}
              hasBoleto
              boletoPaymentId="boleto-a"
            />
          </PublicTenantProvider>
        </TenantProvider>
      </ApiClientProvider>
    </ApplicationSessionProvider>
  )
}
beforeEach(() => {
  session = { user: { id: 'ana' } }
  toast.success.mockReset()
  toast.error.mockReset()
  router.push.mockReset()
  router.refresh.mockReset()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('fetch relativo proibido')
    })
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
async function submit(kind: 'extension' | 'pickup') {
  fireEvent.click(
    screen.getByRole('button', {
      name: kind === 'extension' ? 'Solicitar Prorrogação' : 'Solicitar Coleta',
    })
  )
  const dialog = await screen.findByRole('dialog')
  if (kind === 'extension')
    fireEvent.change(within(dialog).getByLabelText('Dias Adicionais'), {
      target: { value: '365' },
    })
  fireEvent.click(
    within(dialog).getByRole('button', {
      name:
        kind === 'extension'
          ? 'Solicitar Prorrogação'
          : 'Confirmar Solicitação',
    })
  )
}
it.each(['extension', 'pickup'] as const)(
  'preserva pedido %s, mensagem e refresh sem converter para extensão direta',
  async (kind) => {
    const { client, request } = api()
    render(tree(client))
    await submit(kind)
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        kind === 'extension'
          ? 'Solicitação de prorrogação enviada!'
          : 'Solicitação de coleta enviada!'
      )
    )
    expect(request.mock.calls[0]![0]).toBe(
      '/api/client/rentals/rental-a/' +
        (kind === 'extension' ? 'request-extension' : 'request-pickup')
    )
    expect(request.mock.calls[0]![1]).toMatchObject({ method: 'POST' })
    if (kind === 'extension')
      expect(request.mock.calls[0]![1]?.body).toBe('{"additionalDays":365}')
    else expect(request.mock.calls[0]![1]?.body).toBeUndefined()
    expect(router.refresh).toHaveBeenCalledTimes(1)
  }
)
it('recusa não mostra sucesso nem atualiza navegação', async () => {
  const { client, request } = api()
  request.mockRejectedValue(new HttpError('Prazo inválido', 400))
  render(tree(client))
  await submit('extension')
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('Prazo inválido')
  )
  expect(toast.success).not.toHaveBeenCalled()
  expect(router.refresh).not.toHaveBeenCalled()
})
it.each(['locadora', 'usuário', 'locação'])(
  'pedido antigo não mostra sucesso/erro nem refresh ao mudar %s',
  async (kind) => {
    const { client, request } = api()
    let complete!: (value: unknown) => void
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    const view = render(tree(client))
    await submit('extension')
    await waitFor(() => expect(complete).toBeTypeOf('function'))
    if (kind === 'usuário') session = { user: { id: 'bia' } }
    view.rerender(
      tree(
        client,
        kind === 'locadora' ? 'bravo' : 'alfa',
        kind === 'locação' ? 'rental-b' : 'rental-a'
      )
    )
    await act(async () => complete({ success: true }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(request.mock.calls[0]![1]?.signal?.aborted).toBe(true)
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
    expect(router.refresh).not.toHaveBeenCalled()
  }
)
it('boleto mantém a navegação existente sem chamada remota', () => {
  const { client, request } = api()
  render(tree(client, 'alfa', 'rental-a', 'PENDING'))
  fireEvent.click(screen.getByRole('button', { name: 'Ver Boleto' }))
  expect(router.push).toHaveBeenCalledWith('/area-cliente/pagamentos/boleto-a')
  expect(request).not.toHaveBeenCalled()
})
