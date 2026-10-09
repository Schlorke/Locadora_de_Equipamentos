import type { PrismaClient } from '@prisma/client'
import {
  OrganizationAccessSchema,
  SubscriptionEnforcementSchema,
} from '@gb-locacoes/contracts/subscription'
import { requireCronAuthorization } from './cron-authorization'
import type {
  ScheduledTransaction,
  CronBudget,
  ScheduledJobResult,
} from '../runtime/scheduled-job'
export type { CronBudget } from '../runtime/scheduled-job'

/**
 * Every tenant job of both cron hosts and its kind (ADR SaaS B.5 matrix, B.10 "Jobs").
 * `obligation` runs for every ACTIVE organization, whatever its subscription access.
 * `promotion` (divulgação) runs only for FULL when PLATFORM_SUBSCRIPTION_ENFORCEMENT
 * is `on`; `shadow` records the decision and `off` treats everyone as FULL.
 * The Merchant feed is quarantined and does not call the runner yet.
 */
const TENANT_CRON_JOBS = Object.freeze({
  'auto-convert-quotes': 'obligation',
  'boleto-overdue-alerts': 'obligation',
  'expire-quotes': 'obligation',
  'late-fees': 'obligation',
  'preventive-maintenance': 'obligation',
  'send-notifications': 'obligation',
  'verify-boleto-payments': 'obligation',
  'sync-google-merchant': 'promotion',
} as const satisfies Record<string, 'obligation' | 'promotion'>)
type TenantCronJobName = keyof typeof TENANT_CRON_JOBS
/** Checkpoint, time budget and reserve go together: a scheduled run is bounded or refused. */
type CronSchedule = {
  checkpoint: string
  budgetMs: number
  minRemainingMs: number
}
type CronOptions =
  | {
      job: TenantCronJobName
      checkpoint?: never
      budgetMs?: never
      minRemainingMs?: never
    }
  | ({ job: TenantCronJobName } & CronSchedule)
type PromotionAccess = 'SETUP' | 'RESTRICTED' | 'ARCHIVED' | 'INACTIVE'
type ShadowEntry = {
  tenantId: string
  job: TenantCronJobName
  access: PromotionAccess | 'UNAVAILABLE'
}

function declaredJob(options: unknown) {
  const job =
    typeof options === 'object' && options !== null
      ? (options as { job?: unknown }).job
      : undefined
  return typeof job === 'string' &&
    Object.prototype.hasOwnProperty.call(TENANT_CRON_JOBS, job)
    ? {
        name: job as TenantCronJobName,
        kind: TENANT_CRON_JOBS[job as TenantCronJobName],
      }
    : undefined
}

/** The schedule of a declared job: none, complete and finite, or invalid (never unbounded). */
function declaredSchedule(
  options: object
): CronSchedule | undefined | 'invalid' {
  const { checkpoint, budgetMs, minRemainingMs } = options as {
    [key in keyof CronSchedule]?: unknown
  }
  if (
    checkpoint === undefined &&
    budgetMs === undefined &&
    minRemainingMs === undefined
  )
    return undefined
  return typeof checkpoint === 'string' &&
    checkpoint.length > 0 &&
    typeof budgetMs === 'number' &&
    Number.isFinite(budgetMs) &&
    budgetMs > 0 &&
    typeof minRemainingMs === 'number' &&
    Number.isFinite(minRemainingMs) &&
    minRemainingMs >= 0
    ? { checkpoint, budgetMs, minRemainingMs }
    : 'invalid'
}

export function createTenantCron({
  getDatabase,
  withTenantTransaction,
  enforcement,
  shadow,
}: {
  getDatabase: () => PrismaClient
  withTenantTransaction: ScheduledTransaction
  enforcement?: () => string | undefined
  shadow?: (_entry: ShadowEntry) => void
}) {
  /** Subscription access of a tenant for a promotion job, read right before it runs. */
  async function promotionAccess(
    tenantId: string
  ): Promise<'FULL' | PromotionAccess | 'UNAVAILABLE'> {
    try {
      const organization = await getDatabase().organization.findFirst({
        where: { id: tenantId, status: 'ACTIVE' },
        select: { access: true },
      })
      if (!organization) return 'INACTIVE'
      const access = OrganizationAccessSchema.safeParse(organization.access)
      return access.success ? access.data : 'UNAVAILABLE'
    } catch {
      return 'UNAVAILABLE'
    }
  }
  function record(entry: ShadowEntry) {
    try {
      ;(shadow ?? ((value) => console.warn('[tenant-cron-shadow]', value)))(
        entry
      )
    } catch {
      /* Diagnostics cannot enforce observation mode. */
    }
  }
  async function runTenantCron(
    request: Request,
    job: (
      _context: { tenantId: string },
      _budget: CronBudget
    ) => Promise<Response>,
    options: CronOptions
  ): Promise<Response> {
    const denied = requireCronAuthorization(request)
    if (denied) return denied
    const declared = declaredJob(options)
    if (!declared)
      return Response.json(
        {
          success: false,
          error: 'Tenant cron job is not declared',
          results: [],
        },
        { status: 500 }
      )
    const schedule = declaredSchedule(options)
    if (schedule === 'invalid')
      return Response.json(
        {
          success: false,
          error: 'Tenant cron schedule is invalid',
          results: [],
        },
        { status: 500 }
      )
    // Obligation jobs never read the setting nor the access: no state skips them.
    const setting =
      declared.kind === 'promotion'
        ? SubscriptionEnforcementSchema.safeParse(
            enforcement?.() ??
              process.env.PLATFORM_SUBSCRIPTION_ENFORCEMENT ??
              'off'
          )
        : undefined
    if (setting && !setting.success)
      return Response.json(
        {
          success: false,
          error: 'Tenant cron policy unavailable',
          results: [],
        },
        { status: 503 }
      )
    const mode = setting?.data ?? 'off'
    const start = Date.now()
    const budget = {
      deadline: schedule ? start + schedule.budgetMs : Infinity,
      minRemainingMs: schedule?.minRemainingMs ?? 0,
    }
    const organizations = await getDatabase().organization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    })
    const history = new Map<string, number>()
    if (schedule) {
      // Read only scheduling metadata through each tenant's RLS context; no global business query.
      for (let index = 0; index < organizations.length; index += 8) {
        if (Date.now() + budget.minRemainingMs >= budget.deadline)
          return Response.json(
            {
              success: false,
              error: 'Cron scheduling budget exhausted',
              results: [],
              deferredTenants: organizations.length,
            },
            { status: 503 }
          )
        await Promise.all(
          organizations.slice(index, index + 8).map(async (organization) => {
            const checkpoint = await withTenantTransaction(
              { tenantId: organization.id },
              (tx) =>
                tx.auditLog.findFirst({
                  where: {
                    tenantId: organization.id,
                    action: 'CRON_EXECUTION_CHECKPOINT',
                    entity: 'cron',
                    entityId: schedule.checkpoint,
                  },
                  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                  select: { createdAt: true },
                }),
              { timeout: 5000, maxWait: 3000 }
            )
            history.set(organization.id, checkpoint?.createdAt?.getTime() ?? 0)
          })
        )
      }
    }
    const ordered = schedule
      ? [...organizations].sort(
          (a, b) =>
            history.get(a.id)! - history.get(b.id)! || a.id.localeCompare(b.id)
        )
      : organizations
    const results: Array<{
      tenantId: string
      status: number
      result: unknown
    }> = []
    const skipped: Array<{ tenantId: string; access: PromotionAccess }> = []
    for (const organization of ordered) {
      if (Date.now() + budget.minRemainingMs >= budget.deadline) break
      if (mode !== 'off') {
        const access = await promotionAccess(organization.id)
        if (access !== 'FULL') {
          if (mode === 'shadow')
            record({ tenantId: organization.id, job: declared.name, access })
          else if (access === 'UNAVAILABLE') {
            results.push({
              tenantId: organization.id,
              status: 503,
              result: { error: 'Tenant cron policy unavailable' },
            })
            continue
          } else {
            skipped.push({ tenantId: organization.id, access })
            continue
          }
        }
      }
      let outcome: { tenantId: string; status: number; result: unknown }
      try {
        const response = await job({ tenantId: organization.id }, budget)
        outcome = {
          tenantId: organization.id,
          status: response.status,
          result: await response.json(),
        }
      } catch {
        outcome = {
          tenantId: organization.id,
          status: 500,
          result: { error: 'Tenant job failed' },
        }
      }
      if (schedule) {
        try {
          await withTenantTransaction(
            { tenantId: organization.id },
            (tx) =>
              tx.auditLog.create({
                data: {
                  tenantId: organization.id,
                  action: 'CRON_EXECUTION_CHECKPOINT',
                  entity: 'cron',
                  entityId: schedule.checkpoint,
                  changes: { status: outcome.status },
                },
              }),
            { timeout: 5000, maxWait: 3000 }
          )
        } catch {
          outcome = {
            tenantId: organization.id,
            status: 500,
            result: { error: 'Cron checkpoint failed' },
          }
        }
      }
      results.push(outcome)
    }
    const failed = results.some((result) => result.status >= 400)
    return Response.json(
      {
        success: !failed,
        results,
        ...(declared.kind === 'promotion' ? { skippedTenants: skipped } : {}),
        ...(schedule
          ? {
              deferredTenants:
                organizations.length - results.length - skipped.length,
            }
          : {}),
      },
      { status: failed ? 500 : 200 }
    )
  }
  return { runTenantCron }
}
export function scheduledJobResponse(result: ScheduledJobResult): Response {
  return Response.json(result.body, { status: result.status })
}
