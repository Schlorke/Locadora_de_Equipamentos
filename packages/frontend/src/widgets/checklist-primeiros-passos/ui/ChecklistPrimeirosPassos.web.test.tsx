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
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import { subscriptionTenant } from '../../../../../../tests/helpers/subscription-account'
import { onboardingChecklistFixture } from '../../../../../../tests/helpers/onboarding-checklist'
import { PublicTenantProvider } from '../../../entities/organizacao'
import { ChecklistPrimeirosPassos } from './ChecklistPrimeirosPassos.web'
afterEach(cleanup)
function tree(
  fetcher: (path: string, init?: RequestInit) => Promise<Response>,
  role: 'ADMIN' | 'CLIENT' = 'ADMIN'
) {
  const tenant = subscriptionTenant()
  tenant.role = role
  return (
    <ApiClientProvider client={createHttpClient({ fetcher })}>
      <FrontendSessionFixture tenant={tenant}>
        <PublicTenantProvider value={tenant.tenant.slug}>
          <ChecklistPrimeirosPassos />
        </PublicTenantProvider>
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
}
it('ordem e passos opcionais vêm do contrato; links existentes não inventam recebimentos', async () => {
  const fetcher = vi.fn(async () => Response.json(onboardingChecklistFixture()))
  render(tree(fetcher))
  const list = await screen.findByRole('list', {
    name: 'Etapas de configuração',
  })
  expect(within(list).getAllByRole('listitem')).toHaveLength(6)
  expect(screen.getByText('Assinar a plataforma')).toBeTruthy()
  expect(screen.queryByText('Confirmar os dados de recebimento')).toBeNull()
  expect(
    screen
      .getByRole('link', { name: 'Consultar assinatura' })
      .getAttribute('href')
  ).toBe('/admin/assinatura')
  expect(
    screen.queryByRole('link', { name: 'Ativar pagamentos online' })
  ).toBeNull()
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(
    screen
      .getByRole('link', { name: 'Consultar recebimentos' })
      .getAttribute('href')
  ).toBe('/admin/recebimentos')
})
it('não consulta para papel de cliente, não expõe para ADMIN sem ownership ou sem assinatura antiga', async () => {
  const fetcher = vi.fn(async () =>
    Response.json({ code: 'OWNER_REQUIRED' }, { status: 403 })
  )
  const view = render(tree(fetcher, 'CLIENT'))
  expect(fetcher).not.toHaveBeenCalled()
  expect(screen.queryByText('Primeiros passos')).toBeNull()
  view.rerender(tree(fetcher))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(screen.queryByText('Primeiros passos')).toBeNull())
  view.rerender(
    tree(async () =>
      Response.json({ code: 'SUBSCRIPTION_NOT_FOUND' }, { status: 404 })
    )
  )
  await waitFor(() => expect(screen.queryByText('Primeiros passos')).toBeNull())
})
it('sem equipamento oferece caminho do cadastro e não permite confirmar publicação', async () => {
  render(
    tree(async () =>
      Response.json(onboardingChecklistFixture(['ACCOUNT_CREATED']))
    )
  )
  await screen.findByRole('link', { name: 'Cadastrar primeiro equipamento' })
  expect(
    screen.getByRole('link', { name: 'Personalizar site' }).getAttribute('href')
  ).toBe('/admin/configuracoes')
  expect(screen.queryByRole('button', { name: 'Publicar site' })).toBeNull()
})
it('publicação precisa confirmação; aceite recarrega fatos e não atualiza pagamentos', async () => {
  let published = false
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      published = true
      return Response.json({
        published: true,
        publishedAt: '2026-10-04T12:00:00.000Z',
      })
    }
    return Response.json(
      onboardingChecklistFixture(
        published
          ? [
              'ACCOUNT_CREATED',
              'FIRST_EQUIPMENT',
              'CUSTOMIZE_SITE',
              'PUBLISH_SITE',
            ]
          : undefined
      )
    )
  })
  render(tree(fetcher))
  fireEvent.click(await screen.findByRole('button', { name: 'Publicar site' }))
  const dialog = screen.getByRole('alertdialog')
  expect(
    within(dialog).getByText(/endereço do site não poderá ser alterado/)
  ).toBeTruthy()
  expect(fetcher).toHaveBeenCalledTimes(1)
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Confirmar publicação' })
  )
  await screen.findByRole('list', { name: 'Etapas de configuração' })
  await waitFor(() =>
    expect(
      screen.getByText('Publicar o site').closest('li')?.textContent
    ).toContain('Concluído')
  )
  expect(screen.queryByRole('button', { name: 'Publicar site' })).toBeNull()
  expect(
    fetcher.mock.calls.filter((call) => call[1]?.method === 'POST')
  ).toHaveLength(1)
  expect(fetcher.mock.calls).toHaveLength(3)
  expect(
    screen.getByText('Ativar pagamentos online').closest('li')?.textContent
  ).toContain('Pendente')
})
it('falha de leitura não inventa etapas e permite consulta explícita novamente', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ error: 'private-driver' }, { status: 503 })
    )
    .mockResolvedValue(Response.json(onboardingChecklistFixture()))
  render(tree(fetcher))
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).not.toContain('private-driver')
  expect(screen.queryByRole('button', { name: 'Publicar site' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await screen.findByRole('button', { name: 'Publicar site' })
})
it('troca de sessão/locadora retira imediatamente dados e confirmação pendentes', async () => {
  const fetcher = vi.fn(async (_path: string, _init?: RequestInit) =>
    Response.json(onboardingChecklistFixture())
  )
  const client = createHttpClient({ fetcher })
  const tenant = subscriptionTenant()
  function scope(id: string) {
    return (
      <ApiClientProvider client={client}>
        <FrontendSessionFixture userId={id} tenant={tenant}>
          <ChecklistPrimeirosPassos />
        </FrontendSessionFixture>
      </ApiClientProvider>
    )
  }
  const view = render(scope('ana'))
  fireEvent.click(await screen.findByRole('button', { name: 'Publicar site' }))
  expect(screen.getByRole('alertdialog')).toBeTruthy()
  await act(async () => view.rerender(scope('bruno')))
  expect(screen.queryByRole('alertdialog')).toBeNull()
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  expect(
    fetcher.mock.calls.every(
      (call) => call.length === 1 || call[1]?.method !== 'POST'
    )
  ).toBe(true)
})
