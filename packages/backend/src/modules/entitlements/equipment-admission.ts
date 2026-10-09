import {
  EntitlementsV1Schema,
  EntitlementOverrideSchema,
  type AccessError,
} from '@gb-locacoes/contracts/entitlements'
import {
  OrganizationAccessSchema,
  SubscriptionEnforcementSchema,
} from '@gb-locacoes/contracts/subscription'
import {
  avaliarCota,
  direitosEfetivos,
  permiteEscrita,
} from '@gb-locacoes/domain/assinatura'
import type { Prisma } from '@prisma/client'

/** Transported by the catalog adapter without exposing persisted plan data. */
export class EquipmentAdmissionError extends Error {
  constructor(
    readonly status: 402 | 403 | 503,
    readonly body: AccessError | { error: string }
  ) {
    super(body.error)
    this.name = 'EquipmentAdmissionError'
  }
}

const unavailable = () =>
  new EquipmentAdmissionError(503, {
    error: 'Não foi possível verificar os limites do plano.',
  })

/** Called on the mutation connection immediately before INSERT, never on reads/jobs. */
export function createEquipmentAdmission(
  dependencies: {
    enforcement?: () => string | undefined
    now?: () => Date
    shadow?: (_entry: { tenantId: string; code: string }) => void
  } = {}
) {
  const enforcement =
    dependencies.enforcement ??
    (() => process.env.PLATFORM_SUBSCRIPTION_ENFORCEMENT)
  const now = dependencies.now ?? (() => new Date())
  const shadow =
    dependencies.shadow ??
    ((entry) => console.warn('[subscription-shadow]', entry))
  return async (
    tx: Prisma.TransactionClient,
    context: { tenantId: string }
  ) => {
    const parsed = SubscriptionEnforcementSchema.safeParse(
      enforcement() ?? 'off'
    )
    if (!parsed.success) throw unavailable()
    const mode = parsed.data
    if (mode === 'off') return

    const decide = async () => {
      // Projection writers also lock the organization first. This prevents a plan/access
      // change between admission and INSERT; the quota lock remains tenant/resource scoped.
      const rows = await tx.$queryRaw<
        Array<{ id: string; access: string; status: string }>
      >`
        SELECT id, access::text, status::text FROM organizations
        WHERE id = ${context.tenantId} FOR UPDATE
      `
      const organization = rows[0]
      if (!organization || organization.status !== 'ACTIVE') throw unavailable()
      const access = OrganizationAccessSchema.safeParse(organization.access)
      if (!access.success) throw unavailable()
      if (!permiteEscrita(access.data, { configuracao: true })) {
        throw new EquipmentAdmissionError(
          access.data === 'ARCHIVED' ? 403 : 402,
          {
            code:
              access.data === 'ARCHIVED'
                ? 'TENANT_ARCHIVED'
                : 'SUBSCRIPTION_RESTRICTED',
            error:
              access.data === 'ARCHIVED'
                ? 'Esta locadora está arquivada.'
                : 'Sua assinatura permite somente leitura neste momento.',
          }
        )
      }
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.tenantId + ':quota:equipments'}, 0))`
      const subscription = await tx.subscription.findFirst({
        where: { tenantId: context.tenantId, status: { not: 'CANCELED' } },
        select: { planVersion: { select: { entitlements: true } } },
      })
      const base = EntitlementsV1Schema.safeParse(
        subscription?.planVersion.entitlements
      )
      if (!base.success) throw unavailable()
      const instant = now()
      const overrides = await tx.entitlementOverride.findMany({
        where: {
          tenantId: context.tenantId,
          createdAt: { lte: instant },
          OR: [{ revokedAt: null }, { revokedAt: { gt: instant } }],
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
      // The persisted override contract is stricter than the generic domain evaluator
      // (which also accepts zero). Malformed overrides cannot relax a valid plan.
      const valid = overrides.filter(
        (row) =>
          EntitlementOverrideSchema.safeParse({
            key: row.key,
            value: row.value,
          }).success
      )
      const effective = direitosEfetivos(base.data, valid, instant).direitos
      const used = await tx.equipment.count({
        where: { tenantId: context.tenantId },
      })
      const limit = effective.limits.equipments
      if (!avaliarCota(limit, used).permitido && limit !== null) {
        throw new EquipmentAdmissionError(402, {
          error: `Seu plano permite até ${limit} equipamentos (você tem ${used}). Nada foi apagado.`,
          code: 'PLAN_LIMIT_REACHED',
          resource: 'equipments',
          limit,
          used,
        })
      }
    }
    if (mode === 'shadow')
      await tx.$executeRaw`SAVEPOINT equipment_admission_shadow`
    let decisionCode = 'ALLOWED'
    try {
      await decide()
      if (mode === 'shadow')
        await tx.$executeRaw`RELEASE SAVEPOINT equipment_admission_shadow`
    } catch (error) {
      if (mode !== 'shadow')
        throw error instanceof EquipmentAdmissionError ? error : unavailable()
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT equipment_admission_shadow`
      await tx.$executeRaw`RELEASE SAVEPOINT equipment_admission_shadow`
      decisionCode =
        error instanceof EquipmentAdmissionError && 'code' in error.body
          ? error.body.code
          : 'SUBSCRIPTION_POLICY_UNAVAILABLE'
    }
    if (mode === 'shadow') {
      try {
        shadow({ tenantId: context.tenantId, code: decisionCode })
      } catch {
        // A diagnostic sink cannot turn observation into enforcement.
      }
    }
  }
}
