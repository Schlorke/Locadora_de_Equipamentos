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
import {
  subscriptionFixture,
  subscriptionOfferFixture,
  invoiceFixture,
  subscriptionTenant,
} from '../../../../../../tests/helpers/subscription-account'
import { AssinaturaAdminPage } from './AssinaturaPage.web'

afterEach(cleanup)
function setup(
  command = vi.fn(async (_path: string, _init?: RequestInit) =>
    Response.json({ accepted: true })
  ),
  catalog = vi.fn(async () =>
    Response.json({
      plans: [
        subscriptionOfferFixture(),
        subscriptionOfferFixture({
          planVersionId: 'other-offer',
          name: 'Outra oferta de teste',
          amount: '249.90',
        }),
      ],
    })
  ),
  ownerStatus = 200
) {
  let accepted = false
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/public/plans') return catalog()
    if (init?.method === 'POST') {
      const response = await command(path, init)
      if (response.ok) accepted = true
      return response
    }
    if (ownerStatus !== 200)
      return Response.json({ code: 'OWNER_REQUIRED' }, { status: ownerStatus })
    return Response.json(
      path.endsWith('/invoices')
        ? {
            invoices: [
              invoiceFixture({
                status: 'PAID',
                paidAt: '2026-10-02T12:00:00Z',
              }),
            ],
          }
        : {
            ...subscriptionFixture(accepted ? 'INCOMPLETE' : 'CANCELED'),
            trialEndsAt: null,
          }
    )
  })
  const client = createHttpClient({ fetcher })
  const page = (slug = 'alfa') => (
    <ApiClientProvider client={client}>
      <FrontendSessionFixture tenant={subscriptionTenant(slug)}>
        <AssinaturaAdminPage />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
  return { ...render(page()), page, fetcher, command, catalog }
}
async function choose() {
  fireEvent.click(await screen.findByRole('radio', { name: /Plano de teste/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Reativar assinatura' }))
}

it('não pré-seleciona oferta; confirmação mostra preço/sem teste e recibo relê preservando faturas pagas', async () => {
  const { command, fetcher } = setup()
  await screen.findByRole('radiogroup', { name: 'Plano para reativação' })
  expect(
    (
      screen.getByRole('button', {
        name: 'Reativar assinatura',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true)
  expect(command).not.toHaveBeenCalled()
  await choose()
  expect(screen.getByRole('alertdialog')).toBeTruthy()
  expect(
    screen.getByText(
      /plano Plano de teste por R\$ 199,90 por mês, sem novo período de teste/
    )
  ).toBeTruthy()
  expect(
    screen.getByText(/pagamentos já realizados serão preservados/)
  ).toBeTruthy()
  expect(command).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar reativação' }))
  await screen.findByText(/Pedido de reativação registrado/)
  await screen.findByText('Incompleta', { exact: true })
  expect(screen.queryByText('Ativa', { exact: true })).toBeNull()
  expect(screen.getByText('Paga', { exact: true })).toBeTruthy()
  expect(command).toHaveBeenCalledTimes(1)
  expect(command.mock.calls[0]?.[0]).toBe('/api/admin/subscription/reactivate')
  expect(command.mock.calls[0]?.[1]?.body).toBe(
    '{"planVersionId":"offer-fixture"}'
  )
  expect(
    fetcher.mock.calls.filter(
      (call) =>
        call[0].startsWith('/api/admin/subscription') &&
        call[1]?.method !== 'POST'
    )
  ).toHaveLength(4)
})

it('Voltar não envia; outra oferta só é usada após nova confirmação', async () => {
  const { command } = setup()
  await choose()
  fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
  expect(command).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('radio', { name: /Outra oferta de teste/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Reativar assinatura' }))
  expect(
    screen.getByText(/Outra oferta de teste por R\$ 249,90 por mês/)
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar reativação' }))
  await screen.findByText(/Pedido de reativação registrado/)
  expect(command.mock.calls[0]?.[1]?.body).toBe(
    '{"planVersionId":"other-offer"}'
  )
})

it('resultado incerto trava escolha e conserva versão/chave na repetição manual', async () => {
  const command = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(Response.json({ accepted: true }))
  setup(command)
  await choose()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar reativação' }))
  await screen.findByRole('button', { name: 'Repetir o mesmo pedido' })
  fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
  expect(
    (screen.getByRole('radio', { name: /Outra oferta/ }) as HTMLButtonElement)
      .disabled
  ).toBe(true)
  expect(command).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Reativar assinatura' }))
  fireEvent.click(
    screen.getByRole('button', { name: 'Repetir o mesmo pedido' })
  )
  await screen.findByText(/Pedido de reativação registrado/)
  const requests = command.mock.calls.map((call) => [
    call[0],
    call[1]?.body,
    new Headers(call[1]?.headers).get('Idempotency-Key'),
  ])
  expect(requests).toHaveLength(2)
  expect(requests[0]).toEqual(requests[1])
  expect(requests[0]?.[2]).toBeTruthy()
})

it('login recente exige revisão e não transmite plano/comando/chave pela URL', async () => {
  const command = vi.fn(async () =>
    Response.json({ code: 'FRESH_SESSION_REQUIRED' }, { status: 401 })
  )
  setup(command)
  await choose()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar reativação' }))
  const url = new URL(
    (
      (await screen.findByRole('link', {
        name: 'Entrar novamente',
      })) as HTMLAnchorElement
    ).href
  )
  expect([...url.searchParams.keys()].sort()).toEqual([
    'callbackUrl',
    'reauthenticate',
  ])
  expect(url.searchParams.get('callbackUrl')).toBe(
    '/admin/assinatura?locadora=alfa'
  )
  expect(command).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('alertdialog')).toBeNull()
})

it('catálogo indisponível não inventa oferta e recupera só após clique', async () => {
  const catalog = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ error: 'segredo' }, { status: 503 }))
    .mockResolvedValue(Response.json({ plans: [subscriptionOfferFixture()] }))
  const { command } = setup(undefined, catalog)
  await screen.findByText('Não foi possível consultar os planos disponíveis.')
  expect(screen.queryByText('segredo')).toBeNull()
  expect(command).not.toHaveBeenCalled()
  expect(catalog).toHaveBeenCalledTimes(1)
  fireEvent.click(
    screen.getByRole('button', { name: 'Consultar planos novamente' })
  )
  await screen.findByRole('radio', { name: /Plano de teste/ })
  expect(catalog).toHaveBeenCalledTimes(2)
})

it.each([
  { plans: [] },
  { plans: [subscriptionOfferFixture({ interval: 'YEARLY' })] },
])('catálogo sem oferta mensal não permite pedido (%j)', async ({ plans }) => {
  const { command } = setup(
    undefined,
    vi.fn(async () => Response.json({ plans }))
  )
  await screen.findByText(
    'Nenhum plano mensal disponível para reativação no momento.'
  )
  expect(
    (
      screen.getByRole('button', {
        name: 'Reativar assinatura',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true)
  expect(command).not.toHaveBeenCalled()
})

it('PLAN_NOT_AVAILABLE pede revisão, sem expor erro privado nem repetir', async () => {
  const command = vi.fn(async () =>
    Response.json(
      { code: 'PLAN_NOT_AVAILABLE', error: 'segredo' },
      { status: 409 }
    )
  )
  setup(command)
  await choose()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar reativação' }))
  await screen.findByText(/O plano escolhido não está disponível/)
  expect(screen.queryByText('segredo')).toBeNull()
  expect(command).toHaveBeenCalledTimes(1)
})

it('recusa do servidor para não-dono não carrega ofertas nem abre confirmação', async () => {
  const { command, catalog } = setup(undefined, undefined, 403)
  await screen.findByText(
    'Esta consulta é exclusiva do dono atual da locadora.'
  )
  expect(screen.queryByRole('radiogroup')).toBeNull()
  expect(catalog).not.toHaveBeenCalled()
  expect(command).not.toHaveBeenCalled()
})

it('mudança de locadora aborta comando e descarta a resposta tardia', async () => {
  let finish!: (response: Response) => void
  const command = vi.fn(
    (_path: string, _init?: RequestInit) =>
      new Promise<Response>((resolve) => {
        finish = resolve
      })
  )
  const { rerender, page } = setup(command)
  await choose()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar reativação' }))
  await waitFor(() => expect(command).toHaveBeenCalledTimes(1))
  rerender(page('bravo'))
  expect(command.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
  await act(async () => finish(Response.json({ accepted: true })))
  await screen.findByText('Plano e faturas de Locadora bravo')
  expect(screen.queryByText(/Pedido de reativação registrado/)).toBeNull()
  expect(screen.queryByRole('alertdialog')).toBeNull()
})
