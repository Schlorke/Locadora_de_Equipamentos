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
  ApiClientProvider,
  HttpError,
  type HttpClient,
  type HttpRequest,
} from '../../../shared/api'
import {
  ApplicationSessionProvider,
  type ApplicationSession,
} from '../../../entities/sessao'
import {
  PublicTenantProvider,
  TenantProvider,
} from '../../../entities/organizacao'
import { PerfilPage } from './PerfilPage.web'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
let session: ApplicationSession
function tree(client: HttpClient, slug = 'alfa') {
  return (
    <ApplicationSessionProvider
      value={{
        data: session,
        status: session ? 'authenticated' : 'unauthenticated',
        update: vi.fn(),
        signOut: vi.fn(),
      }}
    >
      <ApiClientProvider client={client}>
        <PublicTenantProvider value={slug}>
          <TenantProvider value={null}>
            <PerfilPage />
          </TenantProvider>
        </PublicTenantProvider>
      </ApiClientProvider>
    </ApplicationSessionProvider>
  )
}
function api() {
  let profile = { phone: '51999999999', cpf: '52998224725', company: 'Alfa' }
  const request = vi.fn(
    async (_path: string, options?: HttpRequest): Promise<unknown> => {
      if (options?.method === 'PUT')
        profile = { ...profile, ...JSON.parse(options.body!) }
      return { user: profile, success: true }
    }
  )
  return { request, client: { request } as HttpClient }
}
const value = (name: string) =>
  (screen.getByLabelText(name) as HTMLInputElement).value
async function ready() {
  await waitFor(() => expect(value('Empresa')).toBe('Alfa'))
}
beforeEach(() => {
  session = { user: { id: 'ana', name: 'Ana', email: 'ana@example.test' } }
  toast.success.mockReset()
  toast.error.mockReset()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('fetch relativo proibido')
    })
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('formata perfil e conserva PUT parcial sem nome/email, seguido de releitura', async () => {
  const { client, request } = api()
  render(tree(client))
  await ready()
  expect(value('Telefone')).toBe('(51) 99999-9999')
  expect(value('CPF')).toBe('529.982.247-25')
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  fireEvent.change(screen.getByLabelText('Nome Completo'), {
    target: { value: 'Não gravável' },
  })
  fireEvent.change(screen.getByLabelText('Empresa'), {
    target: { value: ' Nova empresa ' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }))
  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith('Perfil atualizado com sucesso!')
  )
  const body = JSON.parse(
    request.mock.calls.find(([, options]) => options?.method === 'PUT')![1]!
      .body!
  )
  expect(body).toEqual({
    phone: '(51) 99999-9999',
    cpf: '529.982.247-25',
    company: 'Nova empresa',
  })
  await waitFor(() => expect(value('Empresa')).toBe('Nova empresa'))
  expect(
    request.mock.calls.filter(([, options]) => !options?.method)
  ).toHaveLength(2)
  expect(screen.getByText('Alterar Senha')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Alterar' })).toBeTruthy()
  expect(screen.getAllByRole('status')).toHaveLength(3)
})
it('falha do PUT conserva edição e permite nova tentativa', async () => {
  const { client, request } = api(),
    original = request.getMockImplementation()!
  let fail = true
  request.mockImplementation((path, options) =>
    options?.method === 'PUT' && fail
      ? Promise.reject(new HttpError('Duplicado', 409))
      : original(path, options)
  )
  render(tree(client))
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  fireEvent.change(screen.getByLabelText('Empresa'), {
    target: { value: 'Tentativa' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }))
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('Erro ao atualizar perfil')
  )
  expect(value('Empresa')).toBe('Tentativa')
  expect(toast.success).not.toHaveBeenCalled()
  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }))
  await waitFor(() => expect(toast.success).toHaveBeenCalled())
})
it('cancelar restaura dados do servidor sem enviar PUT', async () => {
  const { client, request } = api()
  render(tree(client))
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  fireEvent.change(screen.getByLabelText('Empresa'), {
    target: { value: 'Rascunho' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  await ready()
  expect(
    request.mock.calls.some(([, options]) => options?.method === 'PUT')
  ).toBe(false)
  expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy()
})
it.each(['locadora', 'usuário'])(
  'PUT antigo após troca de %s não mostra sucesso nem inicia releitura',
  async (change) => {
    const { client, request } = api(),
      original = request.getMockImplementation()!
    let resolve!: (value: unknown) => void
    let current = false
    request.mockImplementation((path, options) =>
      options?.method === 'PUT'
        ? new Promise((done) => {
            resolve = done
          })
        : current
          ? Promise.resolve({ user: { company: 'Atual' } })
          : original(path, options)
    )
    const view = render(tree(client))
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }))
    await waitFor(() => expect(resolve).toBeTypeOf('function'))
    current = true
    if (change === 'usuário')
      session = { user: { id: 'bia', name: 'Bia', email: 'bia@example.test' } }
    view.rerender(tree(client, change === 'locadora' ? 'bravo' : 'alfa'))
    await waitFor(() => expect(value('Empresa')).toBe('Atual'))
    await act(async () =>
      resolve({ success: true, user: { company: 'Antigo' } })
    )
    expect(value('Empresa')).toBe('Atual')
    expect(value('Nome Completo')).toBe(change === 'usuário' ? 'Bia' : 'Ana')
    expect(toast.success).not.toHaveBeenCalled()
    expect(
      request.mock.calls.filter(([, options]) => !options?.method)
    ).toHaveLength(2)
  }
)
it('leitura antiga não preenche perfil após trocar locadora', async () => {
  let resolve!: (value: unknown) => void
  const request = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    .mockResolvedValue({ user: { company: 'Atual' } })
  const client = { request } as HttpClient
  const view = render(tree(client))
  view.rerender(tree(client, 'bravo'))
  await waitFor(() => expect(value('Empresa')).toBe('Atual'))
  await act(async () => resolve({ user: { company: 'Privado Alfa' } }))
  expect(value('Empresa')).toBe('Atual')
})
