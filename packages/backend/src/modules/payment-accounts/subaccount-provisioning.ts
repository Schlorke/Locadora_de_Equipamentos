import { createHash, randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import {
  AsaasSecretValue,
  BillingProviderError,
  checkSubaccountInput,
  type AsaasSubaccountInput,
  type createAsaasSubaccounts,
} from '../billing/index'
import {
  enqueuePlatformOutbox,
  RetryDeliveryAtError,
  type OutboxMessage,
} from '../outbox/index'
import type { PlatformTransaction } from '../platform-scope/index'
import {
  hasActiveFingerprint,
  readActiveAsaasKeyIdentity,
  type createSecretVault,
} from '../secrets/index'
import { accountWebhookTarget } from './account-webhook-target'
import { SUBACCOUNT_PROVISIONING_TOPIC } from './owner-create'
import { purgeProvisioningRequest } from './provisioning-request'
import {
  bindObservedSubaccount,
  blockProvisioning,
  cancelProvisioningShell,
  classifyLookupFailure,
  observedReferenceProblem,
  type ObservedSubaccount,
} from './subaccount-binding'
import { documentInUse, readSubaccountCompany } from './subaccount-company'
import { PROVISIONING_RECOVERY_TOPIC } from './uncertain-provisioning'

const HEALTH_TOPIC = 'payment-accounts.health'
const LEASE_MS = 300_000
const ROOT_RETRY_MS = 3_600_000
const HEALTH_DELAY_MS = 15_000
/** New attempts to seal a received key after the first one (ADR SaaS R-3: the key is shown only once). */
const SEAL_RETRIES = 3
const include = { integration: true, organization: true } as const
type Account = Prisma.PaymentAccountGetPayload<{ include: typeof include }>
type Created = Awaited<
  ReturnType<ReturnType<typeof createAsaasSubaccounts>['create']>
>
const messageSchema = z.strictObject({ accountId: z.string().min(1).max(128) })

/**
 * Creation worker of the receiving account (ADR SaaS B.7.2). Order: GET by CNPJ; durable intent under the CNPJ lock
 * (UNKNOWN, webhook token hash and the inspection already queued); one POST; the returned key sealed in the vault
 * as the first I/O after the response. An uncertain result never repeats the POST: the GET-only inspection
 * (`payment-accounts.provisioning-recovery`) takes over. The queue carries only the account id.
 */
export function createSubaccountProvisioning(options: {
  transaction: PlatformTransaction
  environment: 'sandbox' | 'production'
  model: 'STANDARD' | 'BAAS'
  /** Webhook origin and operations e-mail of the platform (same as the health worker). */
  origin: string
  email: string
  provider: Pick<ReturnType<typeof createAsaasSubaccounts>, 'find' | 'create'>
  vault: Pick<
    ReturnType<typeof createSecretVault>,
    'store' | 'activate' | 'fingerprint'
  >
  /** Canonical site of a company, from its slug. */
  site(slug: string): string
  /** Random webhook token of the creation (32 bytes, base64url); replaced by the recoverable token on first PUT. */
  token?: () => AsaasSecretValue
  now?: () => Date
  sleep?: (ms: number) => Promise<void>
}) {
  const origin = new URL(options.origin)
  if (
    origin.protocol !== 'https:' ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(options.email) ||
    !['sandbox', 'production'].includes(options.environment) ||
    !['STANDARD', 'BAAS'].includes(options.model)
  )
    throw new Error('SUBACCOUNT_CONFIGURATION_INVALID')
  const now = options.now ?? (() => new Date())
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const token =
    options.token ??
    (() => new AsaasSecretValue(randomBytes(32).toString('base64url')))
  const later = (at: Date, ms: number, retryAfterSeconds?: number | null) =>
    new Date(at.getTime() + Math.max(ms, (retryAfterSeconds ?? 0) * 1000))
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
  function integrationReady(account: Account) {
    return (
      account.integration.tenantId === account.tenantId &&
      account.integration.provider === 'ASAAS' &&
      account.integration.credentialSource === 'VAULT' &&
      account.integration.environment === options.environment &&
      account.integration.status === 'PROVISIONING'
    )
  }
  function claimable(account: Account) {
    return (
      account.mode === 'ASAAS_SUBACCOUNT' &&
      account.status === 'PROVISIONING' &&
      !account.disconnectedAt &&
      account.environment === options.environment &&
      integrationReady(account)
    )
  }
  /** Locks in the order of the inspection: organization, integration, account, request. */
  async function locked<T>(
    id: string,
    tenantId: string,
    operation: (tx: Prisma.TransactionClient, account: Account) => Promise<T>
  ) {
    return options.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id=${tenantId} FOR UPDATE`
      const first = await tx.paymentAccount.findFirst({
        where: { id, tenantId },
        select: { integrationId: true },
      })
      if (!first) return null
      await tx.$queryRaw`SELECT id FROM tenant_integrations WHERE id=${first.integrationId} FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payment_accounts WHERE id=${id} FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payment_account_provisioning_requests WHERE "paymentAccountId"=${id} FOR UPDATE`
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
  async function liveRequest(tx: Prisma.TransactionClient, id: string) {
    const request = await tx.paymentAccountProvisioningRequest.findUnique({
      where: { paymentAccountId: id },
    })
    return request &&
      !request.purgedAt &&
      request.incomeValue &&
      request.mobilePhone
      ? {
          incomeValue: request.incomeValue,
          mobilePhone: request.mobilePhone,
          version: request.companyDataVersion,
        }
      : null
  }
  /** Root credential refused by the provider: never the company's fault; nothing is blocked or purged. */
  async function rootRejected(
    tx: Prisma.TransactionClient,
    account: Account,
    status: 'PROVISIONING' | 'UNKNOWN',
    reason: string,
    at: Date
  ) {
    await tx.paymentAccount.update({
      where: { id: account.id },
      data: {
        status,
        lastErrorCode: 'ROOT_CREDENTIAL_REJECTED',
        lockedUntil: null,
        nextAttemptAt: later(at, ROOT_RETRY_MS),
      },
    })
    // The token of a request that was not sent is regenerated on the next attempt (ADR SaaS B.7.2).
    await tx.tenantIntegration.update({
      where: { id: account.integrationId },
      data: { webhookTokenHash: null },
    })
    await tx.platformAuditLog.create({
      data: {
        actorKind: 'SYSTEM',
        action: 'payment-account.provisioning.root-rejected',
        tenantId: account.tenantId,
        targetType: 'PaymentAccount',
        targetId: account.id,
        reasonCategory: reason,
      },
    })
  }

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
    const id = parsed.data.accountId,
      tenantId = message.tenantId

    // B. Claim: everything that would cancel the request is decided before any provider call.
    const claim = await locked(id, tenantId, async (tx, account) => {
      if (!claimable(account) || (await keyOf(tx, account))) return null
      const at = now()
      if (account.nextAttemptAt > at) return null
      if (account.lockedUntil && account.lockedUntil > at)
        throw new RetryDeliveryAtError(account.lockedUntil, 'ACCOUNT_BUSY')
      if (account.organization.status !== 'ACTIVE') {
        // Administrative block: no provider call. A new instant gives the sweep a new delivery once lifted.
        await tx.paymentAccount.update({
          where: { id },
          data: { nextAttemptAt: later(at, LEASE_MS) },
        })
        return null
      }
      if (account.organization.access === 'ARCHIVED') {
        await cancelProvisioningShell(tx, account, 'TENANT_ARCHIVED', at)
        return null
      }
      if (
        !account.requestedByUserId ||
        account.organization.ownerUserId !== account.requestedByUserId
      ) {
        await cancelProvisioningShell(tx, account, 'OWNER_CHANGED', at)
        return null
      }
      if (account.subaccountModel !== options.model) {
        await cancelProvisioningShell(tx, account, 'MODEL_CHANGED', at)
        return null
      }
      const request = await liveRequest(tx, id)
      if (!request) {
        await blockProvisioning(tx, account, 'PROVISIONING_REQUEST_MISSING', at)
        return null
      }
      const data = await readSubaccountCompany(
        tx,
        account.tenantId,
        account.requestedByUserId,
        options.site
      )
      if (!data || data.version !== request.version) {
        await cancelProvisioningShell(tx, account, 'COMPANY_DATA_CHANGED', at)
        return null
      }
      const claimed = await tx.paymentAccount.update({
        where: { id },
        data: {
          lockedUntil: later(at, LEASE_MS),
          // The claim instant: a delivery lost after a crash is re-created by the sweep under a new key.
          nextAttemptAt: at,
          provisioningAttempts: { increment: 1 },
        },
        include,
      })
      return { account: claimed, document: data.company.cpfCnpj }
    })
    if (!claim) return

    // C. Lookup by CNPJ with the root credential, outside any transaction.
    let found: ObservedSubaccount | null = null,
      lookupFailure: unknown = null
    try {
      found = await options.provider.find(claim.document)
    } catch (error) {
      lookupFailure = error ?? new Error('SUBACCOUNT_LOOKUP_FAILED')
    }

    // D. Durable intent, under the CNPJ lock and with compare-and-set on the claim.
    const intent = await locked(id, tenantId, async (tx, account) => {
      const at = now()
      const ours =
        claimable(account) &&
        account.provisioningAttempts === claim.account.provisioningAttempts &&
        account.lockedUntil?.getTime() === claim.account.lockedUntil?.getTime()
      if (!ours || (await keyOf(tx, account))) return null
      if (
        account.updatedAt.getTime() !== claim.account.updatedAt.getTime() ||
        account.integration.updatedAt.getTime() !==
          claim.account.integration.updatedAt.getTime() ||
        account.organization.updatedAt.getTime() !==
          claim.account.organization.updatedAt.getTime()
      ) {
        // Something changed during the lookup: release now; the next claim validates everything again.
        await tx.paymentAccount.update({
          where: { id },
          data: { lockedUntil: null, nextAttemptAt: at },
        })
        return null
      }
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`subaccount-document:${claim.document}`},0))`
      // The first durable intent for a CNPJ wins; a second company is returned to its owner without a POST.
      if (await documentInUse(tx, account.tenantId, claim.document, 'intent')) {
        await cancelProvisioningShell(tx, account, 'DOCUMENT_IN_USE', at)
        return null
      }
      if (lookupFailure) {
        const failure = classifyLookupFailure(lookupFailure)
        if (failure.kind === 'INVALID')
          await blockProvisioning(tx, account, 'SUBACCOUNT_LOOKUP_INVALID', at)
        else if (failure.kind === 'ROOT_REJECTED')
          await rootRejected(tx, account, 'PROVISIONING', failure.reason, at)
        else
          await tx.paymentAccount.update({
            where: { id },
            data: {
              lastErrorCode: 'SUBACCOUNT_LOOKUP_UNAVAILABLE',
              lockedUntil: null,
              nextAttemptAt: later(at, LEASE_MS, failure.retryAfterSeconds),
            },
          })
        return null
      }
      if (found) {
        await bindObservedSubaccount(tx, account, found, {
          document: claim.document,
          code: 'SUBACCOUNT_KEY_RECOVERY_REQUIRED',
          purgeReason: 'EXISTING_ACCOUNT',
          at,
        })
        return null
      }
      const request = await liveRequest(tx, id)
      if (!request) {
        await blockProvisioning(tx, account, 'PROVISIONING_REQUEST_MISSING', at)
        return null
      }
      const data = account.requestedByUserId
        ? await readSubaccountCompany(
            tx,
            account.tenantId,
            account.requestedByUserId,
            options.site
          )
        : null
      if (
        !data ||
        data.version !== request.version ||
        data.company.cpfCnpj !== claim.document
      ) {
        await cancelProvisioningShell(tx, account, 'COMPANY_DATA_CHANGED', at)
        return null
      }
      const webhookToken = token()
      const input: AsaasSubaccountInput = {
        ...data.company,
        mobilePhone: request.mobilePhone,
        incomeValue: request.incomeValue,
        webhook: {
          ...accountWebhookTarget(origin, account.integrationId),
          email: options.email,
          token: webhookToken,
        },
      }
      try {
        checkSubaccountInput(input)
      } catch (error) {
        if (!(error instanceof BillingProviderError)) throw error
        await cancelProvisioningShell(tx, account, 'COMPANY_DATA_CHANGED', at)
        return null
      }
      const nextAttemptAt = later(at, LEASE_MS)
      await tx.tenantIntegration.update({
        where: { id: account.integrationId },
        data: {
          webhookTokenHash: webhookToken.use((value) =>
            createHash('sha256').update(value).digest('hex')
          ),
        },
      })
      const pending = await tx.paymentAccount.update({
        where: { id },
        data: {
          status: 'UNKNOWN',
          lastErrorCode: 'SUBACCOUNT_CREATE_PENDING',
          lockedUntil: nextAttemptAt,
          nextAttemptAt,
        },
      })
      // The GET-only inspection is queued before the POST: a process that dies now never leaves it untracked.
      await enqueuePlatformOutbox(tx, {
        tenantId: account.tenantId,
        topic: PROVISIONING_RECOVERY_TOPIC,
        aggregateId: id,
        payload: { accountId: id },
        availableAt: nextAttemptAt,
        dedupeKey:
          'subaccount-recovery:' + id + ':' + nextAttemptAt.toISOString(),
      })
      await tx.platformAuditLog.create({
        data: {
          actorKind: 'SYSTEM',
          action: 'payment-account.provisioning.create-requested',
          tenantId: account.tenantId,
          targetType: 'PaymentAccount',
          targetId: id,
          reasonCategory: account.subaccountModel,
        },
      })
      return {
        input,
        attempts: pending.provisioningAttempts,
        integrationId: account.integrationId,
      }
    })
    if (!intent) return

    // E. The only POST /accounts of this intent.
    let created: Created | null = null,
      postFailure: unknown = null
    try {
      created = await options.provider.create(intent.input)
    } catch (error) {
      postFailure = error ?? new Error('SUBACCOUNT_CREATE_FAILED')
    }
    /** Late transitions only from this intent: still UNKNOWN + CREATE_PENDING with the same attempt. */
    const pendingIntent = intent
    const afterPost = (
      operation: (
        tx: Prisma.TransactionClient,
        account: Account
      ) => Promise<void>
    ) =>
      locked(id, tenantId, async (tx, account) => {
        if (
          account.status !== 'UNKNOWN' ||
          account.lastErrorCode !== 'SUBACCOUNT_CREATE_PENDING' ||
          account.provisioningAttempts !== pendingIntent.attempts ||
          account.integrationId !== pendingIntent.integrationId ||
          account.disconnectedAt
        )
          return
        await operation(tx, account)
      })
    const observedOf = (result: Created): ObservedSubaccount => ({
      id: result.id,
      document: claim.document,
      walletId: result.walletId,
    })

    // F. A received key is sealed before anything else (no other I/O, log or queue first).
    const sealed = created?.credential
    if (created && sealed) {
      await seal(created, sealed)
      return
    }

    if (created) {
      // Created without a key: bind the references and require manual key recovery.
      const observed = observedOf(created)
      await afterPost(async (tx, account) => {
        await bindObservedSubaccount(tx, account, observed, {
          document: claim.document,
          code: 'SUBACCOUNT_KEY_RECOVERY_REQUIRED',
          purgeReason: 'CREATED',
          at: now(),
        })
      })
      return
    }
    const error = postFailure
    if (
      error instanceof BillingProviderError &&
      !error.maybeApplied &&
      error.code === 'REJECTED'
    ) {
      await afterPost(async (tx, account) => {
        const at = now()
        if (error.reason === 'AUTHENTICATION' || error.reason === 'NOT_FOUND')
          await rootRejected(tx, account, 'PROVISIONING', error.reason, at)
        else if (
          error.reason === 'VALIDATION' ||
          error.reason === 'CLIENT_ERROR' ||
          error.reason === 'FORBIDDEN'
        )
          // Definite refusal without a created account (D-3): returned to the owner with the reason category.
          await cancelProvisioningShell(
            tx,
            account,
            error.reason === 'FORBIDDEN'
              ? 'SUBACCOUNT_CREATE_FORBIDDEN'
              : 'SUBACCOUNT_CREATE_REJECTED',
            at,
            {
              purgeReason: 'REJECTED',
              action: 'payment-account.provisioning.rejected',
              metadata: {
                status: error.status,
                providerCodes: [...error.providerCodes],
              },
            }
          )
        // A local refusal of the body: it was not sent and can never be sent as is.
        else
          await cancelProvisioningShell(tx, account, 'COMPANY_DATA_CHANGED', at)
      })
      return
    }
    if (
      error instanceof BillingProviderError &&
      !error.maybeApplied &&
      error.code === 'UNAVAILABLE'
    ) {
      // Not sent (switch off, egress, rate limit, credential or configuration): the request waits, same values.
      await afterPost(async (tx, account) => {
        await tx.paymentAccount.update({
          where: { id: account.id },
          data: {
            status: 'PROVISIONING',
            lastErrorCode: 'SUBACCOUNT_CREATE_NOT_SENT',
            lockedUntil: null,
            nextAttemptAt: later(now(), LEASE_MS, error.retryAfterSeconds),
          },
        })
        await tx.tenantIntegration.update({
          where: { id: account.integrationId },
          data: { webhookTokenHash: null },
        })
      })
      return
    }
    // Anything else may have been applied: never POST again; only the GET inspection decides.
    await afterPost(async (tx, account) => {
      const at = now()
      await tx.paymentAccount.update({
        where: { id: account.id },
        data: { lastErrorCode: 'SUBACCOUNT_CREATE_UNKNOWN', lockedUntil: null },
      })
      await purgeProvisioningRequest(tx, account.id, 'UNCERTAIN', at)
      await tx.platformAuditLog.create({
        data: {
          actorKind: 'SYSTEM',
          action: 'payment-account.provisioning.uncertain',
          tenantId: account.tenantId,
          targetType: 'PaymentAccount',
          targetId: account.id,
          reasonCategory:
            error instanceof BillingProviderError
              ? (error.reason ?? error.code)
              : 'SUBACCOUNT_CREATE_FAILED',
        },
      })
    })

    /** Stores and activates the key, binds the references and moves to the owner's step, atomically. */
    async function seal(
      result: Created,
      credential: NonNullable<Created['credential']>
    ) {
      const ref = {
        tenantId,
        integrationId: pendingIntent.integrationId,
        environment: options.environment,
      }
      const fingerprint = options.vault.fingerprint(credential.apiKey)
      const meta = {
        ...(credential.accessTokenId
          ? { providerCredentialId: credential.accessTokenId }
          : {}),
        ...(credential.expiresAt ? { expiresAt: credential.expiresAt } : {}),
      }
      const observed = observedOf(result)
      const sealTransaction = async () => {
        const done = await locked(id, tenantId, async (tx, account) => {
          const at = now()
          if (account.integrationId !== ref.integrationId) return false
          if (await keyOf(tx, account)) {
            if (await hasActiveFingerprint(tx, ref, fingerprint)) return true
            // Another active key (manual recovery): keep this one as evidence, never displace it.
            await options.vault.store(
              tx,
              { ...ref, purpose: 'ASAAS_API_KEY' },
              credential.apiKey,
              meta
            )
            await blockProvisioning(tx, account, 'SUBACCOUNT_KEY_CONFLICT', at)
            return true
          }
          const stored = await options.vault.store(
            tx,
            { ...ref, purpose: 'ASAAS_API_KEY' },
            credential.apiKey,
            meta
          )
          await options.vault.activate(tx, stored.id)
          const problem = await observedReferenceProblem(
            tx,
            account,
            observed,
            observed.document
          )
          if (problem) {
            await blockProvisioning(tx, account, problem, at)
            return true
          }
          await tx.tenantIntegration.update({
            where: { id: account.integrationId },
            data: { externalAccountId: observed.id },
          })
          const references = {
            providerAccountId: observed.id,
            walletId: observed.walletId,
            keyIdleExpiresAt: credential.expiresByLackOfUseAt,
            lastSyncedAt: at,
            lockedUntil: null,
          }
          // The key is always sealed; a change during the POST still sends the account to review.
          const blocked =
            account.organization.ownerUserId !== account.requestedByUserId
              ? 'OWNER_CHANGED_DURING_PROVISIONING'
              : account.organization.access === 'ARCHIVED'
                ? 'TENANT_ARCHIVED_DURING_PROVISIONING'
                : account.status === 'BLOCKED'
                  ? (account.lastErrorCode ?? 'SUBACCOUNT_STATE_CHANGED')
                  : account.disconnectedAt ||
                      !integrationReady(account) ||
                      !['UNKNOWN', 'KEY_RECOVERY_REQUIRED'].includes(
                        account.status
                      )
                    ? 'SUBACCOUNT_STATE_CHANGED'
                    : null
          if (blocked) {
            await tx.paymentAccount.update({
              where: { id },
              data: {
                ...references,
                status: 'BLOCKED',
                lastErrorCode: blocked,
              },
            })
            await purgeProvisioningRequest(tx, id, 'BLOCKED', at)
            await tx.platformAuditLog.create({
              data: {
                actorKind: 'SYSTEM',
                action: 'payment-account.provisioning.blocked',
                tenantId,
                targetType: 'PaymentAccount',
                targetId: id,
                reasonCategory: blocked,
              },
            })
            return true
          }
          const next = later(at, HEALTH_DELAY_MS)
          await tx.paymentAccount.update({
            where: { id },
            data: {
              ...references,
              status: 'AWAITING_OWNER',
              healthIssue: null,
              lastErrorCode: 'WEBHOOK_UPDATE_PENDING',
              nextAttemptAt: next,
            },
          })
          await purgeProvisioningRequest(tx, id, 'CREATED', at)
          await tx.platformAuditLog.create({
            data: {
              actorKind: 'SYSTEM',
              action:
                account.status === 'KEY_RECOVERY_REQUIRED'
                  ? 'payment-account.provisioning.key-recovered'
                  : 'payment-account.provisioning.created',
              tenantId,
              targetType: 'PaymentAccount',
              targetId: id,
              reasonCategory: 'WEBHOOK_UPDATE_PENDING',
            },
          })
          // Same key format as the health sweep, due when the delivery runs (ADR SaaS B.7.2, "after 15 s").
          await enqueuePlatformOutbox(tx, {
            tenantId,
            topic: HEALTH_TOPIC,
            aggregateId: id,
            payload: { accountId: id },
            availableAt: next,
            dedupeKey: 'account-health:' + id + ':' + next.toISOString(),
          })
          return true
        })
        if (!done) throw new Error('SUBACCOUNT_SEAL_TARGET_CHANGED')
      }
      // Each new attempt first checks, under the vault lock, whether this key is already the active one: a lost
      // acknowledgement of an applied commit is success, never a duplicate fingerprint.
      for (let attempt = 0; attempt <= SEAL_RETRIES; attempt++) {
        if (attempt > 0) await sleep(200 * attempt)
        try {
          await sealTransaction()
          return
        } catch {
          /* Retried without the secret ever leaving memory. */
        }
      }
      // The key could not be stored: bind the references and require manual recovery, without any secret.
      try {
        await afterPost(async (tx, account) => {
          await bindObservedSubaccount(tx, account, observed, {
            document: observed.document,
            code: 'SUBACCOUNT_KEY_STORE_FAILED',
            purgeReason: 'CREATED',
            at: now(),
          })
        })
      } catch {
        /* Still UNKNOWN + CREATE_PENDING: the queued inspection takes over after the lease. */
      }
    }
  }

  return {
    handlers: { [SUBACCOUNT_PROVISIONING_TOPIC]: handler },
    /** Due requests that may still reach POST /accounts; each new attempt gets a new delivery key. */
    enqueue: () =>
      options.transaction(async (tx) => {
        const at = now()
        const accounts = await tx.paymentAccount.findMany({
          where: {
            mode: 'ASAAS_SUBACCOUNT',
            status: 'PROVISIONING',
            environment: options.environment,
            disconnectedAt: null,
            nextAttemptAt: { lte: at },
            OR: [{ lockedUntil: null }, { lockedUntil: { lte: at } }],
            organization: { status: 'ACTIVE' },
            integration: {
              provider: 'ASAAS',
              credentialSource: 'VAULT',
              environment: options.environment,
              status: 'PROVISIONING',
            },
          },
          orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }],
          take: 20,
        })
        for (const account of accounts)
          await enqueuePlatformOutbox(tx, {
            tenantId: account.tenantId,
            topic: SUBACCOUNT_PROVISIONING_TOPIC,
            aggregateId: account.id,
            payload: { accountId: account.id },
            availableAt: account.nextAttemptAt,
            dedupeKey:
              'pa:create:' +
              account.id +
              ':' +
              account.nextAttemptAt.toISOString(),
          })
        return accounts.length
      }),
  }
}
