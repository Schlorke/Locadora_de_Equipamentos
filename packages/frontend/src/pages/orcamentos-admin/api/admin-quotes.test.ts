import { expect, it, vi } from 'vitest'
import { createHttpClient } from '../../../shared/api'
import { createAdminQuotesApi } from './admin-quotes'

it('preserva o contrato de leitura, mutação, reajuste, multa e envio enfileirado', async () => {
  const fetcher = vi.fn<
    (path: string, init?: RequestInit) => Promise<Response>
  >(async () => Response.json({ processing: 'PENDING' }, { status: 202 }))
  const api = createAdminQuotesApi(
    createHttpClient({
      baseUrl: 'https://api.example.test',
      fetcher,
      getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
    })
  )
  await api.list('page=1&limit=20&search=Q%2F1')
  await api.get('q/1')
  await api.update('q/1', {
    body: '{"status":"APPROVED","paymentTerms":"AT_END"}',
  })
  await api.remove('q/1')
  await api.adjustments('q/1')
  await api.addAdjustment('q/1', {
    body: '{"category":"TRAVEL","amount":10,"sendEmail":true,"sendWhatsapp":true}',
  })
  await api.removeAdjustment('q/1', 'a/1')
  await api.calculateLateFee('q/1', {
    headers: { 'Content-Type': 'application/json' },
  })
  const pending = await api.sendAdjusted('q/1')
  expect(pending).toMatchObject({
    status: 202,
    data: { processing: 'PENDING' },
  })
  expect(
    fetcher.mock.calls.map(([path, init]) => [
      path.replace('https://api.example.test', ''),
      init?.method || 'GET',
    ])
  ).toEqual([
    ['/api/admin/quotes?page=1&limit=20&search=Q%2F1', 'GET'],
    ['/api/admin/quotes/q%2F1', 'GET'],
    ['/api/admin/quotes/q%2F1', 'PATCH'],
    ['/api/admin/quotes/q%2F1', 'DELETE'],
    ['/api/admin/quotes/q%2F1/adjustments', 'GET'],
    ['/api/admin/quotes/q%2F1/adjustments', 'POST'],
    ['/api/admin/quotes/q%2F1/adjustments/a%2F1', 'DELETE'],
    ['/api/admin/quotes/q%2F1/calculate-late-fee', 'POST'],
    ['/api/admin/quotes/q%2F1/send-adjusted-quote', 'POST'],
  ])
  expect(fetcher.mock.calls[2]?.[1]?.body).toBe(
    '{"status":"APPROVED","paymentTerms":"AT_END"}'
  )
  expect(fetcher.mock.calls[5]?.[1]?.body).toBe(
    '{"category":"TRAVEL","amount":10,"sendEmail":true,"sendWhatsapp":true}'
  )
  expect(fetcher.mock.calls[8]?.[1]?.body).toBeUndefined()
})
