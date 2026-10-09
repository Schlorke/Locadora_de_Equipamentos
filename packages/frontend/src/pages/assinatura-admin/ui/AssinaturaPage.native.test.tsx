// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SUBSCRIPTION_STATUSES } from '@gb-locacoes/contracts/subscription'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import {
  subscriptionFixture,
  subscriptionTenant,
} from '../../../../../../tests/helpers/subscription-account'
import { subscriptionPresentation } from '../../../entities/assinatura'
const captured = vi.hoisted(() => ({ classes: [] as string[] }))
vi.mock('react-native', async () =>
  (
    await import('../../../../../../tests/helpers/native-screen')
  ).createNativeHost(captured.classes)
)
vi.mock('@gb-locacoes/ui', async () =>
  (await import('../../../../../../tests/helpers/native-screen')).nativeUi()
)
vi.mock(
  '../../../widgets/cabecalho-admin',
  async () => import('../../../widgets/cabecalho-admin/ui/Cabecalho.native')
)
import { AssinaturaAdminPage } from './AssinaturaPage.native'
afterEach(() => {
  cleanup()
  captured.classes.length = 0
})
function setup(
  response: unknown = subscriptionFixture(),
  status = 200,
  openPanel = vi.fn(async (_slug: string) => {})
) {
  const fetcher = vi.fn(async (_path: string, _init?: RequestInit) =>
    Response.json(response, { status })
  )
  render(
    <ApiClientProvider client={createHttpClient({ fetcher })}>
      <FrontendSessionFixture tenant={subscriptionTenant()}>
        <AssinaturaAdminPage openPanel={openPanel} />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
  return { fetcher, openPanel }
}
it.each(SUBSCRIPTION_STATUSES)(
  'mobile mostra %s e abre o painel externo, sem consultar faturas',
  async (status) => {
    const s = setup(subscriptionFixture(status))
    await screen.findByText(subscriptionPresentation[status].label)
    expect(
      screen.getByText(subscriptionPresentation[status].message)
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Abrir assinatura no navegador' })
    )
    await waitFor(() => expect(s.openPanel).toHaveBeenCalledWith('alfa'))
    expect(s.fetcher.mock.calls[0]?.[0]).toBe('/api/admin/subscription')
    expect(s.fetcher).toHaveBeenCalledTimes(1)
    expect(captured.classes).toEqual([])
    expect(screen.queryByText('Faturas da plataforma')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Ativar assinatura' })
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Reativar assinatura' })
    ).toBeNull()
    expect(
      screen.queryByRole('radiogroup', { name: 'Plano para reativação' })
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Cancelar assinatura' })
    ).toBeNull()
    expect(
      s.fetcher.mock.calls.every(
        (call) => !call[1]?.method || call[1]?.method === 'GET'
      )
    ).toBe(true)
  }
)
it('não abre painel comercial para membro sem propriedade', async () => {
  const s = setup({ code: 'OWNER_REQUIRED' }, 403)
  await screen.findByText(/dono atual/)
  expect(
    screen.queryByRole('button', { name: 'Abrir assinatura no navegador' })
  ).toBeNull()
  expect(s.openPanel).not.toHaveBeenCalled()
})
it('falha de configuração/browser é recuperável e não mostra o erro privado', async () => {
  const openPanel = vi.fn(async (_slug: string) => {
    throw new Error('segredo')
  })
  setup(subscriptionFixture(), 200, openPanel)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Abrir assinatura no navegador' })
  )
  await screen.findByText(/Não foi possível abrir o painel/)
  expect(screen.queryByText('segredo')).toBeNull()
  expect(
    (
      screen.getByRole('button', {
        name: 'Abrir assinatura no navegador',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(false)
})
