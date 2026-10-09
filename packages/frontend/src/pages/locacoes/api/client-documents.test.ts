import { it, expect, vi } from 'vitest'
import { createHttpClient, HttpError } from '../../../shared/api'
import { createClientDocumentsApi } from './client-documents'

it('envia multipart e consulta documentos pela API configurada, preservando negativas', async () => {
  const form = new FormData()
  form.append('type', 'SELFIE')
  form.append('file', new Blob(['bytes']), 'private.png')
  const fetcher = vi
    .fn<(input: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async (_path, init) =>
      Response.json(
        init?.method === 'POST'
          ? { document: { id: 'doc' } }
          : { documents: [] }
      )
    )
  const api = createClientDocumentsApi(
    createHttpClient({ baseUrl: 'https://api.example.test', fetcher })
  )
  expect(await api.upload('r/1', form)).toEqual({ document: { id: 'doc' } })
  expect(await api.list('u/1')).toEqual({ documents: [] })
  expect(fetcher.mock.calls[0]).toEqual([
    'https://api.example.test/api/admin/rentals/r%2F1/client-documents',
    expect.objectContaining({ method: 'POST', body: form }),
  ])
  expect(fetcher.mock.calls[0]![1]!.headers).not.toHaveProperty('Content-Type')
  expect(fetcher.mock.calls[1]![0]).toBe(
    'https://api.example.test/api/admin/clients/u%2F1/documents'
  )
  fetcher.mockImplementation(async () =>
    Response.json({ error: 'Acesso negado' }, { status: 403 })
  )
  await expect(api.list('foreign')).rejects.toEqual(
    new HttpError('Acesso negado', 403)
  )
})
