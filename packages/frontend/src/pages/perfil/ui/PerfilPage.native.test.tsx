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
import { type ReactNode } from 'react'
import { ApplicationSessionProvider } from '../../../entities/sessao'
import {
  PublicTenantProvider,
  TenantProvider,
} from '../../../entities/organizacao'
import {
  ApiClientProvider,
  HttpError,
  type HttpClient,
  type HttpRequest,
} from '../../../shared/api'
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
vi.mock('@gb-locacoes/ui', async () =>
  (await import('../../../../../../tests/helpers/native-screen')).nativeUi()
)
vi.mock('../../../shared/lib/toast', () => ({ toast: captured }))
function tree(
  child: ReactNode,
  client: HttpClient,
  slug = 'alfa',
  user = 'ana',
  role = 'CLIENT'
) {
  return (
    <ApiClientProvider client={client}>
      <TenantProvider value={null}>
        <PublicTenantProvider value={slug}>
          <ApplicationSessionProvider
            value={{
              data: {
                user: {
                  id: user,
                  name: user === 'ana' ? 'Ana' : 'Bia',
                  email: user + '@example.test',
                  role,
                },
              },
              status: 'authenticated',
              update: async () => null,
              signOut: async () => {},
            }}
          >
            {child}
          </ApplicationSessionProvider>
        </PublicTenantProvider>
      </TenantProvider>
    </ApiClientProvider>
  )
}
function transport(
  implementation: (path: string, options?: HttpRequest) => Promise<unknown>
) {
  const request = vi.fn(implementation)
  const client: HttpClient = {
    request: async <T,>(path: string, options?: HttpRequest) =>
      (await request(path, options)) as T,
  }
  return { request, client }
}
const value = (name: string) =>
  (screen.getByLabelText(name) as HTMLInputElement).value
const change = (name: string, v: string) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value: v } })
beforeEach(() => {
  captured.classes.length = 0
  captured.success.mockReset()
  captured.error.mockReset()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('fetch relativo proibido')
    })
  )
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

import { PerfilPage } from './PerfilPage.native'
function profileApi() {
  let profile = { phone: '51999999999', cpf: '52998224725', company: 'Alfa' }
  return transport(async (_path, options) => {
    if (options?.method === 'PUT')
      profile = { ...profile, ...JSON.parse(options.body!) }
    return { user: profile, success: true }
  })
}
const ready = () => waitFor(() => expect(value('Empresa')).toBe('Alfa'))
it('edita o perfil nativo com as mesmas máscaras e PUT comercial parcial', async () => {
  const { client, request } = profileApi()
  render(tree(<PerfilPage />, client))
  await ready()
  expect(value('Telefone')).toBe('(51) 99999-9999')
  expect(value('CPF')).toBe('529.982.247-25')
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  change('Nome Completo', 'Não gravável')
  change('Empresa', ' Nova ')
  fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }))
  await waitFor(() =>
    expect(captured.success).toHaveBeenCalledWith(
      'Perfil atualizado com sucesso!'
    )
  )
  const body = JSON.parse(
    request.mock.calls.find(([, o]) => o?.method === 'PUT')![1]!.body!
  )
  expect(body).toEqual({
    phone: '(51) 99999-9999',
    cpf: '529.982.247-25',
    company: 'Nova',
  })
  await waitFor(() => expect(value('Empresa')).toBe('Nova'))
  expect(captured.classes).toEqual([])
  expect(
    (screen.getByRole('button', { name: 'Alterar' }) as HTMLButtonElement)
      .disabled
  ).toBe(true)
})
it('cancelar restaura sem escrita; recusa do PUT mantém rascunho para tentar novamente', async () => {
  const { client, request } = profileApi(),
    original = request.getMockImplementation()!
  let fail = true
  request.mockImplementation((p, o) =>
    o?.method === 'PUT' && fail
      ? Promise.reject(new HttpError('Duplicado', 409))
      : original(p, o)
  )
  render(tree(<PerfilPage />, client))
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  change('Empresa', 'Rascunho')
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  await ready()
  expect(request.mock.calls.some(([, o]) => o?.method === 'PUT')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  change('Empresa', 'Tentativa')
  fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }))
  await waitFor(() =>
    expect(captured.error).toHaveBeenCalledWith('Erro ao atualizar perfil')
  )
  expect(value('Empresa')).toBe('Tentativa')
  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }))
  await waitFor(() => expect(captured.success).toHaveBeenCalled())
})
it.each(['locadora', 'usuário', 'transporte'])(
  'resposta do perfil anterior não vaza após trocar %s',
  async (kind) => {
    let resolve!: (v: unknown) => void
    const old = transport(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    const current = transport(async () => ({ user: { company: 'Atual' } }))
    const view = render(tree(<PerfilPage />, old.client))
    const nextClient = kind === 'transporte' ? current.client : old.client
    if (kind !== 'transporte')
      old.request.mockImplementation(async () => ({
        user: { company: 'Atual' },
      }))
    view.rerender(
      tree(
        <PerfilPage />,
        nextClient,
        kind === 'locadora' ? 'bravo' : 'alfa',
        kind === 'usuário' ? 'bia' : 'ana'
      )
    )
    await waitFor(() => expect(value('Empresa')).toBe('Atual'))
    await act(async () => resolve({ user: { company: 'Privado Alfa' } }))
    expect(value('Empresa')).toBe('Atual')
    expect(captured.success).not.toHaveBeenCalled()
  }
)
