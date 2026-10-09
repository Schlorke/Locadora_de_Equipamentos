import { expect, it, vi } from 'vitest'
import { createHttpClient } from '../../../shared/api'
import { createWhatsAppApi } from './whatsapp'
it('usa queries relativas, paginação e POST aparado no host configurado', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => Response.json({ messages: [] }))
  const api = createWhatsAppApi(
    createHttpClient({
      baseUrl: 'https://api.example.test',
      fetcher,
      getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
    })
  )
  await api.conversations(50)
  await api.messages('a/b', 50, '2026-10-03T10:00:00+00:00')
  await api.send('a/b', '  texto  ')
  expect(fetcher.mock.calls[0]?.[0]).toBe(
    'https://api.example.test/api/admin/whatsapp/conversations?limit=50&offset=0'
  )
  const url = new URL(String(fetcher.mock.calls[1]?.[0]))
  expect(url.pathname).toBe('/api/admin/whatsapp/conversations/a%2Fb/messages')
  expect(url.searchParams.get('before')).toBe('2026-10-03T10:00:00+00:00')
  expect(url.searchParams.get('limit')).toBe('50')
  expect(fetcher.mock.calls[2]).toEqual([
    'https://api.example.test/api/admin/whatsapp/conversations/a%2Fb/messages',
    expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: '{"text":"texto"}',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'x-tenant-id': 'alfa',
      }),
    }),
  ])
})
it('preserva mensagem do servidor e fallback de recusa não JSON', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ error: 'Quota' }, { status: 429 }))
    .mockResolvedValueOnce(new Response('erro', { status: 500 }))
    .mockResolvedValueOnce(new Response('html'))
  const api = createWhatsAppApi(createHttpClient({ fetcher }))
  await expect(api.send('id', 'x')).rejects.toThrow('Quota')
  await expect(api.messages('id', 50)).rejects.toThrow(
    'Erro ao carregar mensagens'
  )
  await expect(api.conversations(50)).rejects.toBeInstanceOf(SyntaxError)
})
