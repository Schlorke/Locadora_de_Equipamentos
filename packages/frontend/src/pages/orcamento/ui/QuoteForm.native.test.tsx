// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  ApiClientProvider,
  type HttpClient,
  type HttpRequest,
} from '../../../shared/api'
import {
  PublicTenantProvider,
  TenantProvider,
} from '../../../entities/organizacao'
const captured = vi.hoisted(() => ({
  classes: [] as string[],
  info: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
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
  ...(await import('../../../../../ui/src/native/Textarea.native')),
  toast: captured,
}))
vi.mock('../../../shared/lib/toast', () => ({ toast: captured }))
import QuoteForm from './QuoteForm.native'
import { ApplicationSessionProvider } from '../../../entities/sessao'
afterEach(cleanup)
it('valida a primeira etapa e conserva o contrato do formulário alternativo', async () => {
  const request = vi.fn(async (_path: string, _options?: HttpRequest) => ({
      success: true,
    })),
    onSuccess = vi.fn(),
    clearQuery = vi.fn()
  const client: HttpClient = {
    request: async <T,>(path: string, options?: HttpRequest) =>
      (await request(path, options)) as T,
  }
  render(
    <ApiClientProvider client={client}>
      <TenantProvider value={null}>
        <PublicTenantProvider value="alfa">
          <ApplicationSessionProvider
            value={{
              data: null,
              status: 'unauthenticated',
              update: async () => null,
              signOut: async () => {},
            }}
          >
            <QuoteForm
              prefilledEquipment={{ id: 'eq', name: 'Betoneira' }}
              onSuccess={onSuccess}
              clearQuery={clearQuery}
            />
          </ApplicationSessionProvider>
        </PublicTenantProvider>
      </TenantProvider>
    </ApiClientProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
  expect(
    await screen.findByText('Nome deve ter pelo menos 2 caracteres')
  ).toBeTruthy()
  expect(request).not.toHaveBeenCalled()
  for (const [label, value] of [
    ['Nome Completo', 'Ana'],
    ['E-mail', 'ana@example.test'],
    ['Telefone', '51999999999'],
  ])
    fireEvent.change(screen.getByLabelText(label!), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
  await screen.findByLabelText('Dias de locação')
  fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
  fireEvent.click(
    await screen.findByRole('button', { name: 'Enviar Solicitação' })
  )
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  expect(request.mock.calls[0]?.[0]).toBe('/api/orcamentos')
  expect(JSON.parse(request.mock.calls[0]![1]!.body!)).toMatchObject({
    tenantSlug: 'alfa',
    customerName: 'Ana',
    items: [{ equipmentId: 'eq', quantity: 1, days: 7 }],
    urgency: 'media',
  })
  expect(clearQuery).toHaveBeenCalledOnce()
  expect(captured.classes).toEqual([])
})
