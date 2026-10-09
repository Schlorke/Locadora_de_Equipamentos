import type { Prisma } from '@prisma/client'
import type { AccessError } from '@gb-locacoes/contracts/entitlements'

/** 409 body of `PaymentAccountNotReadyErrorSchema` (ADR SaaS B.7.6). */
const RECEIVING_ACCOUNT_NOT_READY = {
  error: 'A conta de recebimentos ainda não está pronta para emitir cobranças.',
  code: 'PAYMENT_ACCOUNT_NOT_READY',
} as const satisfies AccessError

export class ReceivingAccountNotReadyError extends Error {
  readonly status = 409
  readonly body = RECEIVING_ACCOUNT_NOT_READY
  constructor() {
    super(RECEIVING_ACCOUNT_NOT_READY.error)
  }
}

/**
 * Charge barrier of the receiving account (ADR SaaS B.7.6, S9 exit criterion in B.16). Runs in the caller's tenant
 * transaction, before any integration is selected. A company without a current receiving account (legacy
 * environment reference) and a connected account keep their current rules; a subaccount issues new charges only
 * while approved, with its annual commercial data valid and its integration active.
 */
export async function assertReceivingAccountReady(
  tx: Prisma.TransactionClient,
  tenantId: string
) {
  const account = await tx.paymentAccount.findFirst({
    where: { tenantId, disconnectedAt: null },
    select: {
      mode: true,
      status: true,
      commercialInfoExpired: true,
      integration: { select: { status: true } },
    },
  })
  if (!account || account.mode !== 'ASAAS_SUBACCOUNT') return
  if (
    account.status !== 'APPROVED' ||
    account.commercialInfoExpired ||
    account.integration.status !== 'ACTIVE'
  )
    throw new ReceivingAccountNotReadyError()
}
