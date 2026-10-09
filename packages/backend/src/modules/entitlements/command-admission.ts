import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type {
  AccessError,
  EntitlementFeature,
} from '@gb-locacoes/contracts/entitlements'
import type { DeliveryPatch } from '@gb-locacoes/contracts/operations'
import {
  OrganizationAccessSchema,
  SubscriptionEnforcementSchema,
} from '@gb-locacoes/contracts/subscription'
import { recursoNoPlano } from '@gb-locacoes/domain/assinatura'
import { readEffectiveRights } from './effective-rights'
import { isOngoingPayment } from './ongoing-payment'
import { isDeliveryCompletion } from './delivery-completion'
import {
  rentalReturn,
  rentalClose,
  paymentSettlement,
} from './obligation-mutations'
import { RentalMutationError } from '../rentals/errors'

export class SubscriptionCommandError extends Error {
  constructor(
    public readonly status: 402 | 403 | 503,
    public readonly body: AccessError | { error: string }
  ) {
    super(body.error)
  }
}
const unavailable = () =>
  new SubscriptionCommandError(503, {
    error: 'Não foi possível verificar o acesso da assinatura.',
  })
const restricted = () =>
  new SubscriptionCommandError(402, {
    error: 'Sua assinatura não permite esta operação neste momento.',
    code: 'SUBSCRIPTION_RESTRICTED',
  })

/** Manual commands only. Accepted outbox effects and reconciliation bypass this boundary. */
export function createSubscriptionCommandAccess(
  options: {
    enforcement?: () => string | undefined
    now?: () => Date
    shadow?: (_entry: { tenantId: string; code: string }) => void
  } = {}
) {
  return async (
    tx: Prisma.TransactionClient,
    context: TenantContext & { userId?: string },
    operation: {
      feature?: EntitlementFeature
      payment?: { rentalId?: string | null; quoteId?: string | null }
      delivery?: DeliveryPatch
      rentalReturn?: unknown
      rentalClose?: unknown
      settlement?: unknown
      reissuePaymentId?: string
      ownProfileUserId?: string
    }
  ) => {
    const parsed = SubscriptionEnforcementSchema.safeParse(
      options.enforcement?.() ??
        process.env.PLATFORM_SUBSCRIPTION_ENFORCEMENT ??
        'off'
    )
    if (!parsed.success) throw unavailable()
    if (parsed.data === 'off') return
    const decide = async () => {
      // Subscription writers take this same lock before projecting access or changing plans.
      // Keep it until the caller's INSERT/UPDATE and transaction commit.
      const [org] = await tx.$queryRaw<
        { id: string; status: string; access: string }[]
      >`
        SELECT id, status, access FROM organizations WHERE id = ${context.tenantId} FOR UPDATE
      `
      if (!org || org.status !== 'ACTIVE')
        throw new SubscriptionCommandError(403, {
          error: 'Organization access denied',
        })
      const access = OrganizationAccessSchema.safeParse(org.access)
      if (!access.success) throw unavailable()
      if (access.data === 'ARCHIVED')
        throw new SubscriptionCommandError(403, {
          error: 'Esta locadora está arquivada.',
          code: 'TENANT_ARCHIVED',
        })
      if (
        operation.ownProfileUserId &&
        operation.ownProfileUserId === context.userId
      )
        return
      if (access.data === 'SETUP') throw restricted()
      if (operation.delivery && isDeliveryCompletion(operation.delivery)) return
      if (
        (operation.rentalReturn !== undefined &&
          rentalReturn.safeParse(operation.rentalReturn).success) ||
        (operation.rentalClose !== undefined &&
          rentalClose.safeParse(operation.rentalClose).success) ||
        (operation.settlement !== undefined &&
          paymentSettlement.safeParse(operation.settlement).success)
      )
        return
      if (
        operation.reissuePaymentId &&
        (await tx.payment.findFirst({
          where: {
            id: operation.reissuePaymentId,
            tenantId: context.tenantId,
            method: 'BOLETO',
            status: { in: ['PENDING', 'OVERDUE'] },
          },
          select: { id: true },
        }))
      )
        return
      if (access.data === 'RESTRICTED') {
        if (
          operation.payment &&
          (await isOngoingPayment(tx, context.tenantId, operation.payment))
        )
          return
        throw restricted()
      }
      const rights = await readEffectiveRights(
        tx,
        context.tenantId,
        options.now?.() ?? new Date()
      )
      if (!rights) throw unavailable()
      if (operation.feature && !recursoNoPlano(rights, operation.feature))
        throw new SubscriptionCommandError(402, {
          error: 'Este módulo não está disponível no seu plano.',
          code: 'MODULE_NOT_IN_PLAN',
          feature: operation.feature,
        })
    }
    const shadow = parsed.data === 'shadow'
    if (shadow) await tx.$executeRaw`SAVEPOINT subscription_command_shadow`
    let code = 'ALLOWED'
    try {
      await decide()
      if (shadow)
        await tx.$executeRaw`RELEASE SAVEPOINT subscription_command_shadow`
    } catch (error) {
      if (!shadow)
        throw error instanceof SubscriptionCommandError ? error : unavailable()
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT subscription_command_shadow`
      await tx.$executeRaw`RELEASE SAVEPOINT subscription_command_shadow`
      code =
        error instanceof SubscriptionCommandError && 'code' in error.body
          ? error.body.code
          : 'SUBSCRIPTION_POLICY_UNAVAILABLE'
    }
    if (shadow) {
      try {
        ;(
          options.shadow ??
          ((entry) => console.warn('[subscription-command-shadow]', entry))
        )({ tenantId: context.tenantId, code })
      } catch {
        /* Diagnostics cannot enforce observation mode. */
      }
    }
  }
}

/** Preserve the public rental/financial error contract for manual commands. */
export async function admitRentalCommand(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  operation: Parameters<ReturnType<typeof createSubscriptionCommandAccess>>[2]
) {
  try {
    await createSubscriptionCommandAccess()(tx, context, operation)
  } catch (error) {
    if (!(error instanceof SubscriptionCommandError)) throw error
    throw new RentalMutationError(
      error.message,
      error.status,
      'code' in error.body
        ? error.body.code
        : 'subscription_policy_unavailable',
      undefined,
      error.body
    )
  }
}
