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

const cep = vi.hoisted(() => vi.fn())
vi.mock('../../../shared/lib/cep', () => ({ fetchAddressByCEP: cep }))
import { EnderecosPage } from './EnderecosPage.native'
const address = {
  id: 'a/1',
  street: 'Rua A',
  number: '1',
  complement: '',
  neighborhood: 'Centro',
  city: 'Porto Alegre',
  state: 'RS',
  zipCode: '90000000',
  isPrimary: true,
}
function addressesApi() {
  let rows: (typeof address)[] = []
  return transport(async (path, options) => {
    if (options?.method === 'POST') {
      rows = [{ ...address, ...JSON.parse(options.body!) }]
      return { address: rows[0] }
    }
    if (options?.method === 'PATCH') {
      rows = rows.map((a) => ({ ...a, ...JSON.parse(options.body!) }))
      return { address: rows[0] }
    }
    if (options?.method === 'DELETE') {
      rows = []
      return { success: true }
    }
    expect(path).toBe('/api/addresses')
    return { addresses: rows }
  })
}
const ready = () => screen.findByText('Nenhum endereço cadastrado')
function complete() {
  change('Rua', 'Rua A')
  change('Número', '1')
  change('Bairro', 'Centro')
  change('Cidade', 'Porto Alegre')
  change('Estado', 'RS')
  change('CEP', '90000000')
}
beforeEach(() => {
  cep.mockReset()
  cep.mockResolvedValue(null)
})
it('CRUD nativo envia DTO e primeiro principal, repassa id codificado e relê', async () => {
  const { client, request } = addressesApi()
  render(tree(<EnderecosPage />, client))
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Novo Endereço' }))
  expect(
    (
      screen.getByRole('button', {
        name: 'Adicionar Endereço',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true)
  complete()
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar Endereço' }))
  await waitFor(() =>
    expect(captured.success).toHaveBeenCalledWith(
      'Endereço adicionado com sucesso!'
    )
  )
  const body = JSON.parse(
    request.mock.calls.find(([, o]) => o?.method === 'POST')![1]!.body!
  )
  const { id: _id, ...input } = address
  expect(body).toEqual({ ...input, complement: null })
  fireEvent.click(screen.getByRole('button', { name: 'Editar Rua A' }))
  change('Número', '2')
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar Endereço' }))
  await waitFor(() =>
    expect(captured.success).toHaveBeenCalledWith(
      'Endereço atualizado com sucesso!'
    )
  )
  expect(request.mock.calls.find(([, o]) => o?.method === 'PATCH')![0]).toBe(
    '/api/addresses/a%2F1'
  )
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Rua A' }))
  await waitFor(() =>
    expect(captured.success).toHaveBeenCalledWith(
      'Endereço removido com sucesso!'
    )
  )
  await ready()
  expect(captured.classes).toEqual([])
})
it('falha ao salvar conserva campos e cancelar não escreve', async () => {
  const api = addressesApi(),
    original = api.request.getMockImplementation()!
  api.request.mockImplementation((p, o) =>
    o?.method === 'POST'
      ? Promise.reject(new HttpError('Erro ao salvar endereço', 500))
      : original(p, o)
  )
  render(tree(<EnderecosPage />, api.client))
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Novo Endereço' }))
  complete()
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar Endereço' }))
  await waitFor(() =>
    expect(captured.error).toHaveBeenCalledWith('Erro ao salvar endereço')
  )
  expect(value('Rua')).toBe('Rua A')
  const writes = api.request.mock.calls.filter(
    ([, o]) => o?.method === 'POST'
  ).length
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(
    api.request.mock.calls.filter(([, o]) => o?.method === 'POST')
  ).toHaveLength(writes)
})
it.each(['novo CEP', 'cancelar', 'locadora'])(
  'CEP tardio não modifica formulário depois de %s',
  async (kind) => {
    const api = addressesApi()
    let resolve!: (v: unknown) => void
    cep
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done
          })
      )
      .mockResolvedValue({
        logradouro: 'Rua atual',
        localidade: 'Cidade',
        uf: 'RS',
      })
    const view = render(tree(<EnderecosPage />, api.client))
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Novo Endereço' }))
    change('CEP', '9000000')
    expect(cep).not.toHaveBeenCalled()
    change('CEP', '90000000')
    await waitFor(() => expect(cep).toHaveBeenCalledTimes(1))
    if (kind === 'novo CEP') {
      change('CEP', '91000000')
      await waitFor(() => expect(value('Rua')).toBe('Rua atual'))
    } else if (kind === 'cancelar') {
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
      fireEvent.click(screen.getByRole('button', { name: 'Novo Endereço' }))
    } else {
      view.rerender(tree(<EnderecosPage />, api.client, 'bravo'))
      await ready()
      fireEvent.click(screen.getByRole('button', { name: 'Novo Endereço' }))
    }
    await act(async () =>
      resolve({
        logradouro: 'Rua antiga',
        localidade: 'Cidade antiga',
        uf: 'SP',
      })
    )
    expect(value('Rua')).toBe(kind === 'novo CEP' ? 'Rua atual' : '')
    expect(value('CEP')).toBe(kind === 'novo CEP' ? '91000-000' : '')
  }
)
