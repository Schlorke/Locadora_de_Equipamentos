// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import { subscriptionTenant } from '../../../../../../tests/helpers/subscription-account'
import { onboardingChecklistFixture } from '../../../../../../tests/helpers/onboarding-checklist'
const captured = vi.hoisted(() => ({ classes: [] as string[] }))
vi.mock('react-native', async () =>
  (
    await import('../../../../../../tests/helpers/native-screen')
  ).createNativeHost(captured.classes)
)
vi.mock('@gb-locacoes/ui', async () => ({
  ...(await (
    await import('../../../../../../tests/helpers/native-screen')
  ).nativeUi()),
  ...(await import('../../../../../ui/src/native/Stack.native')),
  ...(await import('../../../../../ui/src/native/Text.native')),
}))
// Platform resolver in this web-oriented test config chooses the explicit native contract.
vi.mock(
  '../../../features/publicar-site',
  async () =>
    await import('../../../features/publicar-site/ui/PublicarSite.native')
)
import { ChecklistPrimeirosPassos } from './ChecklistPrimeirosPassos.native'
afterEach(() => {
  cleanup()
  captured.classes.length = 0
})
it('mesmos fatos e leitura autenticada no app; abre painel com slug e nenhum POST', async () => {
  const fetcher = vi.fn(async () => Response.json(onboardingChecklistFixture()))
  const openPanel = vi.fn(async (_slug: string) => {})
  render(
    <ApiClientProvider client={createHttpClient({ fetcher })}>
      <FrontendSessionFixture tenant={subscriptionTenant()}>
        <ChecklistPrimeirosPassos openPanel={openPanel} />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
  await screen.findByText('Primeiro equipamento')
  fireEvent.click(
    screen.getByRole('button', { name: 'Continuar no painel web' })
  )
  await waitFor(() =>
    expect(openPanel).toHaveBeenCalledWith(subscriptionTenant().tenant.slug)
  )
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(captured.classes).toEqual([])
})
it('falha ao abrir painel oferece mensagem neutra sem publicar pelo app', async () => {
  const fetcher = vi.fn(async () => Response.json(onboardingChecklistFixture()))
  render(
    <ApiClientProvider client={createHttpClient({ fetcher })}>
      <FrontendSessionFixture tenant={subscriptionTenant()}>
        <ChecklistPrimeirosPassos
          openPanel={async () => {
            throw new Error('private-config')
          }}
        />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
  fireEvent.click(
    await screen.findByRole('button', { name: 'Continuar no painel web' })
  )
  await screen.findByText('Não foi possível abrir o painel. Tente novamente.')
  expect(screen.queryByText('private-config')).toBeNull()
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('ADMIN sem ownership não recebe detalhes ou botão do painel', async () => {
  render(
    <ApiClientProvider
      client={createHttpClient({
        fetcher: async () =>
          Response.json({ code: 'OWNER_REQUIRED' }, { status: 403 }),
      })}
    >
      <FrontendSessionFixture tenant={subscriptionTenant()}>
        <ChecklistPrimeirosPassos />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
  await waitFor(() => expect(screen.queryByText('Primeiros passos')).toBeNull())
})
