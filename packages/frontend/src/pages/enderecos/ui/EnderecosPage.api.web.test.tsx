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
import type { CustomerAddress } from '../../../entities/cliente'
import { EnderecosPage } from './EnderecosPage.web'

const state = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  cep: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: state }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/area-cliente/enderecos',
}))
vi.mock('../../../shared/lib/cep', () => ({ fetchAddressByCEP: state.cep }))
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
            <EnderecosPage />
          </TenantProvider>
        </PublicTenantProvider>
      </ApiClientProvider>
    </ApplicationSessionProvider>
  )
}
const address = (id: string, street: string): CustomerAddress => ({
  id,
  street,
  number: '1',
  complement: null,
  neighborhood: 'Centro',
  city: 'Porto Alegre',
  state: 'RS',
  zipCode: '90000000',
  isPrimary: false,
})
function api() {
  let rows: CustomerAddress[] = []
  const request = vi.fn(async (path: string, options?: HttpRequest) => {
    const body = options?.body ? JSON.parse(options.body) : {}
    if (!options?.method) return { addresses: [...rows] }
    if (options.method === 'POST') {
      const row = { id: 'id' + (rows.length + 1), ...body } as CustomerAddress
      rows.push(row)
      return { address: row }
    }
    const id = decodeURIComponent(path.split('/').pop()!)
    if (options.method === 'PATCH') {
      rows = rows.map((row) =>
        row.id === id
          ? { ...row, ...body }
          : body.isPrimary
            ? { ...row, isPrimary: false }
            : row
      )
      return { address: rows.find((row) => row.id === id) }
    }
    rows = rows.filter((row) => row.id !== id)
    return { message: 'Endereço removido com sucesso' }
  })
  return { request, client: { request } as HttpClient }
}
async function add(street: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Novo Endereço' }))
  for (const [label, value] of [
    ['Rua', street],
    ['Número', '1'],
    ['Bairro', 'Centro'],
    ['Cidade', 'Porto Alegre'],
    ['Estado', 'RS'],
    ['CEP', '90000000'],
  ])
    fireEvent.change(screen.getByLabelText(label!), { target: { value } })
}
const submit = () =>
  fireEvent.submit(screen.getByLabelText('Rua').closest('form')!)
beforeEach(() => {
  session = { user: { id: 'ana', name: 'Ana', email: 'ana@example.test' } }
  state.success.mockReset()
  state.error.mockReset()
  state.cep.mockReset().mockResolvedValue(null)
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('fetch relativo proibido')
    })
  )
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('cria, edita, define principal e exclui pelo cliente configurado, conservando os corpos', async () => {
  const { client, request } = api()
  render(tree(client))
  await screen.findByText('Nenhum endereço cadastrado')
  await add('Rua A')
  submit()
  await screen.findAllByText('Rua A, 1')
  expect(
    JSON.parse(
      request.mock.calls.find(([, options]) => options?.method === 'POST')![1]!
        .body!
    )
  ).toEqual({
    street: 'Rua A',
    number: '1',
    complement: null,
    neighborhood: 'Centro',
    city: 'Porto Alegre',
    state: 'RS',
    zipCode: '90000000',
    isPrimary: true,
  })
  await add('Rua B')
  submit()
  await screen.findAllByText('Rua B, 1')
  fireEvent.click(screen.getByRole('button', { name: 'Principal' }))
  await waitFor(() =>
    expect(state.success).toHaveBeenCalledWith(
      'Endereço definido como principal!'
    )
  )
  await screen.findAllByText('Rua B, 1')
  fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]!)
  fireEvent.change(screen.getByLabelText('Número'), { target: { value: '42' } })
  submit()
  await waitFor(() =>
    expect(state.success).toHaveBeenCalledWith(
      'Endereço atualizado com sucesso!'
    )
  )
  await screen.findAllByText(/Rua [AB], 42/)
  fireEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[0]!)
  await waitFor(() =>
    expect(state.success).toHaveBeenCalledWith('Endereço removido com sucesso!')
  )
  expect(
    request.mock.calls.filter(([, options]) => options?.method === 'POST')
  ).toHaveLength(2)
  expect(
    request.mock.calls.some(([, options]) => options?.method === 'DELETE')
  ).toBe(true)
  expect(
    request.mock.calls.some(
      ([, options]) =>
        options?.method === 'PATCH' &&
        JSON.parse(options.body!).isPrimary === true
    )
  ).toBe(true)
})
it('falha de salvamento mantém o rascunho e só atualiza lista após confirmação', async () => {
  const { client, request } = api(),
    original = request.getMockImplementation()!
  let fail = true
  request.mockImplementation((path, options) =>
    options?.method === 'POST' && fail
      ? Promise.reject(new HttpError('Dados inválidos', 400))
      : original(path, options)
  )
  render(tree(client))
  await screen.findByText('Nenhum endereço cadastrado')
  await add('Rascunho')
  submit()
  await waitFor(() =>
    expect(state.error).toHaveBeenCalledWith('Dados inválidos')
  )
  expect((screen.getByLabelText('Rua') as HTMLInputElement).value).toBe(
    'Rascunho'
  )
  expect(state.success).not.toHaveBeenCalled()
  expect(
    request.mock.calls.filter(([, options]) => !options?.method)
  ).toHaveLength(1)
  fail = false
  submit()
  await screen.findAllByText('Rascunho, 1')
})
it.each(['locadora', 'usuário'])(
  'leitura antiga após troca de %s não exibe endereço privado anterior',
  async (change) => {
    let resolve!: (value: unknown) => void
    const request = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done
          })
      )
      .mockResolvedValue({ addresses: [address('novo', 'Atual')] })
    const client = { request } as HttpClient
    const view = render(tree(client))
    if (change === 'usuário')
      session = { user: { id: 'bia', name: 'Bia', email: 'bia@example.test' } }
    view.rerender(tree(client, change === 'locadora' ? 'bravo' : 'alfa'))
    await screen.findByText('Atual, 1')
    await act(async () =>
      resolve({ addresses: [address('antigo', 'Privado Alfa')] })
    )
    expect(screen.queryByText('Privado Alfa, 1')).toBeNull()
  }
)
it.each(['locadora', 'usuário'])(
  'POST antigo após troca de %s não inicia releitura nem notifica sucesso na nova tela',
  async (change) => {
    let resolve!: (value: unknown) => void
    const request = vi.fn((path: string, options?: HttpRequest) =>
      options?.method === 'POST'
        ? new Promise((done) => {
            resolve = done
          })
        : Promise.resolve({ addresses: [] })
    )
    const client = { request } as HttpClient
    const view = render(tree(client))
    await screen.findByText('Nenhum endereço cadastrado')
    await add('Antigo')
    submit()
    if (change === 'usuário')
      session = { user: { id: 'bia', name: 'Bia', email: 'bia@example.test' } }
    view.rerender(tree(client, change === 'locadora' ? 'bravo' : 'alfa'))
    await screen.findByText('Nenhum endereço cadastrado')
    await act(async () => resolve({ address: address('antigo', 'Antigo') }))
    expect(state.success).not.toHaveBeenCalled()
    expect(
      request.mock.calls.filter(([, options]) => !options?.method)
    ).toHaveLength(2)
    expect(screen.queryByLabelText('Rua')).toBeNull()
  }
)
it('CEP busca somente com oito dígitos e cancelar descarta edição sem gravar', async () => {
  const { client, request } = api()
  render(tree(client))
  await screen.findByText('Nenhum endereço cadastrado')
  fireEvent.click(screen.getByRole('button', { name: 'Novo Endereço' }))
  fireEvent.change(screen.getByLabelText('CEP'), {
    target: { value: '9000000' },
  })
  expect(state.cep).not.toHaveBeenCalled()
  state.cep.mockResolvedValue({
    logradouro: 'Rua CEP',
    bairro: 'Centro',
    localidade: 'Porto Alegre',
    uf: 'RS',
    complemento: 'Sala',
  })
  fireEvent.change(screen.getByLabelText('CEP'), {
    target: { value: '90000000' },
  })
  await waitFor(() =>
    expect((screen.getByLabelText('Rua') as HTMLInputElement).value).toBe(
      'Rua CEP'
    )
  )
  expect(state.cep).toHaveBeenCalledWith('90000-000')
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.queryByLabelText('Rua')).toBeNull()
  expect(request.mock.calls.some(([, options]) => !!options?.method)).toBe(
    false
  )
})
