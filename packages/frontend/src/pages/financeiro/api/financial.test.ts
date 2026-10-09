import { expect, it, vi } from 'vitest'
import { createHttpClient } from '../../../shared/api'
import { createFinancialApi } from './financial'

it('conserva consulta, cookies, seleção e corpos das mutações financeiras', async () => {
  const fetcher = vi.fn<
    (path: string, init?: RequestInit) => Promise<Response>
  >(async () =>
    Response.json({ error: 'Histórico financeiro preservado' }, { status: 409 })
  )
  const api = createFinancialApi(
    createHttpClient({
      baseUrl: 'https://api.example.test',
      fetcher,
      getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
    })
  )
  await api.entries('search=Q%2F1&limit=10000')
  await api.calendar('status=UNPAID&start=2033-03-01')
  await api.revenue('search=Q%2F1')
  await api.aging('')
  await api.settings()
  await api.saveSettings({ body: '{"cpfRate":6}' })
  await api.status('p/1', { body: '{"billingStatus":"SETTLED"}' })
  const denied = await api.remove('p/1')
  expect(denied).toMatchObject({
    ok: false,
    status: 409,
    data: { error: 'Histórico financeiro preservado' },
  })
  expect(
    fetcher.mock.calls.map(([path, init]) => [
      path.replace('https://api.example.test', ''),
      init?.method || 'GET',
      init?.body,
    ])
  ).toEqual([
    ['/api/admin/financial/entries?search=Q%2F1&limit=10000', 'GET', undefined],
    [
      '/api/admin/financial/calendar?status=UNPAID&start=2033-03-01',
      'GET',
      undefined,
    ],
    ['/api/admin/financial/revenue?search=Q%2F1', 'GET', undefined],
    ['/api/admin/financial/aging', 'GET', undefined],
    ['/api/admin/financial/settings', 'GET', undefined],
    ['/api/admin/financial/settings', 'PATCH', '{"cpfRate":6}'],
    [
      '/api/admin/financial/entries/p%2F1/status',
      'PATCH',
      '{"billingStatus":"SETTLED"}',
    ],
    ['/api/admin/financial/entries/p%2F1', 'DELETE', undefined],
  ])
  for (const [, init] of fetcher.mock.calls)
    expect(init).toMatchObject({
      credentials: 'include',
      headers: { 'x-tenant-id': 'alfa' },
    })
})

it('conserva reajustes e bytes de exportação sem tratar negativas como sucesso', async () => {
  const fetcher = vi.fn<
    (path: string, init?: RequestInit) => Promise<Response>
  >(async (path) =>
    path.includes('/export')
      ? new Response(new Uint8Array([0, 255, 10]))
      : Response.json({ adjustments: [] })
  )
  const api = createFinancialApi(createHttpClient({ fetcher }))
  await api.adjustments('q/1')
  await api.addAdjustment('q/1', { body: '{"amount":10,"sendEmail":true}' })
  await api.removeAdjustment('q/1', 'a/1')
  const file = await api.exportFile('format=xlsx&ids=p1%2Cp2')
  expect(new Uint8Array(await file.blob.arrayBuffer())).toEqual(
    new Uint8Array([0, 255, 10])
  )
  expect(
    fetcher.mock.calls.map(([path, init]) => [path, init?.method || 'GET'])
  ).toEqual([
    ['/api/admin/quotes/q%2F1/adjustments', 'GET'],
    ['/api/admin/quotes/q%2F1/adjustments', 'POST'],
    ['/api/admin/quotes/q%2F1/adjustments/a%2F1', 'DELETE'],
    ['/api/admin/financial/export?format=xlsx&ids=p1%2Cp2', 'GET'],
  ])
})
