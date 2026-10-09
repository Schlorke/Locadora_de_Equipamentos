import type { PlatformTransaction } from '../platform-scope/index'
import {
  purgeProvisioningRequest,
  purgeReasonFor,
} from './provisioning-request'
import { cancelProvisioningShell } from './subaccount-binding'

const BATCH = 50

/**
 * Database-only safety net of the receiving-account requests, installed whether or not the creation is on and
 * without any provider credential (ADR SaaS B.8, decision D-2 of 2026-10-07):
 * 1. purges the declared income and mobile phone of every request whose account can no longer reach
 *    POST /accounts (a dead process, an interrupted inspection);
 * 2. with the creation off (`PLATFORM_SUBACCOUNT_CREATION` absent or `off`) or another configured model, returns
 *    the requests that never reached the provider (`PROVISIONING`) to their owners. With the creation on but its
 *    root credential, webhook origin or vault missing, nothing is cancelled: the requests just wait.
 */
export function createProvisioningRequestsMaintenance(options: {
  transaction: PlatformTransaction
  creation: { enabled: boolean; model: 'STANDARD' | 'BAAS' | null }
  now?: () => Date
}) {
  const now = options.now ?? (() => new Date())
  return {
    async run() {
      const at = now()
      const purged = await options.transaction(async (tx) => {
        const stale = await tx.paymentAccountProvisioningRequest.findMany({
          where: {
            purgedAt: null,
            paymentAccount: {
              OR: [
                { disconnectedAt: { not: null } },
                { status: { notIn: ['PROVISIONING', 'UNKNOWN'] } },
                {
                  status: 'UNKNOWN',
                  NOT: { lastErrorCode: 'SUBACCOUNT_CREATE_PENDING' },
                },
                // An intent whose lease expired: that worker is gone and the POST is never repeated.
                {
                  status: 'UNKNOWN',
                  lastErrorCode: 'SUBACCOUNT_CREATE_PENDING',
                  OR: [{ lockedUntil: null }, { lockedUntil: { lte: at } }],
                },
              ],
            },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: BATCH,
          select: {
            paymentAccountId: true,
            paymentAccount: { select: { status: true } },
          },
        })
        for (const request of stale)
          await purgeProvisioningRequest(
            tx,
            request.paymentAccountId,
            purgeReasonFor(request.paymentAccount.status),
            at
          )
        return stale.length
      })
      const { enabled, model } = options.creation
      if (enabled && !model) return { purged, cancelled: 0 }
      const candidates = await options.transaction((tx) =>
        tx.paymentAccount.findMany({
          where: {
            mode: 'ASAAS_SUBACCOUNT',
            status: 'PROVISIONING',
            disconnectedAt: null,
            ...(enabled ? { subaccountModel: { not: model! } } : {}),
            OR: [{ lockedUntil: null }, { lockedUntil: { lte: at } }],
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: BATCH,
          select: { id: true, tenantId: true },
        })
      )
      let cancelled = 0
      for (const candidate of candidates)
        cancelled += await options.transaction(async (tx) => {
          // Same lock order as the creation worker and the inspection.
          await tx.$queryRaw`SELECT id FROM organizations WHERE id=${candidate.tenantId} FOR UPDATE`
          const first = await tx.paymentAccount.findFirst({
            where: { id: candidate.id, tenantId: candidate.tenantId },
            select: { integrationId: true },
          })
          if (!first) return 0
          await tx.$queryRaw`SELECT id FROM tenant_integrations WHERE id=${first.integrationId} FOR UPDATE`
          await tx.$queryRaw`SELECT id FROM payment_accounts WHERE id=${candidate.id} FOR UPDATE`
          const account = await tx.paymentAccount.findUniqueOrThrow({
            where: { id: candidate.id },
          })
          const current = now()
          // By the creation invariant, a PROVISIONING account never had a POST applied.
          if (
            account.tenantId !== candidate.tenantId ||
            account.integrationId !== first.integrationId ||
            account.mode !== 'ASAAS_SUBACCOUNT' ||
            account.status !== 'PROVISIONING' ||
            account.disconnectedAt ||
            (account.lockedUntil && account.lockedUntil > current) ||
            (enabled && account.subaccountModel === model)
          )
            return 0
          await cancelProvisioningShell(
            tx,
            account,
            enabled ? 'MODEL_CHANGED' : 'CREATION_DISABLED',
            current
          )
          return 1
        })
      return { purged, cancelled }
    },
  }
}
