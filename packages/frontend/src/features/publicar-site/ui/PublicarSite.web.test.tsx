// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { onboardingChecklistFixture } from '../../../../../../tests/helpers/onboarding-checklist'
import { PublicarSite } from './PublicarSite.web'
afterEach(cleanup)
function tree(
  fetcher: (path: string, init?: RequestInit) => Promise<Response>
) {
  return (
    <ApiClientProvider client={createHttpClient({ fetcher })}>
      <PublicarSite
        scope="alfa"
        checklist={onboardingChecklistFixture()}
        tenantName="Locadora sintética"
        onPublished={() => {}}
      />
    </ApiClientProvider>
  )
}
it('Voltar fecha e devolve foco sem executar POST', async () => {
  const fetcher = vi.fn(async () => Response.json({}))
  render(tree(fetcher))
  const trigger = screen.getByRole('button', { name: 'Publicar site' })
  fireEvent.click(trigger)
  fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  expect(document.activeElement).toBe(trigger)
  expect(fetcher).not.toHaveBeenCalled()
})
it('rede incerta conserva confirmação e só repete após ação humana', async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error('private-offline'))
    .mockResolvedValue(
      Response.json({
        published: true,
        publishedAt: '2026-10-04T12:00:00.000Z',
      })
    )
  render(tree(fetcher))
  fireEvent.click(screen.getByRole('button', { name: 'Publicar site' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar publicação' }))
  await screen.findByRole('button', { name: 'Tentar o mesmo pedido' })
  expect(screen.getByRole('alert').textContent).not.toContain('private-offline')
  expect(fetcher).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Publicar site' }))
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Tentar o mesmo pedido',
    })
  )
  await screen.findByText(
    'Publicação confirmada. Atualizando os primeiros passos...'
  )
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it.each([
  [403, 'EMAIL_NOT_VERIFIED', 'Verifique seu e-mail'],
  [403, 'OWNER_REQUIRED', 'Somente o dono atual'],
  [402, 'SUBSCRIPTION_RESTRICTED', 'Confira a assinatura'],
  [409, 'FIRST_EQUIPMENT_REQUIRED', 'Cadastre o primeiro equipamento'],
])('recusa %s não vira publicação local', async (status, code, message) => {
  render(tree(async () => Response.json({ code }, { status: Number(status) })))
  fireEvent.click(screen.getByRole('button', { name: 'Publicar site' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar publicação' }))
  expect((await screen.findByRole('alert')).textContent).toContain(message)
  expect(screen.queryByText(/Publicação confirmada/)).toBeNull()
})
