import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { normalizarCnpj, validarCnpj } from '@gb-locacoes/domain/documento'
import type { createAsaasSubaccounts } from '../billing/index'
import {
  enqueuePlatformOutbox,
  RetryDeliveryAtError,
  type OutboxMessage,
} from '../outbox/index'
import type { PlatformTransaction } from '../platform-scope/index'
import { readActiveAsaasKeyIdentity } from '../secrets/index'
import { purgeProvisioningRequest } from './provisioning-request'
import {
  bindObservedSubaccount,
  blockProvisioning,
  classifyLookupFailure,
} from './subaccount-binding'

export const PROVISIONING_RECOVERY_TOPIC =
  'payment-accounts.provisioning-recovery'
const TOPIC = PROVISIONING_RECOVERY_TOPIC
const RETRY_MS = 300_000
const ROOT_RETRY_MS = 3_600_000
const include = { integration: true, organization: true } as const
type Account = Prisma.PaymentAccountGetPayload<{ include: typeof include }>
const messageSchema = z.strictObject({ accountId: z.string().min(1).max(128) })

/** After a persisted uncertain creation, inspect with the root credential only. This port cannot POST or obtain a key. */
export function createUncertainSubaccountRecovery(options: {
  transaction: PlatformTransaction
  environment: 'sandbox' | 'production'
  provider: Pick<ReturnType<typeof createAsaasSubaccounts>, 'find'>
  now?: () => Date
}) {
  if (!['sandbox', 'production'].includes(options.environment))
    throw new Error('SUBACCOUNT_CONFIGURATION_INVALID')
  const now = options.now ?? (() => new Date())
  function eligible(account: Account) {
    return (
      account.mode === 'ASAAS_SUBACCOUNT' &&
      account.status === 'UNKNOWN' &&
      account.provisioningAttempts > 0 &&
      !account.disconnectedAt &&
      account.environment === options.environment &&
      account.organization.status === 'ACTIVE' &&
      account.organization.access !== 'ARCHIVED' &&
      !!account.requestedByUserId &&
      account.organization.ownerUserId === account.requestedByUserId &&
      account.integration.tenantId === account.tenantId &&
      account.integration.provider === 'ASAAS' &&
      account.integration.environment === options.environment &&
      account.integration.credentialSource === 'VAULT' &&
      account.integration.status === 'PROVISIONING'
    )
  }
  function documentOf(account: Account) {
    const document =
      account.organization.documentNormalized ?? account.organization.document
    if (
      !document ||
      !validarCnpj(document) ||
      (account.organization.document &&
        normalizarCnpj(account.organization.document) !==
          normalizarCnpj(document))
    )
      return null
    return normalizarCnpj(document)
  }
  const keyOf = (tx: Prisma.TransactionClient, account: Account) =>
    readActiveAsaasKeyIdentity(
      tx,
      {
        tenantId: account.tenantId,
        integrationId: account.integrationId,
        environment: account.environment,
      },
      { lock: true }
    )
  async function locked<T>(
    id: string,
    tenantId: string,
    operation: (tx: Prisma.TransactionClient, account: Account) => Promise<T>
  ) {
    return options.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id=${tenantId} FOR UPDATE`
      const first = await tx.paymentAccount.findFirst({
        where: { id, tenantId },
        include,
      })
      if (!first) return null
      await tx.$queryRaw`SELECT id FROM tenant_integrations WHERE id=${first.integrationId} FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payment_accounts WHERE id=${id} FOR UPDATE`
      const current = await tx.paymentAccount.findUniqueOrThrow({
        where: { id },
        include,
      })
      if (
        current.tenantId !== tenantId ||
        current.integrationId !== first.integrationId
      )
        return null
      return operation(tx, current)
    })
  }
  /** Review state; the declared values of the request are purged in the same transaction. */
  const blocked = (
    tx: Prisma.TransactionClient,
    account: Account,
    code: string
  ) => blockProvisioning(tx, account, code, now())
  const handler = async (
    message: OutboxMessage<string | null>
  ): Promise<void> => {
    const parsed = messageSchema.safeParse(message.payload)
    if (
      !parsed.success ||
      parsed.data.accountId !== message.aggregateId ||
      !message.tenantId
    )
      throw new Error('INVALID_ACCOUNT_MESSAGE')
    const id = parsed.data.accountId
    const work = await locked(id, message.tenantId, async (tx, account) => {
      if (!eligible(account) || (await keyOf(tx, account))) return null
      if (account.nextAttemptAt > now())
        throw new RetryDeliveryAtError(account.nextAttemptAt, 'ACCOUNT_NOT_DUE')
      if (account.lockedUntil && account.lockedUntil > now())
        throw new RetryDeliveryAtError(account.lockedUntil, 'ACCOUNT_BUSY')
      const document = documentOf(account)
      if (!document) {
        await blocked(tx, account, 'ACCOUNT_DOCUMENT_MISMATCH')
        return null
      }
      // From here on this account never reaches POST /accounts again: the declared values have no use left.
      await purgeProvisioningRequest(tx, id, 'UNCERTAIN', now())
      const claimed = await tx.paymentAccount.update({
        where: { id },
        data: {
          lockedUntil: new Date(now().getTime() + RETRY_MS),
          provisioningAttempts: { increment: 1 },
        },
        include,
      })
      return { account: claimed, document }
    })
    if (!work) return
    let found: Awaited<ReturnType<typeof options.provider.find>> = null
    let failure: ReturnType<typeof classifyLookupFailure> | null = null
    try {
      found = await options.provider.find(work.document)
    } catch (error) {
      failure = classifyLookupFailure(error)
    }
    await locked(id, message.tenantId, async (tx, account) => {
      // A changed tenant, owner, credential, administrative block or newer worker always wins over late I/O.
      if (
        !eligible(account) ||
        account.updatedAt.getTime() !== work.account.updatedAt.getTime() ||
        account.provisioningAttempts !== work.account.provisioningAttempts ||
        account.integration.updatedAt.getTime() !==
          work.account.integration.updatedAt.getTime() ||
        account.organization.updatedAt.getTime() !==
          work.account.organization.updatedAt.getTime() ||
        documentOf(account) !== work.document ||
        (await keyOf(tx, account))
      )
        return
      // Only untrustworthy evidence goes to review; a refused root credential is the platform's problem.
      if (failure?.kind === 'INVALID')
        return blocked(tx, account, 'SUBACCOUNT_LOOKUP_INVALID')
      if (!found) {
        const nextAttemptAt = new Date(
          now().getTime() +
            (failure?.kind === 'ROOT_REJECTED' ? ROOT_RETRY_MS : RETRY_MS)
        )
        await tx.paymentAccount.update({
          where: { id },
          data: {
            status: 'UNKNOWN',
            lockedUntil: null,
            nextAttemptAt,
            lastErrorCode:
              failure?.kind === 'ROOT_REJECTED'
                ? 'ROOT_CREDENTIAL_REJECTED'
                : failure
                  ? 'SUBACCOUNT_LOOKUP_UNAVAILABLE'
                  : 'SUBACCOUNT_NOT_OBSERVED',
          },
        })
        if (failure?.kind === 'ROOT_REJECTED')
          await tx.platformAuditLog.create({
            data: {
              actorKind: 'SYSTEM',
              action: 'payment-account.provisioning.root-rejected',
              tenantId: account.tenantId,
              targetType: 'PaymentAccount',
              targetId: id,
              reasonCategory: failure.reason,
            },
          })
        await enqueuePlatformOutbox(tx, {
          tenantId: account.tenantId,
          topic: TOPIC,
          aggregateId: id,
          payload: { accountId: id },
          availableAt: nextAttemptAt,
          dedupeKey:
            'subaccount-recovery:' + id + ':' + nextAttemptAt.toISOString(),
        })
        return
      }
      await bindObservedSubaccount(tx, account, found, {
        document: work.document,
        code: 'SUBACCOUNT_KEY_RECOVERY_REQUIRED',
        purgeReason: 'UNCERTAIN',
        at: now(),
      })
    })
  }
  return {
    handlers: { [TOPIC]: handler },
    enqueue: () =>
      options.transaction(async (tx) => {
        const accounts = await tx.paymentAccount.findMany({
          where: {
            mode: 'ASAAS_SUBACCOUNT',
            status: 'UNKNOWN',
            provisioningAttempts: { gt: 0 },
            environment: options.environment,
            disconnectedAt: null,
            nextAttemptAt: { lte: now() },
            OR: [{ lockedUntil: null }, { lockedUntil: { lte: now() } }],
            organization: { status: 'ACTIVE', access: { not: 'ARCHIVED' } },
            integration: {
              provider: 'ASAAS',
              credentialSource: 'VAULT',
              environment: options.environment,
              status: 'PROVISIONING',
            },
          },
          orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }],
          take: 20,
          include,
        })
        let count = 0
        for (const account of accounts) {
          if (!eligible(account) || (await keyOf(tx, account))) continue
          await enqueuePlatformOutbox(tx, {
            tenantId: account.tenantId,
            topic: TOPIC,
            aggregateId: account.id,
            payload: { accountId: account.id },
            availableAt: account.nextAttemptAt,
            dedupeKey:
              'subaccount-recovery:' +
              account.id +
              ':' +
              account.nextAttemptAt.toISOString(),
          })
          count++
        }
        return count
      }),
  }
}
