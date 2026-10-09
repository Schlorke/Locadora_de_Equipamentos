import { describe, expect, it, vi } from 'vitest'
import {
  createHttpClient,
  HttpError,
  type HttpClient,
  type HttpRequest,
} from '../../../shared/api'
import { buildQuoteRequestBody } from '../../../entities/orcamento'
import { createQuoteApi } from './quote-api'

const form = {
  name: 'Ana',
  email: 'ana@example.test',
  phone: '51999999999',
  cpf: '',
  cnpj: '',
  company: '',
  cep: '',
  message: '',
  deliveryType: 'PICKUP' as const,
}
const items = [
  {
    equipmentId: 'eq',
    days: 7,
    quantity: 2,
    includeWeekends: true,
    startDate: new Date('2033-03-01T00:00:00Z'),
    endDate: new Date('2033-03-07T00:00:00Z'),
  },
]

describe('transporte do orçamento', () => {
  it('preserva o payload do domínio e acrescenta a locadora explícita', async () => {
    const request = vi.fn(async (_path: string, _options?: HttpRequest) => ({
      id: 'quote',
    }))
    const api = createQuoteApi({ request } as HttpClient, 'locadora-a')
    await expect(api.submit(form, items)).resolves.toEqual({ id: 'quote' })
    expect(request).toHaveBeenCalledWith('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...buildQuoteRequestBody(form, items),
        tenantSlug: 'locadora-a',
      }),
    })
  })
  it('usa o host configurado para catálogo, disponibilidade, perfil e endereços', async () => {
    const fetcher = vi.fn(
      async (_input: string, _init?: RequestInit) => new Response('{}')
    )
    const api = createQuoteApi(
      createHttpClient({
        baseUrl: 'https://api.example.test',
        fetcher,
        getHeaders: () => ({ 'x-tenant-id': 'tenant-a' }),
      }),
      'locadora-a'
    )
    await api.equipments()
    await api.availability(
      'eq/1',
      '2033-03-01T00:00:00Z',
      '2033-03-07T00:00:00Z'
    )
    await api.profile()
    await api.addresses()
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/api/equipments?tenantSlug=locadora-a',
      'https://api.example.test/api/equipments/eq%2F1/availability?startDate=2033-03-01T00%3A00%3A00Z&endDate=2033-03-07T00%3A00%3A00Z&tenantSlug=locadora-a',
      'https://api.example.test/api/user/profile',
      'https://api.example.test/api/addresses',
    ])
    for (const [, options] of fetcher.mock.calls)
      expect(options).toMatchObject({
        credentials: 'include',
        headers: { 'x-tenant-id': 'tenant-a' },
      })
  })
  it('preserva as escritas privadas e o alias /orcamentos', async () => {
    const request = vi.fn(async (_path: string, _options?: HttpRequest) => ({}))
    const api = createQuoteApi({ request } as HttpClient, 'locadora-a')
    const address = {
      street: 'Rua A',
      number: '1',
      complement: null,
      neighborhood: 'Centro',
      city: 'Porto Alegre',
      state: 'RS',
      zipCode: '90000000',
      isPrimary: true,
    }
    await api.saveAddress(address)
    await api.saveProfile({ phone: '51999999999', company: 'Empresa' })
    await api.submitLegacy({ urgency: 'high', items: [], cpf: null })
    expect(
      request.mock.calls.map(([path, options]) => [
        path,
        options?.method,
        JSON.parse(options!.body!),
      ])
    ).toEqual([
      ['/api/addresses', 'POST', address],
      [
        '/api/user/profile',
        'PUT',
        { phone: '51999999999', company: 'Empresa' },
      ],
      [
        '/api/orcamentos',
        'POST',
        { urgency: 'high', items: [], cpf: null, tenantSlug: 'locadora-a' },
      ],
    ])
  })
  it('falha sem locadora antes de fazer qualquer chamada', async () => {
    const request = vi.fn()
    const api = createQuoteApi({ request } as HttpClient, null)
    for (const call of [
      () => api.equipments(),
      () => api.profile(),
      () => api.addresses(),
      () => api.saveProfile({}),
      () => api.submit(form, items),
      () => api.submitLegacy({}),
    ])
      expect(call).toThrow('Selecione uma locadora')
    expect(request).not.toHaveBeenCalled()
  })
  it('propaga erros HTTP e falhas de rede sem fingir sucesso', async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new HttpError('Conflito de locadora', 400))
    const api = createQuoteApi({ request } as HttpClient, 'locadora-a')
    await expect(api.submit(form, items)).rejects.toMatchObject({
      status: 400,
      message: 'Conflito de locadora',
    })
    request.mockRejectedValue(new Error('offline'))
    await expect(api.saveProfile({ phone: '51999999999' })).rejects.toThrow(
      'offline'
    )
  })

  it('site da locadora em pausa (S13): envio e catálogo rejeitam com a mensagem neutra do 503', async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        {
          error: 'Este site está temporariamente indisponível.',
          code: 'SITE_PAUSED',
        },
        { status: 503, headers: { 'Retry-After': '3600' } }
      )
    )
    const api = createQuoteApi(
      createHttpClient({ baseUrl: 'https://app.plataforma.example', fetcher }),
      'locadora-a'
    )
    for (const call of [() => api.submit(form, items), () => api.equipments()])
      await expect(call()).rejects.toMatchObject({
        status: 503,
        message: 'Este site está temporariamente indisponível.',
      })
  })
})
