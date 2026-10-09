import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireTestDatabase } from '../helpers/test-database'
import type {} from './global-setup'
import { parityTargets, sequentialTargets } from './targets'

const context = inject('apiParity')
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const secret = process.env.API_CRON_SECRET ?? 'local-api-cron-fixture-only'
const jobs = [
  'auto-convert-quotes',
  'boleto-overdue-alerts',
  'expire-quotes',
  'late-fees',
  'outbox',
  'preventive-maintenance',
  'send-notifications',
  'sync-google-merchant',
  'verify-boleto-payments',
]
const tenantIds = [context.alfa.id, context.bravo.id, context.unconfigured]
let activeTenantIds: string[]
beforeAll(async () => {
  activeTenantIds = (
    await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    })
  )
    .map((row) => row.id)
    .sort()
  expect(activeTenantIds).toEqual(expect.arrayContaining(tenantIds))
  expect(activeTenantIds).not.toContain(context.suspended)
})
afterAll(async () => {
  await prisma.$disconnect()
  await pool.end()
})
async function call(host: string, job: string, authorization?: string) {
  const response = await fetch(`${host}/api/cron/${job}`, {
    headers: authorization ? { authorization } : {},
    redirect: 'manual',
  })
  return { status: response.status, body: await response.json() }
}
async function counts() {
  return Promise.all([
    prisma.maintenance.count({ where: { tenantId: { in: tenantIds } } }),
    prisma.auditLog.count({ where: { tenantId: { in: tenantIds } } }),
    prisma.outboxEvent.count({ where: { tenantId: { in: tenantIds } } }),
    prisma.rentals.count({
      where: { tenantId: { in: tenantIds }, status: 'OVERDUE' },
    }),
  ])
}
describe('cron HTTP compatibility without scheduler cutover', () => {
  it.each(jobs)(
    '%s rejects missing and wrong credentials on both hosts without tenant work',
    async (job) => {
      const before = await counts()
      for (const host of parityTargets(context)) {
        for (const credential of [
          undefined,
          'Bearer wrong-local-cron-secret',
        ]) {
          expect(await call(host, job, credential)).toEqual({
            status: 401,
            body: { error: 'Unauthorized' },
          })
        }
      }
      expect(await counts()).toEqual(before)
    }
  )
  it('keeps Merchant quarantined even with genuine authorization', async () => {
    for (const host of parityTargets(context)) {
      expect(
        await call(host, 'sync-google-merchant', `Bearer ${secret}`)
      ).toEqual({
        status: 503,
        body: {
          error:
            'Google Merchant integration is quarantined until tenant-specific credentials are configured',
        },
      })
    }
  })
  it('processes ACTIVE organizations only and records execution checkpoints through RLS on both hosts', async () => {
    for (const host of parityTargets(context)) {
      const result = await call(
        host,
        'verify-boleto-payments',
        `Bearer ${secret}`
      )
      expect(result.status).toBe(200)
      expect(result.body.success).toBe(true)
      expect(result.body.deferredTenants).toBe(0)
      expect(
        result.body.results
          .map((row: { tenantId: string }) => row.tenantId)
          .sort()
      ).toEqual(activeTenantIds)
      expect(
        result.body.results.every(
          (row: { status: number }) => row.status === 200
        )
      ).toBe(true)
      const checkpoints = await prisma.auditLog.findMany({
        where: {
          tenantId: { in: tenantIds },
          action: 'CRON_EXECUTION_CHECKPOINT',
          entityId: 'verify-boleto-payments',
        },
      })
      expect(
        checkpoints.every((row) => tenantIds.includes(row.tenantId!))
      ).toBe(true)
      expect(checkpoints.length).toBeGreaterThanOrEqual(tenantIds.length)
    }
    expect(
      await prisma.auditLog.count({
        where: {
          tenantId: context.suspended,
          action: 'CRON_EXECUTION_CHECKPOINT',
        },
      })
    ).toBe(0)
  })
  // Duas chamadas reais: da raiz para a API enquanto as duas coexistem, da API para ela mesma sem a raiz (onda 135, E3).
  it('keeps preventive creation idempotent across two real runs', async () => {
    const [firstHost, secondHost] = sequentialTargets(context)
    const before = await prisma.maintenance.count({
      where: { tenantId: { in: tenantIds } },
    })
    const first = await call(
      firstHost,
      'preventive-maintenance',
      `Bearer ${secret}`
    )
    expect(first.status).toBe(200)
    const created = first.body.results.reduce(
      (sum: number, row: { result: { results: { created: number } } }) =>
        sum + row.result.results.created,
      0
    )
    expect(created).toBeGreaterThan(0)
    const second = await call(
      secondHost,
      'preventive-maintenance',
      `Bearer ${secret}`
    )
    expect(second.status).toBe(200)
    expect(
      second.body.results.every(
        (row: { result: { results: { created: number } } }) =>
          row.result.results.created === 0
      )
    ).toBe(true)
    expect(
      await prisma.maintenance.count({ where: { tenantId: { in: tenantIds } } })
    ).toBe(before + created)
    expect(
      await prisma.maintenance.count({ where: { tenantId: context.suspended } })
    ).toBe(0)
  })
  it.each([
    'auto-convert-quotes',
    'boleto-overdue-alerts',
    'expire-quotes',
    'late-fees',
    'send-notifications',
  ])('%s preserves tenant result shape on both hosts', async (job) => {
    for (const host of parityTargets(context)) {
      const result = await call(host, job, `Bearer ${secret}`)
      expect(result.status).toBe(200)
      expect(result.body.success).toBe(true)
      expect(
        result.body.results
          .map((row: { tenantId: string }) => row.tenantId)
          .sort()
      ).toEqual(activeTenantIds)
      expect(
        result.body.results.every(
          (row: { status: number; result: { success: boolean } }) =>
            row.status === 200 && row.result.success
        )
      ).toBe(true)
    }
  })
  it('claims an invalid delivery once and persists a code without exposing its payload', async () => {
    // Run normal fixture backlog first. Real provider egress is disabled by global setup.
    for (const host of parityTargets(context))
      expect((await call(host, 'outbox', `Bearer ${secret}`)).status).toBe(200)
    const id = randomUUID()
    const privateMarker = `private-${randomUUID()}`
    await prisma.outboxEvent.create({
      data: {
        id,
        tenantId: context.alfa.id,
        topic: 'fixture.unknown',
        aggregateId: id,
        dedupeKey: id,
        payload: { privateMarker },
      },
    })
    // A segunda chamada real não reivindica de novo o evento já marcado: da raiz para a API enquanto as duas coexistem e da
    // API para ela mesma sem a raiz (onda 135, E3). Nunca uma chamada só.
    const [firstHost, secondHost] = sequentialTargets(context)
    try {
      const first = await call(firstHost, 'outbox', `Bearer ${secret}`)
      expect(first.status).toBe(200)
      expect(first.body.failed).toBeGreaterThanOrEqual(1)
      const saved = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id },
      })
      expect(saved.status).toBe('FAILED')
      expect(saved.lastError).toBe('UNKNOWN_TOPIC')
      expect(saved.attempts).toBe(1)
      const second = await call(secondHost, 'outbox', `Bearer ${secret}`)
      expect(second.status).toBe(200)
      expect(
        (await prisma.outboxEvent.findUniqueOrThrow({ where: { id } })).attempts
      ).toBe(1)
      expect(JSON.stringify([first.body, second.body])).not.toContain(
        privateMarker
      )
    } finally {
      await prisma.outboxEvent.deleteMany({
        where: { id, tenantId: context.alfa.id },
      })
    }
  })
})
