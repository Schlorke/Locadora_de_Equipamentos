import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { createTenantCron, type CronBudget } from './tenant-cron'

// ADR SaaS B.5 (matriz) e B.10 (linha "Jobs"): cada job declara se é obrigação ou divulgação;
// a divulgação só roda em FULL quando a fiscalização (D23) está em on, e shadow só registra.
const SECRET = 'tenant-cron-fixture-secret'
type Organization = { id: string; access: string; status?: string }
const TENANTS: Organization[] = [
  { id: 'tenant-full', access: 'FULL' },
  { id: 'tenant-setup', access: 'SETUP' },
  { id: 'tenant-restricted', access: 'RESTRICTED' },
  { id: 'tenant-archived', access: 'ARCHIVED' },
]
const ALL = TENANTS.map((tenant) => tenant.id)
const OBLIGATIONS = [
  'auto-convert-quotes',
  'boleto-overdue-alerts',
  'expire-quotes',
  'late-fees',
  'preventive-maintenance',
  'send-notifications',
  'verify-boleto-payments',
] as const

function request() {
  return new Request('http://localhost/api/cron/fixture', {
    headers: { authorization: `Bearer ${SECRET}` },
  })
}

function harness(
  organizations: Organization[] = TENANTS,
  setting: {
    enforcement?: string
    failAccess?: string[]
    inactiveAtRun?: string[]
    failShadow?: boolean
  } = {}
) {
  const shadow: unknown[] = []
  const checkpoints: string[] = []
  const enforcement = vi.fn(() => setting.enforcement)
  const findMany = vi.fn(async (_query: unknown) =>
    organizations
      .filter((organization) => (organization.status ?? 'ACTIVE') === 'ACTIVE')
      .map((organization) => ({ id: organization.id }))
  )
  const findFirst = vi.fn(
    async (query: {
      where: { id: string; status: string }
      select: Record<string, boolean>
    }) => {
      if (setting.failAccess?.includes(query.where.id))
        throw new Error('database unavailable')
      const organization = organizations.find(
        (candidate) =>
          candidate.id === query.where.id &&
          !setting.inactiveAtRun?.includes(candidate.id) &&
          (candidate.status ?? 'ACTIVE') === query.where.status
      )
      return organization ? { access: organization.access } : null
    }
  )
  const auditLog = {
    findFirst: vi.fn(async () => null),
    create: vi.fn(async ({ data }: { data: { tenantId: string } }) => {
      checkpoints.push(data.tenantId)
      return { id: 'checkpoint' }
    }),
  }
  const database = { organization: { findMany, findFirst } }
  const runner = createTenantCron({
    getDatabase: () => database as unknown as PrismaClient,
    withTenantTransaction: async (_context, operation) =>
      operation({ auditLog } as never),
    enforcement,
    shadow: (entry) => {
      if (setting.failShadow) throw new Error('logger unavailable')
      shadow.push(entry)
    },
  })
  const job = vi.fn(
    async (context: { tenantId: string }, _budget: CronBudget) =>
      Response.json({ ran: context.tenantId })
  )
  const ran = () => job.mock.calls.map((call) => call[0].tenantId)
  return {
    runner,
    job,
    ran,
    shadow,
    checkpoints,
    enforcement,
    findMany,
    findFirst,
    auditLog,
  }
}

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', SECRET)
  vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('tenant cron job declaration', () => {
  it('refuses a job without a declared kind before any tenant work, on types and at runtime', async () => {
    const { runner, job, findMany, enforcement } = harness()
    const refused = [
      // @ts-expect-error each job must declare its catalog entry
      await runner.runTenantCron(request(), job),
      // @ts-expect-error each job must declare its catalog entry
      await runner.runTenantCron(request(), job, {}),
      // @ts-expect-error unknown job names are not declarations
      await runner.runTenantCron(request(), job, { job: 'marketing-blast' }),
      // @ts-expect-error prototype keys are not declarations
      await runner.runTenantCron(request(), job, { job: 'toString' }),
      // @ts-expect-error prototype keys are not declarations
      await runner.runTenantCron(request(), job, { job: '__proto__' }),
      // @ts-expect-error the checkpoint never declares the kind
      await runner.runTenantCron(request(), job, {
        checkpoint: 'late-fees',
        budgetMs: 1000,
        minRemainingMs: 0,
      }),
    ]
    for (const response of refused) {
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        success: false,
        error: 'Tenant cron job is not declared',
        results: [],
      })
    }
    expect(job).not.toHaveBeenCalled()
    expect(findMany).not.toHaveBeenCalled()
    expect(enforcement).not.toHaveBeenCalled()
  })

  it('still authorizes the cron before reading the declaration', async () => {
    const { runner, job, findMany } = harness()
    const response = await runner.runTenantCron(
      new Request('http://localhost/api/cron/fixture', {
        headers: { authorization: 'Bearer wrong' },
      }),
      job,
      // @ts-expect-error unknown job names are not declarations
      { job: 'marketing-blast' }
    )
    expect(response.status).toBe(401)
    expect(job).not.toHaveBeenCalled()
    expect(findMany).not.toHaveBeenCalled()
  })

  it('declares the current jobs: obligations never skip, the Merchant feed is promotion', async () => {
    for (const name of [...OBLIGATIONS, 'sync-google-merchant'] as const) {
      const { runner, job, ran } = harness(TENANTS, { enforcement: 'on' })
      const response = await runner.runTenantCron(request(), job, {
        job: name,
      })
      expect(response.status, name).toBe(200)
      expect(ran(), name).toEqual(
        name === 'sync-google-merchant' ? ['tenant-full'] : ALL
      )
    }
  })
})

describe('tenant cron schedule', () => {
  // Checkpoint, budget and reserve go together: a partial or non-finite schedule never runs unbounded.
  it.each(['late-fees', 'sync-google-merchant'] as const)(
    'refuses a partial or invalid schedule before any tenant work, on types and at runtime: %s',
    async (name) => {
      const { runner, job, findMany, enforcement, auditLog } = harness()
      const refused = [
        // @ts-expect-error a checkpoint needs its budget and reserve
        await runner.runTenantCron(request(), job, {
          job: name,
          checkpoint: name,
        }),
        // @ts-expect-error a budget needs its checkpoint
        await runner.runTenantCron(request(), job, {
          job: name,
          budgetMs: 180000,
          minRemainingMs: 60000,
        }),
        // @ts-expect-error a checkpoint and budget need their reserve
        await runner.runTenantCron(request(), job, {
          job: name,
          checkpoint: name,
          budgetMs: 180000,
        }),
        // @ts-expect-error a budget alone is not a schedule
        await runner.runTenantCron(request(), job, {
          job: name,
          budgetMs: 180000,
        }),
        // @ts-expect-error a reserve alone is not a schedule
        await runner.runTenantCron(request(), job, {
          job: name,
          minRemainingMs: 60000,
        }),
        ...(await Promise.all(
          [
            { checkpoint: name, budgetMs: Number.NaN, minRemainingMs: 60000 },
            { checkpoint: name, budgetMs: Infinity, minRemainingMs: 60000 },
            { checkpoint: name, budgetMs: 0, minRemainingMs: 0 },
            { checkpoint: name, budgetMs: 180000, minRemainingMs: Number.NaN },
            { checkpoint: name, budgetMs: 180000, minRemainingMs: Infinity },
            { checkpoint: name, budgetMs: 180000, minRemainingMs: -1 },
            { checkpoint: '', budgetMs: 180000, minRemainingMs: 60000 },
          ].map((schedule) =>
            runner.runTenantCron(request(), job, { job: name, ...schedule })
          )
        )),
      ]
      for (const response of refused) {
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          success: false,
          error: 'Tenant cron schedule is invalid',
          results: [],
        })
      }
      expect(job).not.toHaveBeenCalled()
      expect(findMany).not.toHaveBeenCalled()
      expect(enforcement).not.toHaveBeenCalled()
      expect(auditLog.findFirst).not.toHaveBeenCalled()
      expect(auditLog.create).not.toHaveBeenCalled()
    }
  )

  it('passes a finite budget to a scheduled job and none to an unscheduled one', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-06T03:00:00Z'))
    try {
      const start = Date.now()
      const scheduled = harness([{ id: 'tenant-full', access: 'FULL' }])
      await scheduled.runner.runTenantCron(request(), scheduled.job, {
        job: 'verify-boleto-payments',
        checkpoint: 'verify-boleto-payments',
        budgetMs: 180000,
        minRemainingMs: 60000,
      })
      expect(scheduled.job.mock.calls.map((call) => call[1])).toEqual([
        { deadline: start + 180000, minRemainingMs: 60000 },
      ])
      const unscheduled = harness([{ id: 'tenant-full', access: 'FULL' }])
      for (const options of [
        { job: 'late-fees' as const },
        {
          job: 'late-fees' as const,
          checkpoint: undefined,
          budgetMs: undefined,
          minRemainingMs: undefined,
        },
      ])
        await unscheduled.runner.runTenantCron(
          request(),
          unscheduled.job,
          options
        )
      expect(unscheduled.job.mock.calls.map((call) => call[1])).toEqual([
        { deadline: Infinity, minRemainingMs: 0 },
        { deadline: Infinity, minRemainingMs: 0 },
      ])
      expect(unscheduled.checkpoints).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('obligation jobs ignore subscription access in every enforcement mode', () => {
  it.each(['off', 'shadow', 'on', 'invalid-mode', undefined])(
    'runs every ACTIVE tenant and keeps the previous response: %s',
    async (mode) => {
      const organizations = [
        ...TENANTS,
        { id: 'tenant-blocked', access: 'FULL', status: 'SUSPENDED' },
      ]
      const { runner, job, ran, shadow, enforcement, findFirst, findMany } =
        harness(organizations, { enforcement: mode })
      const response = await runner.runTenantCron(request(), job, {
        job: 'late-fees',
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        success: true,
        results: ALL.map((tenantId) => ({
          tenantId,
          status: 200,
          result: { ran: tenantId },
        })),
      })
      expect(ran()).toEqual(ALL)
      expect(findMany).toHaveBeenCalledExactlyOnceWith({
        where: { status: 'ACTIVE' },
        select: { id: true },
      })
      expect(findFirst).not.toHaveBeenCalled()
      expect(enforcement).not.toHaveBeenCalled()
      expect(shadow).toEqual([])
    }
  )

  it('keeps budget, checkpoints and deferred tenants of a scheduled obligation', async () => {
    const { runner, job, ran, checkpoints, findFirst } = harness(TENANTS, {
      enforcement: 'on',
    })
    const response = await runner.runTenantCron(request(), job, {
      job: 'verify-boleto-payments',
      checkpoint: 'verify-boleto-payments',
      budgetMs: 180000,
      minRemainingMs: 60000,
    })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.deferredTenants).toBe(0)
    expect(body).not.toHaveProperty('skippedTenants')
    expect([...ran()].sort()).toEqual([...ALL].sort())
    expect([...checkpoints].sort()).toEqual([...ALL].sort())
    expect(findFirst).not.toHaveBeenCalled()
  })
})

describe('promotion jobs follow PLATFORM_SUBSCRIPTION_ENFORCEMENT', () => {
  it('off treats every tenant as FULL without reading access', async () => {
    const { runner, job, ran, shadow, findFirst } = harness(TENANTS, {
      enforcement: 'off',
    })
    const response = await runner.runTenantCron(request(), job, {
      job: 'sync-google-merchant',
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      skippedTenants: [],
    })
    expect(ran()).toEqual(ALL)
    expect(findFirst).not.toHaveBeenCalled()
    expect(shadow).toEqual([])
  })

  it('an absent setting means off', async () => {
    vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', undefined)
    const { runner, job, ran, findFirst } = harness(TENANTS)
    const response = await runner.runTenantCron(request(), job, {
      job: 'sync-google-merchant',
    })
    expect(response.status).toBe(200)
    expect(ran()).toEqual(ALL)
    expect(findFirst).not.toHaveBeenCalled()
  })

  it('shadow records SETUP, RESTRICTED and ARCHIVED without skipping them', async () => {
    const { runner, job, ran, shadow } = harness(TENANTS, {
      enforcement: 'shadow',
    })
    const response = await runner.runTenantCron(request(), job, {
      job: 'sync-google-merchant',
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      skippedTenants: [],
    })
    expect(ran()).toEqual(ALL)
    expect(shadow).toEqual([
      {
        tenantId: 'tenant-setup',
        job: 'sync-google-merchant',
        access: 'SETUP',
      },
      {
        tenantId: 'tenant-restricted',
        job: 'sync-google-merchant',
        access: 'RESTRICTED',
      },
      {
        tenantId: 'tenant-archived',
        job: 'sync-google-merchant',
        access: 'ARCHIVED',
      },
    ])
  })

  it('shadow never blocks on a failed access read or logger', async () => {
    const failed = harness(TENANTS, {
      enforcement: 'shadow',
      failAccess: ['tenant-full'],
    })
    expect(
      (
        await failed.runner.runTenantCron(request(), failed.job, {
          job: 'sync-google-merchant',
        })
      ).status
    ).toBe(200)
    expect(failed.ran()).toEqual(ALL)
    expect(failed.shadow).toContainEqual({
      tenantId: 'tenant-full',
      job: 'sync-google-merchant',
      access: 'UNAVAILABLE',
    })
    const silent = harness(TENANTS, { enforcement: 'shadow', failShadow: true })
    expect(
      (
        await silent.runner.runTenantCron(request(), silent.job, {
          job: 'sync-google-merchant',
        })
      ).status
    ).toBe(200)
    expect(silent.ran()).toEqual(ALL)
  })

  it('on skips SETUP, RESTRICTED and ARCHIVED and runs only FULL', async () => {
    const { runner, job, ran, shadow, findFirst } = harness(TENANTS, {
      enforcement: 'on',
    })
    const response = await runner.runTenantCron(request(), job, {
      job: 'sync-google-merchant',
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      results: [
        {
          tenantId: 'tenant-full',
          status: 200,
          result: { ran: 'tenant-full' },
        },
      ],
      skippedTenants: [
        { tenantId: 'tenant-setup', access: 'SETUP' },
        { tenantId: 'tenant-restricted', access: 'RESTRICTED' },
        { tenantId: 'tenant-archived', access: 'ARCHIVED' },
      ],
    })
    expect(ran()).toEqual(['tenant-full'])
    expect(shadow).toEqual([])
    // Access is read right before each tenant runs, not from a stale listing.
    expect(findFirst.mock.calls.map((call) => call[0])).toEqual(
      ALL.map((id) => ({
        where: { id, status: 'ACTIVE' },
        select: { access: true },
      }))
    )
  })

  it('on skips a tenant that left ACTIVE or FULL after the listing', async () => {
    const { runner, job, ran } = harness(TENANTS, {
      enforcement: 'on',
      inactiveAtRun: ['tenant-full'],
    })
    const response = await runner.runTenantCron(request(), job, {
      job: 'sync-google-merchant',
    })
    expect(response.status).toBe(200)
    expect((await response.json()).skippedTenants).toContainEqual({
      tenantId: 'tenant-full',
      access: 'INACTIVE',
    })
    expect(ran()).toEqual([])
  })

  it('on fails closed for a tenant whose access cannot be read', async () => {
    const { runner, job, ran } = harness(
      [
        { id: 'tenant-full', access: 'FULL' },
        { id: 'tenant-unknown', access: 'LEGACY_VALUE' },
        { id: 'tenant-error', access: 'FULL' },
      ],
      { enforcement: 'on', failAccess: ['tenant-error'] }
    )
    const response = await runner.runTenantCron(request(), job, {
      job: 'sync-google-merchant',
    })
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      results: [
        {
          tenantId: 'tenant-full',
          status: 200,
          result: { ran: 'tenant-full' },
        },
        {
          tenantId: 'tenant-unknown',
          status: 503,
          result: { error: 'Tenant cron policy unavailable' },
        },
        {
          tenantId: 'tenant-error',
          status: 503,
          result: { error: 'Tenant cron policy unavailable' },
        },
      ],
      skippedTenants: [],
    })
    expect(ran()).toEqual(['tenant-full'])
  })

  it('on keeps skipped tenants out of deferred tenants and checkpoints', async () => {
    const { runner, job, ran, checkpoints } = harness(TENANTS, {
      enforcement: 'on',
    })
    const response = await runner.runTenantCron(request(), job, {
      job: 'sync-google-merchant',
      checkpoint: 'sync-google-merchant',
      budgetMs: 180000,
      minRemainingMs: 60000,
    })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.deferredTenants).toBe(0)
    expect(body.skippedTenants).toHaveLength(3)
    expect(ran()).toEqual(['tenant-full'])
    expect(checkpoints).toEqual(['tenant-full'])
  })

  it('an invalid setting stops a promotion job before any tenant work', async () => {
    const { runner, job, findMany, findFirst } = harness(TENANTS, {
      enforcement: 'enforce',
    })
    const response = await runner.runTenantCron(request(), job, {
      job: 'sync-google-merchant',
    })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Tenant cron policy unavailable',
      results: [],
    })
    expect(job).not.toHaveBeenCalled()
    expect(findMany).not.toHaveBeenCalled()
    expect(findFirst).not.toHaveBeenCalled()
  })
})
