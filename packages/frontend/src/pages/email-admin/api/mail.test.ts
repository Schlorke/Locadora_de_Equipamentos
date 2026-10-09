import { expect, it, vi } from 'vitest'
import { createHttpClient } from '../../../shared/api'
import { createMailApi } from './mail'

it('conserva status e parsing do leitor, sem esconder JSON inválido', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({ error: 'Recusado' }, { status: 403 })
    )
    .mockResolvedValueOnce(new Response('<html>erro</html>'))
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
    getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
  })
  const api = createMailApi({ ...client, isCurrent: () => true })
  const refused = await api.request('/api/admin/zoho-mail/accounts')
  expect(refused.status).toBe(403)
  expect(refused.ok).toBe(false)
  expect(await refused.json()).toEqual({ error: 'Recusado' })
  const invalid = await api.request('/api/admin/zoho-mail/accounts')
  await expect(invalid.json()).rejects.toBeInstanceOf(SyntaxError)
  expect(fetcher.mock.calls[0]).toEqual([
    'https://api.example.test/api/admin/zoho-mail/accounts',
    expect.objectContaining({
      credentials: 'include',
      headers: expect.objectContaining({ 'x-tenant-id': 'alfa' }),
    }),
  ])
})
it('envia multipart sem Content-Type forçado e mantém idempotência do envio', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => Response.json({}))
  const api = createMailApi({
    ...createHttpClient({ baseUrl: 'https://api.example.test', fetcher }),
    isCurrent: () => true,
  })
  const body = new FormData()
  body.append('files', new Blob(['pdf']), 'arquivo.pdf')
  await api.request('/api/admin/zoho-mail/attachments/upload', {
    method: 'POST',
    body,
  })
  expect(fetcher.mock.calls[0]?.[1]?.body).toBe(body)
  expect(fetcher.mock.calls[0]?.[1]?.headers).not.toHaveProperty('Content-Type')
  await api.request('/api/admin/zoho-mail/messages/send', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': 'key', 'Content-Type': 'application/json' },
    body: '{"mailFormat":"html"}',
  })
  expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
    method: 'POST',
    body: '{"mailFormat":"html"}',
    headers: { 'X-Idempotency-Key': 'key' },
  })
})
it('preserva bytes do download e descarta leitura tardia no escopo encerrado', async () => {
  let active = true
  const api = createMailApi({
    ...createHttpClient({
      fetcher: async () => new Response(new Uint8Array([0, 255, 42])),
    }),
    isCurrent: () => active,
  })
  const res = await api.download(
    '/api/admin/zoho-mail/messages/m/attachments/a'
  )
  expect(res.ok).toBe(true)
  expect(new Uint8Array(await (await res.blob()).arrayBuffer())).toEqual(
    new Uint8Array([0, 255, 42])
  )
  active = false
  await expect(res.blob()).rejects.toMatchObject({ name: 'AbortError' })
  await expect(
    api.request('/api/admin/zoho-mail/accounts')
  ).rejects.toMatchObject({ name: 'AbortError' })
})
it('não aceita outro host nem uma rota fora do correio', async () => {
  const request = vi.fn()
  const api = createMailApi({ request, isCurrent: () => true })
  await expect(
    api.request('https://evil.test/api/admin/zoho-mail/accounts')
  ).rejects.toThrow('Caminho inválido')
  await expect(api.request('/api/admin/permissions')).rejects.toThrow(
    'Caminho inválido'
  )
  expect(request).not.toHaveBeenCalled()
})
