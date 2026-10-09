import { describe, it, expect, vi } from 'vitest'
import { createHttpClient } from '../../../shared/api'
import { createAdminPaymentApi } from './admin-payments'

describe('comandos administrativos de pagamento', () => {
  it('mantém verbos, ids codificados, ausência de corpo e 202 sem marcador de processamento', async () => {
    const fetcher = vi
      .fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockImplementation(async () =>
        Response.json({ operationId: 'queued' }, { status: 202 })
      )
    const api = createAdminPaymentApi(
      createHttpClient({
        baseUrl: 'https://api.example.test',
        fetcher,
        getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
      })
    )
    expect(await api.generateForQuote('q/1')).toEqual({
      status: 202,
      ok: true,
      data: { operationId: 'queued' },
    })
    expect(await api.regenerate('p/1')).toMatchObject({ status: 202 })
    await api.updateDueDate('p/1', '2026-12-01T12:00:00.000Z')
    expect(
      fetcher.mock.calls.map(([url, init]) => [url, init?.method, init?.body])
    ).toEqual([
      [
        'https://api.example.test/api/admin/quotes/q%2F1/generate-boleto',
        'POST',
        undefined,
      ],
      [
        'https://api.example.test/api/payments/boleto/p%2F1/regenerate',
        'PUT',
        undefined,
      ],
      [
        'https://api.example.test/api/admin/financial/entries/p%2F1/due-date',
        'PATCH',
        '{"dueDate":"2026-12-01T12:00:00.000Z"}',
      ],
    ])
    expect(fetcher.mock.calls[2]![1]!.headers).toMatchObject({
      'x-tenant-id': 'alfa',
      'Content-Type': 'application/json',
    })
  })
  it('não converte uma recusa de conciliação em sucesso', async () => {
    const api = createAdminPaymentApi(
      createHttpClient({
        fetcher: async () =>
          Response.json(
            { error: 'Pagamento exige conciliação' },
            { status: 409 }
          ),
      })
    )
    expect(await api.regenerate('p')).toEqual({
      ok: false,
      status: 409,
      data: { error: 'Pagamento exige conciliação' },
    })
  })
})
