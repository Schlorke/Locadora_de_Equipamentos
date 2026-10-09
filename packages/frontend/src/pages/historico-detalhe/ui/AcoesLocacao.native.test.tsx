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
import {
  historyTree,
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
import { RentalActions } from './AcoesLocacao.native'
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it('pedido à equipe envia additionalDays, conserva refresh e é distinto da extensão direta', async () => {
  const fetcher = vi.fn(async (_url: string, _options?: RequestInit) =>
      Response.json({ success: true, message: 'OK' })
    ),
    refresh = vi.fn(),
    client = nativeHistoryApi(fetcher as typeof fetch)
  render(
    historyTree(
      <RentalActions
        rentalId="r 1"
        status="ACTIVE"
        endDate={new Date(2030, 0, 10)}
        onRefresh={refresh}
      />,
      client
    )
  )
  fireEvent.click(screen.getByRole('button', { name: 'Solicitar Prorrogação' }))
  fireEvent.change(screen.getByLabelText('Dias Adicionais'), {
    target: { value: '3' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar Pedido' }))
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  expect(fetcher.mock.calls[0]?.[0]).toBe(
    'https://api.example.test/api/client/rentals/r%201/request-extension'
  )
  expect(fetcher.mock.calls[0]?.[1]?.body).toBe('{"additionalDays":3}')
  fireEvent.click(screen.getByRole('button', { name: 'Solicitar Coleta' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar Solicitação' }))
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2))
  expect(fetcher.mock.calls[1]?.[0]).toBe(
    'https://api.example.test/api/client/rentals/r%201/request-pickup'
  )
  expect(fetcher.mock.calls[1]?.[1]?.body).toBeUndefined()
})
it('pedido recebido no servidor não mostra feedback nem refresh em outro registro', async () => {
  let complete!: (r: Response) => void
  const fetcher = vi.fn(() => new Promise<Response>((r) => (complete = r))),
    client = nativeHistoryApi(fetcher as typeof fetch),
    refresh = vi.fn()
  const view = render(
    historyTree(
      <RentalActions
        rentalId="old"
        status="ACTIVE"
        endDate={new Date(2030, 0, 10)}
        onRefresh={refresh}
      />,
      client
    )
  )
  fireEvent.click(screen.getByRole('button', { name: 'Solicitar Coleta' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar Solicitação' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  view.rerender(
    historyTree(
      <RentalActions
        rentalId="new"
        status="ACTIVE"
        endDate={new Date(2030, 0, 10)}
        onRefresh={refresh}
      />,
      client
    )
  )
  await act(async () => complete(Response.json({ success: true })))
  expect(refresh).not.toHaveBeenCalled()
  expect(captured.success).not.toHaveBeenCalled()
  expect(captured.error).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).toBeNull()
})
