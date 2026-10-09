import { it, expect, vi } from 'vitest'
import { createHttpClient } from '../../../shared/api'
import { createAdminQuoteDocumentsApi } from './admin-documents'

it('obtém bytes do reajuste pela origem configurada e mantém negativa privada', async () => {
  const fetcher = vi
    .fn<(input: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async () => new Response('%PDF-1.4\nfixture\n%%EOF'))
  const api = createAdminQuoteDocumentsApi(
    createHttpClient({ baseUrl: 'https://api.example.test', fetcher })
  )
  const result = await api.adjustments('q/1')
  expect(await result.blob.text()).toBe('%PDF-1.4\nfixture\n%%EOF')
  expect(fetcher.mock.calls[0]![0]).toBe(
    'https://api.example.test/api/admin/quotes/q%2F1/adjustments/download'
  )
  fetcher.mockImplementation(async () =>
    Response.json({ error: 'Não encontrado' }, { status: 404 })
  )
  expect(await api.adjustments('foreign')).toMatchObject({
    ok: false,
    status: 404,
  })
})
