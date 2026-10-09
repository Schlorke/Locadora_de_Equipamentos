import { describe, expect, it, vi } from 'vitest'
import { createHttpClient } from '../../../shared/api'
import {
  invoiceFixture,
  subscriptionFixture,
} from '../../../../../../tests/helpers/subscription-account'
import { readOwnerAccount } from './owner-account'

function api(
  summary: unknown,
  summaryStatus = 200,
  invoiceData: unknown = { invoices: [invoiceFixture()] },
  invoiceStatus = 200
) {
  const fetcher = vi.fn(async (path: string, _init?: RequestInit) =>
    Response.json(path.endsWith('/invoices') ? invoiceData : summary, {
      status: path.endsWith('/invoices') ? invoiceStatus : summaryStatus,
    })
  )
  return { client: createHttpClient({ fetcher }), fetcher }
}
describe('leitura comercial compartilhada', () => {
  it('valida os dois contratos e usa apenas GETs sem body', async () => {
    const { client, fetcher } = api(subscriptionFixture())
    const data = await readOwnerAccount(client, true)
    expect(data.summary?.plan.amount).toBe('199.90')
    expect(data.invoices?.[0]?.dueDate).toBe('2026-10-04')
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
      '/api/admin/subscription',
      '/api/admin/subscription/invoices',
    ])
    for (const call of fetcher.mock.calls) {
      expect(call[1]?.method).toBeUndefined()
      expect(call[1]?.body).toBeUndefined()
    }
  })
  it('estado/mobile/menu não consultam faturas', async () => {
    const { client, fetcher } = api(subscriptionFixture())
    expect((await readOwnerAccount(client, false)).invoices).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('ausência conhecida não inventa plano e preserva histórico', async () => {
    const { client } = api({ code: 'SUBSCRIPTION_NOT_FOUND' }, 404)
    expect(await readOwnerAccount(client, true)).toEqual({
      summary: null,
      invoices: [invoiceFixture()],
    })
  })
  it.each([
    [401, 'session'],
    [403, 'owner'],
    [409, 'selection'],
    [404, 'unavailable'],
    [503, 'unavailable'],
  ] as const)('recusa HTTP %s sem expor detalhes', async (status, problem) => {
    const { client } = api(
      { code: 'TENANT_REQUIRED', error: 'segredo privado' },
      status
    )
    await expect(readOwnerAccount(client, true)).rejects.toMatchObject({
      problem,
      message: 'Não foi possível consultar a assinatura.',
    })
  })
  it.each([
    { ...subscriptionFixture(), access: 'ARCHIVED' },
    { ...subscriptionFixture(), privateKey: 'segredo' },
    {
      ...subscriptionFixture(),
      plan: { ...subscriptionFixture().plan, amount: 199.9 },
    },
  ])('recusa resumo fora do contrato', async (data) => {
    await expect(
      readOwnerAccount(api(data).client, true)
    ).rejects.toMatchObject({ problem: 'unavailable' })
  })
  it.each([
    'javascript:alert(1)',
    'https://evil.example/i',
    'https://www.asaas.com@evil.example/i',
  ])('recusa URL de fatura %s', async (invoiceUrl) => {
    await expect(
      readOwnerAccount(
        api(subscriptionFixture(), 200, {
          invoices: [invoiceFixture({ invoiceUrl })],
        }).client,
        true
      )
    ).rejects.toMatchObject({ problem: 'unavailable' })
  })
  it('recusa mudança de dono entre as duas leituras sem devolver resumo parcial', async () => {
    await expect(
      readOwnerAccount(
        api(subscriptionFixture(), 200, { code: 'OWNER_REQUIRED' }, 403).client,
        true
      )
    ).rejects.toMatchObject({ problem: 'owner' })
  })
  it('histórico vazio é uma resposta válida', async () => {
    expect(
      (
        await readOwnerAccount(
          api(subscriptionFixture(), 200, { invoices: [] }).client,
          true
        )
      ).invoices
    ).toEqual([])
  })
})
