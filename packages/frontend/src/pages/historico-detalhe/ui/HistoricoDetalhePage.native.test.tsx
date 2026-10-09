// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  historyTree,
  historyRental,
  historyQuote,
  nativeHistoryApi,
} from '../../../../../../tests/helpers/customer-history'
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
  toast: captured,
}))
vi.mock(
  '../../../shared/lib/activity',
  async () =>
    await import('../../../shared/lib/activity/use-active-refresh.native')
)
vi.mock(
  '../../../features/bloco-preco',
  async () => await import('../../../features/bloco-preco/ui/Bloco.native')
)
vi.mock('../../../entities/configuracao', () => ({
  usePublicSettings: () => ({ settings: { whatsappNumber: '5500000000000' } }),
}))
import { RentalDetailsPage } from './HistoricoDetalhePage.native'
beforeEach(() => {
  captured.classes.length = 0
  captured.success.mockClear()
  captured.error.mockClear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
function api() {
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('download'))
      return new Response('<h1>Contrato Alfa</h1>', {
        headers: { 'Content-Type': 'text/html' },
      })
    if (options?.method)
      return Response.json(
        url.endsWith('extend')
          ? { extensionFee: 12.5 }
          : { message: 'Solicitação enviada' }
      )
    return Response.json(
      url.includes('/quotes/') ? historyQuote : { rental: historyRental }
    )
  })
  return { fetcher, client: nativeHistoryApi(fetcher as typeof fetch) }
}
it('conserva Decimal, total final/multa, imagens, frete incluído e timeline', async () => {
  const { client } = api()
  render(
    historyTree(
      <RentalDetailsPage
        paramId="r 1"
        resolveAssetUrl={(src) => 'https://assets.example.test' + src}
      />,
      client
    )
  )
  expect(
    await screen.findByRole('heading', { name: 'Detalhes da Locação' })
  ).toBeTruthy()
  expect(screen.getByText(/Total a Pagar:.*85,75/)).toBeTruthy()
  expect(screen.getByText(/Frete:.*15,00/)).toBeTruthy()
  expect(screen.getByText('Pagamento Pago')).toBeTruthy()
  expect(screen.getByAltText('Betoneira Alfa').getAttribute('src')).toBe(
    'https://assets.example.test/equipment.png'
  )
  expect(captured.classes).toEqual([])
})
it('quote_ preserva código, zero, desconto integral, motivo e cancelamento', async () => {
  const { client, fetcher } = api(),
    navigate = vi.fn()
  render(
    historyTree(
      <RentalDetailsPage paramId="quote_q 1" />,
      client,
      'ana',
      'alfa',
      navigate
    )
  )
  await screen.findByRole('heading', { name: 'Detalhes do Orçamento' })
  expect(fetcher.mock.calls[0]?.[0]).toBe(
    'https://api.example.test/api/quotes/q%201'
  )
  expect(screen.getByText('Código: Q-ALFA')).toBeTruthy()
  expect(screen.getByText(/Total a Pagar:.*0,00/)).toBeTruthy()
  expect(screen.getByText('Semanal: -100%')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Ver Reajuste' }))
  expect(await screen.findByText('Outro: Cortesia')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar Orçamento' }))
  fireEvent.click(screen.getByRole('button', { name: 'Sim, cancelar' }))
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith('/area-cliente/historico')
  )
  expect(fetcher.mock.calls.find(([, o]) => o?.method === 'DELETE')?.[0]).toBe(
    'https://api.example.test/api/quotes/q%201'
  )
})
it('prorrogação direta mantém 1–30/extensionDays e coleta não envia corpo', async () => {
  const { client, fetcher } = api()
  render(historyTree(<RentalDetailsPage paramId="r 1" />, client))
  await screen.findByText('Betoneira Alfa')
  fireEvent.click(screen.getByRole('button', { name: 'Solicitar Prorrogação' }))
  fireEvent.change(screen.getByLabelText('Dias de prorrogação'), {
    target: { value: '31' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar Solicitação' }))
  expect(captured.error).toHaveBeenCalledWith(
    'Por favor, insira um número válido entre 1 e 30'
  )
  fireEvent.change(screen.getByLabelText('Dias de prorrogação'), {
    target: { value: '7' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar Solicitação' }))
  await waitFor(() =>
    expect(captured.success).toHaveBeenCalledWith(
      expect.stringContaining('12,50')
    )
  )
  expect(
    fetcher.mock.calls.find(([url]) => url.endsWith('/extend'))?.[1]?.body
  ).toBe('{"extensionDays":7}')
  fireEvent.click(screen.getByRole('button', { name: 'Solicitar Coleta' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar Solicitação' }))
  await waitFor(() =>
    expect(captured.success).toHaveBeenCalledWith(
      expect.stringContaining('Solicitação de coleta enviada')
    )
  )
  expect(
    fetcher.mock.calls.find(([url]) => url.endsWith('/request-pickup'))?.[1]
  ).toMatchObject({ method: 'POST' })
  expect(
    fetcher.mock.calls.find(([url]) => url.endsWith('/request-pickup'))?.[1]
      ?.body
  ).toBeUndefined()
})
it('download entrega bytes autenticados ao adaptador nativo', async () => {
  const { client, fetcher } = api(),
    download = vi.fn(
      async (_file: {
        blob: Blob
        name: string
        isCurrent: () => boolean
      }) => {}
    )
  render(
    historyTree(
      <RentalDetailsPage paramId="r 1" onDownload={download} />,
      client
    )
  )
  await screen.findByText('Betoneira Alfa')
  fireEvent.click(screen.getByRole('button', { name: 'Baixar Contrato' }))
  await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
  const result = download.mock.calls[0]![0] as unknown as {
    blob: Blob
    name: string
    isCurrent(): boolean
  }
  expect(result.name).toBe('contrato-r 1.html')
  expect(result.blob.size).toBe(22)
  expect(result.isCurrent()).toBe(true)
  expect(
    new Headers(
      fetcher.mock.calls.find(([url]) => url.endsWith('download'))?.[1]?.headers
    ).get('Authorization')
  ).toBe('Bearer fixture')
})
it('404 mantém mensagem e volta para histórico', async () => {
  const navigate = vi.fn(),
    fetcher = vi.fn(async () => new Response('{}', { status: 404 }))
  render(
    historyTree(
      <RentalDetailsPage paramId="missing" />,
      nativeHistoryApi(fetcher as typeof fetch),
      'ana',
      'alfa',
      navigate
    )
  )
  await waitFor(() =>
    expect(captured.error).toHaveBeenCalledWith('Locação não encontrada')
  )
  expect(navigate).toHaveBeenCalledWith('/area-cliente/historico')
})
it('mostra coleta agendada mesmo sem endereço ou frete', async () => {
  const fetcher = vi.fn(async () =>
    Response.json({
      rental: {
        ...historyRental,
        quote: null,
        deliveries: [
          {
            id: 'coleta',
            type: 'PICKUP',
            status: 'PENDING',
            scheduledAt: '2030-01-05T12:00:00Z',
          },
        ],
      },
    })
  )
  render(
    historyTree(
      <RentalDetailsPage paramId="r 1" />,
      nativeHistoryApi(fetcher as typeof fetch)
    )
  )
  expect(
    await screen.findByRole('heading', { name: 'Entrega e Coleta' })
  ).toBeTruthy()
  expect(screen.getByText(/PICKUP · PENDING/)).toBeTruthy()
})
it('troca de registro descarta leitura antiga', async () => {
  let complete!: (r: Response) => void
  const { client, fetcher } = api()
  fetcher.mockImplementationOnce(() => new Promise((r) => (complete = r)))
  const view = render(historyTree(<RentalDetailsPage paramId="r 1" />, client))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  view.rerender(historyTree(<RentalDetailsPage paramId="quote_q 1" />, client))
  await screen.findByText('Código: Q-ALFA')
  await act(async () => complete(Response.json({ rental: historyRental })))
  expect(
    screen.queryByRole('heading', { name: 'Detalhes da Locação' })
  ).toBeNull()
  expect(captured.error).not.toHaveBeenCalled()
})
