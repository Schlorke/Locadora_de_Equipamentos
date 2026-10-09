import type { Prisma } from '@prisma/client'
import {
  PaymentAccountResponseSchema,
  type PaymentAccountResponse,
} from '@gb-locacoes/contracts/payment-account'
import type { TenantPrincipal } from '../identity/index'
import {
  createOwnerSubscriptionSnapshot,
  OwnerSubscriptionReadError,
} from '../subscriptions/index'

const select = {
  mode: true,
  subaccountModel: true,
  status: true,
  environment: true,
  healthIssue: true,
  generalStatus: true,
  commercialInfoExpiresAt: true,
  commercialInfoExpired: true,
  approvedAt: true,
  lastSyncedAt: true,
  integration: { select: { status: true } },
} satisfies Prisma.PaymentAccountSelect

const providerMessages: Readonly<Record<string, string>> = {
  APPROVED: 'Dados aprovados pela instituição de pagamentos.',
  AWAITING_APPROVAL: 'Dados em análise pela instituição de pagamentos.',
  PENDING: 'Existem dados pendentes de confirmação.',
  REJECTED: 'Os dados precisam de correção junto à instituição de pagamentos.',
}

/** Current ownership and the public projection share the existing tenant RLS snapshot. */
export function createOwnerPaymentAccountReader(
  ports: Parameters<typeof createOwnerSubscriptionSnapshot>[0]
) {
  const snapshot = createOwnerSubscriptionSnapshot(ports)
  return (principal: TenantPrincipal): Promise<PaymentAccountResponse> => {
    if (principal.role !== 'ADMIN')
      return Promise.reject(
        new OwnerSubscriptionReadError(403, 'OWNER_REQUIRED')
      )
    return snapshot(principal, async (tx) => {
      const account = await tx.paymentAccount.findFirst({
        where: { tenantId: principal.tenantId, disconnectedAt: null },
        select,
      })
      if (!account) return { account: null }
      // Do not present stale approval as usable after a health/integration restriction.
      const restricted =
        account.commercialInfoExpired ||
        account.healthIssue !== null ||
        account.integration.status !== 'ACTIVE'
      return PaymentAccountResponseSchema.parse({
        account: {
          kind:
            account.mode === 'ASAAS_CONNECTED_ACCOUNT'
              ? 'CONNECTED'
              : account.subaccountModel,
          status:
            account.status === 'APPROVED' && restricted
              ? 'RESTRICTED'
              : account.status,
          environment: account.environment,
          healthIssue: account.commercialInfoExpired
            ? 'COMMERCIAL_INFO_EXPIRED'
            : account.healthIssue,
          // Provider payloads/errors are never echoed, even when stored in status fields.
          providerStatusText: Object.hasOwn(
            providerMessages,
            account.generalStatus ?? ''
          )
            ? providerMessages[account.generalStatus!]
            : null,
          commercialInfoExpiresAt:
            account.commercialInfoExpiresAt?.toISOString() ?? null,
          commercialInfoExpired: account.commercialInfoExpired,
          approvedAt: account.approvedAt?.toISOString() ?? null,
          lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
        },
      })
    })
  }
}
