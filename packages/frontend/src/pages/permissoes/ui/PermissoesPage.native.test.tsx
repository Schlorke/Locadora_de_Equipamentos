// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AdminPermissionsPage } from './PermissoesPage.native'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import { operationsTenant } from '../../../../../../tests/helpers/operation-fixtures'
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
  ...(await import('../../../../../ui/src/native/Checkbox.native')),
}))
vi.mock(
  '../../../widgets/cabecalho-admin',
  async () =>
    await import('../../../widgets/cabecalho-admin/ui/Cabecalho.native')
)
vi.mock('../../../shared/lib/toast', () => ({ toast: captured }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  captured.classes.length = 0
})
function setup(deny = false) {
  const permissions = [
    { id: 'p1', role: 'OPERATOR', module: 'EQUIPMENTS', action: 'READ' },
    { id: 'p2', role: 'FINANCIAL', module: 'FINANCIAL', action: 'READ' },
  ]
  const fetcher = vi.fn(async (_: string, init?: RequestInit) =>
    Response.json(init?.method === 'PUT' ? {} : { permissions }, {
      status: deny && init?.method === 'PUT' ? 403 : 200,
    })
  )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  const node = (id = 'alfa') => (
    <FrontendSessionFixture tenant={operationsTenant(id)}>
      <ApiClientProvider client={client}>
        <AdminPermissionsPage />
      </ApiClientProvider>
    </FrontendSessionFixture>
  )
  const view = render(node())
  return { fetcher, view, node }
}
it('mantém ADMIN bloqueado e salva somente o perfil escolhido, com 45 escolhas reais', async () => {
  const { fetcher } = setup()
  await screen.findByRole('heading', { name: 'Gerenciar Permissões' })
  expect(screen.getAllByRole('checkbox')).toHaveLength(45)
  expect(
    screen
      .getAllByRole('checkbox')
      .every((e) => (e as HTMLButtonElement).disabled)
  ).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: /Operador/ }))
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Equipamentos: Criar/Editar' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Salvar Permissões' }))
  await waitFor(() =>
    expect(captured.success).toHaveBeenCalledWith(
      'Permissões salvas com sucesso'
    )
  )
  const call = fetcher.mock.calls.find(([, init]) => init?.method === 'PUT')!,
    body = JSON.parse(String(call[1]?.body))
  expect(call[0]).toBe('https://api.example.test/api/admin/permissions')
  expect(body.permissions).toHaveLength(2)
  expect(
    body.permissions.every((p: { role: string }) => p.role === 'OPERATOR')
  ).toBe(true)
  expect(
    body.permissions.some((p: { action: string }) => p.action === 'WRITE')
  ).toBe(true)
  expect(captured.classes).toEqual([])
})
it('negações não viram sucesso e novo contexto reinicia o perfil sem continuar o anterior', async () => {
  const { view, node } = setup(true)
  await screen.findByRole('heading', { name: 'Gerenciar Permissões' })
  fireEvent.click(screen.getByRole('button', { name: /Operador/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Salvar Permissões' }))
  await waitFor(() =>
    expect(captured.error).toHaveBeenCalledWith('Erro ao salvar permissões')
  )
  expect(captured.success).not.toHaveBeenCalled()
  view.rerender(node('bravo'))
  await screen.findByRole('heading', { name: 'Gerenciar Permissões' })
  await waitFor(() =>
    expect(
      screen
        .getAllByRole('checkbox')
        .every((e) => (e as HTMLButtonElement).disabled)
    ).toBe(true)
  )
})
