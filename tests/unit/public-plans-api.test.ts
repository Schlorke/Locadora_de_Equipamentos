import { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { ENTITLEMENT_FEATURES } from '@gb-locacoes/contracts/entitlements'
import { createPublicPlanCatalog } from '../../packages/backend/src/modules/subscriptions/public-catalog'
import { createPublicPlansHandler } from '../../packages/backend/src/http/public-plans'
import { GET as service } from '../../apps/services/api/src/app/api/public/plans/route'
import { readConfiguredPublicPlans } from '../../packages/backend/src/runtime/platform-jobs'

const entitlements = {
  schema: 1 as const,
  limits: { equipments: 20, staffSeats: 3 },
  features: Object.fromEntries(
    ENTITLEMENT_FEATURES.map((name) => [name, true])
  ),
}
const offer = {
  id: 'catalog-version',
  plan: { code: 'synthetic', name: 'Plano sintético' },
  version: 2,
  interval: 'MONTHLY',
  amount: new Prisma.Decimal('199.90'),
  trialDays: 14,
  entitlements,
}
function reader(rows: unknown[]) {
  const findMany = vi.fn().mockResolvedValue(rows)
  const now = vi.fn(() => new Date('2026-10-04T12:00:00Z'))
  const transaction = vi.fn(
    async <T>(read: (_tx: Prisma.TransactionClient) => Promise<T>) =>
      read({ planVersion: { findMany } } as unknown as Prisma.TransactionClient)
  )
  return {
    read: createPublicPlanCatalog({ transaction, now }),
    findMany,
    now,
    transaction,
  }
}
describe('public SaaS plan catalog', () => {
  it('preserves monthly and yearly offers without silently choosing one interval', async () => {
    const ports = reader([
      offer,
      {
        ...offer,
        id: 'annual-version',
        interval: 'YEARLY',
        amount: new Prisma.Decimal('1999.90'),
      },
    ])
    const body = await ports.read()
    expect(ports.now).toHaveBeenCalledTimes(1)
    expect(ports.transaction).toHaveBeenCalledTimes(1)
    expect(body.plans).toEqual([
      {
        planVersionId: 'catalog-version',
        code: 'synthetic',
        name: 'Plano sintético',
        version: 2,
        interval: 'MONTHLY',
        amount: '199.90',
        trialDays: 14,
        entitlements,
      },
      {
        planVersionId: 'annual-version',
        code: 'synthetic',
        name: 'Plano sintético',
        version: 2,
        interval: 'YEARLY',
        amount: '1999.90',
        trialDays: 14,
        entitlements,
      },
    ])
  })
  it('preserves decimal precision and exposes neither internal fields nor rule defaults', async () => {
    const body = await reader([
      {
        ...offer,
        amount: new Prisma.Decimal('9999999999.99'),
        graceDays: 7,
        providerKey: 'never-public',
      },
    ]).read()
    expect(body.plans[0]?.amount).toBe('9999999999.99')
    expect(Object.keys(body.plans[0]!).sort()).toEqual(
      [
        'amount',
        'code',
        'entitlements',
        'interval',
        'name',
        'planVersionId',
        'trialDays',
        'version',
      ].sort()
    )
  })
  it('returns an empty catalog without inventing commercial plans', async () => {
    expect(await reader([]).read()).toEqual({ plans: [] })
  })
  it.each<[string, unknown[]]>([
    ['zero public amount', [{ ...offer, amount: new Prisma.Decimal('0') }]],
    [
      'invalid stored rights',
      [{ ...offer, entitlements: { ...entitlements, extra: true } }],
    ],
    [
      'too many sale offers',
      Array.from({ length: 11 }, (_, n) => ({ ...offer, id: 'version-' + n })),
    ],
  ])(
    'fails closed for %s instead of repairing or dropping published offers',
    async (_name, rows) => {
      const response = await createPublicPlansHandler(reader(rows).read)()
      expect(response.status).toBe(503)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(await response.json()).toEqual({
        error: 'Catálogo de planos indisponível',
      })
    }
  )
  it('sends only validated public data and a bounded shared cache', async () => {
    const response = await createPublicPlansHandler(reader([offer]).read)()
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=0, s-maxage=60'
    )
    expect((await response.json()).plans[0].amount).toBe('199.90')
    expect(response.headers.get('Set-Cookie')).toBeNull()
  })
  it('both hosts use the same runtime, without business database fallback', async () => {
    vi.stubEnv('PLATFORM_DATABASE_URL', '')
    try {
      for (const read of [service, readConfiguredPublicPlans]) {
        const response = await read()
        expect(response.status).toBe(503)
        expect(await response.json()).toEqual({
          error: 'Catálogo de planos indisponível',
        })
      }
    } finally {
      vi.unstubAllEnvs()
    }
  })
  it('returns a neutral non-cacheable failure if the platform transaction fails', async () => {
    const response = await createPublicPlansHandler(async () => {
      throw new Error('secret-connection-string')
    })()
    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.text()).not.toContain('secret')
  })
})
