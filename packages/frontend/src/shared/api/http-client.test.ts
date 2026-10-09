import { describe, expect, it, vi } from 'vitest'
import {
  createHttpClient,
  HttpError,
  type HttpBinaryResponse,
} from './http-client'

describe('HTTP client de plataforma', () => {
  it('espera o texto completo e conserva a negativa não JSON e statusText', async () => {
    let finish!: (text: string) => void
    const text = new Promise<string>((resolve) => {
      finish = resolve
    })
    const client = createHttpClient({
      fetcher: async () =>
        ({
          ok: false,
          status: 502,
          statusText: 'Bad Gateway',
          text: () => text,
        }) as Response,
    })
    let returned = false
    const pending = client
      .request('/api/command', { responseType: 'text-response' })
      .then((value) => {
        returned = true
        return value
      })
    await Promise.resolve()
    expect(returned).toBe(false)
    finish('<html>failed</html>')
    expect(await pending).toEqual({
      text: '<html>failed</html>',
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
    })
  })
  it('conserva 202 e negativas no modo JSON com status, sem alterar o JSON padrão', async () => {
    const fetcher = vi
      .fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockImplementation(async () =>
        Response.json({ operationId: 'queued' }, { status: 202 })
      )
    const client = createHttpClient({ fetcher })
    await expect(
      client.request('/api/command', { responseType: 'json-response' })
    ).resolves.toEqual({
      data: { operationId: 'queued' },
      ok: true,
      status: 202,
    })
    expect(fetcher.mock.calls[0]![1]).not.toHaveProperty('responseType')
    fetcher.mockImplementation(async () =>
      Response.json({ error: 'Conciliar cobrança' }, { status: 409 })
    )
    await expect(
      client.request('/api/command', { responseType: 'json-response' })
    ).resolves.toEqual({
      data: { error: 'Conciliar cobrança' },
      ok: false,
      status: 409,
    })
    await expect(client.request('/api/command')).rejects.toEqual(
      new HttpError('Conciliar cobrança', 409)
    )
  })
  it('envia multipart intacto sem inventar Content-Type ou perder sessão/seleção', async () => {
    const body = new FormData()
    body.append(
      'file',
      new Blob(['private bytes'], { type: 'application/pdf' }),
      'proof.pdf'
    )
    const fetcher = vi
      .fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(Response.json({ document: { id: 'doc' } }))
    await createHttpClient({
      baseUrl: 'https://api.example.test',
      fetcher,
      getHeaders: () => ({ Cookie: 'local-only', 'x-tenant-id': 'alfa' }),
    }).request('/api/upload', { method: 'POST', multipart: body })
    const init = fetcher.mock.calls[0]![1]!
    expect(init.body).toBe(body)
    expect(init).not.toHaveProperty('multipart')
    expect(init.headers).toEqual({
      Accept: 'application/json',
      Cookie: 'local-only',
      'x-tenant-id': 'alfa',
    })
    expect(init.credentials).toBe('include')
  })
  it('usa o host injetado e envia cookies e cabeçalhos do comando', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })))
    const client = createHttpClient({
      baseUrl: 'https://api.example.test/',
      fetcher,
    })
    await expect(
      client.request('/api/settings', {
        method: 'PUT',
        body: '{}',
        headers: { 'Content-Type': 'application/json' },
      })
    ).resolves.toEqual({ ok: true })
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.test/api/settings',
      expect.objectContaining({
        credentials: 'include',
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
    )
  })
  it('injeta sessão native sem cookie automático do navegador', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })))
    const client = createHttpClient({
      fetcher,
      credentials: 'omit',
      getHeaders: async () => ({ Cookie: 'session=fixture' }),
    })
    await client.request('/api/resource')
    expect(fetcher).toHaveBeenCalledWith(
      '/api/resource',
      expect.objectContaining({
        credentials: 'omit',
        headers: { Accept: 'application/json', Cookie: 'session=fixture' },
      })
    )
  })
  it('preserva a negativa HTTP do servidor', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Acesso negado' }), {
        status: 403,
      })
    )
    await expect(
      createHttpClient({ fetcher }).request('/api/settings')
    ).rejects.toEqual(new HttpError('Acesso negado', 403))
  })
  it('não chama rede com host mobile ausente nem caminho externo', async () => {
    const fetcher = vi.fn<typeof fetch>()
    await expect(
      createHttpClient({ requireBaseUrl: true, fetcher }).request(
        '/api/settings'
      )
    ).rejects.toThrow('EXPO_PUBLIC_API_URL')
    await expect(
      createHttpClient({ fetcher }).request('//other.example.test/api')
    ).rejects.toThrow('caminho')
    expect(fetcher).not.toHaveBeenCalled()
  })
})

it('consome bytes binários com origem, cookie e seleção, sem enviar responseType ao fetch', async () => {
  const bytes = new Uint8Array([0, 255, 128, 10, 60, 62])
  const response = new Response(bytes, {
    headers: { 'Content-Type': 'application/pdf' },
  })
  Object.defineProperties(response, {
    url: { value: 'https://storage.example.test/signed.pdf' },
    redirected: { value: true },
  })
  const fetcher = vi
    .fn<(input: string, init?: RequestInit) => Promise<Response>>()
    .mockResolvedValue(response)
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
    getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
  })
  const result = await client.request<HttpBinaryResponse>(
    '/api/contracts/id/download',
    { responseType: 'binary' }
  )
  expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(bytes)
  expect(result).toMatchObject({
    ok: true,
    status: 200,
    redirected: true,
    url: 'https://storage.example.test/signed.pdf',
  })
  expect(fetcher).toHaveBeenCalledWith(
    'https://api.example.test/api/contracts/id/download',
    expect.objectContaining({
      credentials: 'include',
      headers: { Accept: '*/*', 'x-tenant-id': 'alfa' },
    })
  )
  expect(fetcher.mock.calls[0]![1]).not.toHaveProperty('responseType')
})

it('conserva status e corpo de uma negativa binária sem transformá-la em sucesso', async () => {
  const client = createHttpClient({
    fetcher: async () =>
      new Response('{"error":"Contrato não encontrado"}', { status: 404 }),
  })
  const result = await client.request<HttpBinaryResponse>(
    '/api/contracts/foreign/download',
    { responseType: 'binary' }
  )
  expect(result).toMatchObject({ ok: false, status: 404, redirected: false })
  expect(await result.blob.text()).toBe('{"error":"Contrato não encontrado"}')
})
