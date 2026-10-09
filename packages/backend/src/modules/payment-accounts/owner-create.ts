import { Prisma } from '@prisma/client'
import {
  CreatePaymentAccountInputSchema,
  PaymentAccountCreationOfferSchema,
  type CreatePaymentAccountResponse,
  type PaymentAccountCreationOffer,
} from '@gb-locacoes/contracts/payment-account'
import { SubscriptionEnforcementSchema } from '@gb-locacoes/contracts/subscription'
import { formatarCnpj } from '@gb-locacoes/domain/documento'
import { recursoNoPlano } from '@gb-locacoes/domain/assinatura'
import type { TenantPrincipal } from '../identity/index'
import type { PlatformScope } from '../platform-scope/index'
import { enqueuePlatformOutbox } from '../outbox/index'
import { readEffectiveRights } from '../entitlements/effective-rights'
import { authorizeReceivingOwner, receivingSlot } from './owner-authorization'
import { documentInUse, subaccountCompanyOf } from './subaccount-company'

export const SUBACCOUNT_PROVISIONING_TOPIC = 'payment-accounts.provisioning'
const MOBILE_PHONE = /^[1-9]{2}9\d{8}$/

export class OwnerSubaccountRequestError extends Error {
  constructor(
    readonly status: 400 | 401 | 402 | 403 | 409,
    readonly code: string
  ) {
    super(code)
  }
}

/** Composition of the creation (ADR SaaS B.14). `null` keeps the creation unavailable. */
export type SubaccountCreationSettings = {
  environment: 'sandbox' | 'production'
  model: 'STANDARD' | 'BAAS'
  requiresPaid: boolean
  site(slug: string): string
}
export type OwnerSubaccountRequestPorts = {
  readTransaction: PlatformScope['withProvisioningTransaction']
  transaction: PlatformScope['withProvisioningTransaction']
  configuration(): SubaccountCreationSettings | null
  /** `PLATFORM_SUBSCRIPTION_ENFORCEMENT`, the same switch as the request gate. */
  enforcement(): string | undefined
  shadow?: (_entry: { tenantId: string; code: string }) => void
  now?: () => Date
}
type Blocker = NonNullable<PaymentAccountCreationOffer['blocker']>

const fail = (status: 401 | 403, code: string) =>
  new OwnerSubaccountRequestError(status, code)

/** Category shown to the owner; provider codes stay in the platform audit. */
function lastRequestOutcome(
  cancelled: { lastErrorCode: string | null } | null
): PaymentAccountCreationOffer['lastRequestOutcome'] {
  if (!cancelled) return null
  if (cancelled.lastErrorCode === 'SUBACCOUNT_CREATE_REJECTED')
    return 'REJECTED_DATA'
  if (cancelled.lastErrorCode === 'SUBACCOUNT_CREATE_FORBIDDEN')
    return 'REJECTED_PROVIDER'
  return 'CANCELLED'
}

/**
 * Owner request of the receiving account (ADR SaaS B.7.2). The request never calls the provider: it records the
 * integration, the account, the platform-only request, the audit and the outbox event in one transaction.
 */
export function createOwnerSubaccountRequest(
  ports: OwnerSubaccountRequestPorts
) {
  const now = ports.now ?? (() => new Date())
  function settings() {
    try {
      return ports.configuration()
    } catch {
      return null
    }
  }
  /** Same predicate as the request gate (D-4 of 2026-10-07: creating requires the online payments module). */
  async function subscriptionBlocker(
    tx: Prisma.TransactionClient,
    tenantId: string,
    access: string,
    at: Date
  ): Promise<Blocker | null> {
    const parsed = SubscriptionEnforcementSchema.safeParse(
      ports.enforcement() ?? 'off'
    )
    const mode = parsed.success ? parsed.data : 'on'
    if (mode === 'off') return null
    const rights = await readEffectiveRights(tx, tenantId, at)
    const blocker: Blocker | null =
      access === 'RESTRICTED'
        ? 'SUBSCRIPTION_RESTRICTED'
        : !rights || !recursoNoPlano(rights, 'onlinePayments')
          ? 'MODULE_NOT_IN_PLAN'
          : null
    if (!blocker || mode === 'on') return blocker
    try {
      ;(
        ports.shadow ??
        ((entry) => console.warn('[subscription-shadow]', entry))
      )({ tenantId, code: blocker })
    } catch {
      /* Diagnostic failures cannot enforce shadow mode. */
    }
    return null
  }
  async function firstPaymentConfirmed(
    tx: Prisma.TransactionClient,
    tenantId: string
  ) {
    return (
      (await tx.platformInvoice.findFirst({
        where: {
          tenantId,
          status: 'PAID',
          paidAt: { not: null },
          chargebackAt: null,
        },
        select: { id: true },
      })) !== null
    )
  }
  /** Current acceptance of the payments partner notice by this owner (predicate of the subscription issuance). */
  async function paymentsNoticeAccepted(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    at: Date
  ) {
    const rows = await tx.legalAcceptance.findMany({
      where: {
        tenantId,
        userId,
        kind: 'PAYMENTS_PARTNER_NOTICE',
        withdrawnAt: null,
        acceptedAt: { lte: at },
      },
      select: { version: true, textSha256: true },
    })
    return rows.some(
      (row) => row.version.trim() && /^[a-f0-9]{64}$/i.test(row.textSha256)
    )
  }
  return {
    /** READ ONLY: never `FOR UPDATE`; refusals other than ownership are reported as blockers. */
    offer(principal: TenantPrincipal): Promise<PaymentAccountCreationOffer> {
      const configured = settings()
      return ports.readTransaction(principal.tenantId, async (tx) => {
        const at = now()
        const auth = await authorizeReceivingOwner(tx, principal, {
          write: false,
          now: at,
          fail,
        })
        const slot = await receivingSlot(tx, principal.tenantId)
        const outcome = lastRequestOutcome(slot.lastCancelled)
        const blocked = (blocker: Blocker) =>
          PaymentAccountCreationOfferSchema.parse({
            available: false,
            blocker,
            model: null,
            company: null,
            suggestedMobilePhone: null,
            companyDataVersion: null,
            lastRequestOutcome: outcome,
          })
        if (!configured) return blocked('CREATION_UNAVAILABLE')
        if (slot.current || slot.blockingIntegration)
          return blocked('ACCOUNT_EXISTS')
        const policy = await subscriptionBlocker(
          tx,
          principal.tenantId,
          auth.organization.access,
          at
        )
        if (policy) return blocked(policy)
        if (
          configured.requiresPaid &&
          !(await firstPaymentConfirmed(tx, principal.tenantId))
        )
          return blocked('FIRST_PAYMENT_REQUIRED')
        if (!auth.emailVerified) return blocked('EMAIL_NOT_VERIFIED')
        if (
          !(await paymentsNoticeAccepted(
            tx,
            principal.tenantId,
            principal.userId,
            at
          ))
        )
          return blocked('PAYMENTS_NOTICE_REQUIRED')
        const data = subaccountCompanyOf(
          auth.organization,
          auth.ownerEmail,
          configured.site
        )
        if (!data) return blocked('COMPANY_DATA_INCOMPLETE')
        if (
          await documentInUse(
            tx,
            principal.tenantId,
            data.company.cpfCnpj,
            'request'
          )
        )
          return blocked('DOCUMENT_IN_USE')
        const phone = auth.organization.phone?.replace(/\D/g, '') ?? ''
        return PaymentAccountCreationOfferSchema.parse({
          available: true,
          blocker: null,
          model: configured.model,
          company: {
            legalName: data.company.name,
            cnpj: formatarCnpj(data.company.cpfCnpj),
            companyType: data.company.companyType,
            loginEmail: data.company.loginEmail,
            email: data.company.email,
            address: {
              street: data.company.address,
              number: data.company.addressNumber,
              complement: data.company.complement ?? null,
              district: data.company.province,
              postalCode: data.company.postalCode,
            },
            site: data.company.site,
          },
          suggestedMobilePhone: MOBILE_PHONE.test(phone) ? phone : null,
          companyDataVersion: data.version,
          lastRequestOutcome: outcome,
        })
      })
    },
    /** Validated before any write and again under the organization lock; the environment never comes from input. */
    async request(
      principal: TenantPrincipal,
      input: unknown,
      authenticatedAt: number
    ): Promise<CreatePaymentAccountResponse> {
      const parsed = CreatePaymentAccountInputSchema.safeParse(input)
      if (!parsed.success)
        throw new OwnerSubaccountRequestError(400, 'INVALID_INPUT')
      const configured = settings()
      if (!configured)
        throw new OwnerSubaccountRequestError(
          409,
          'PAYMENT_ACCOUNT_CREATION_UNAVAILABLE'
        )
      const value = new Prisma.Decimal(parsed.data.incomeValue)
      try {
        return await ports.transaction(principal.tenantId, async (tx) => {
          const at = now()
          const auth = await authorizeReceivingOwner(tx, principal, {
            write: true,
            authenticatedAt,
            now: at,
            fail,
          })
          if (!auth.emailVerified)
            throw new OwnerSubaccountRequestError(403, 'EMAIL_NOT_VERIFIED')
          const slot = await receivingSlot(tx, principal.tenantId)
          if (slot.current) {
            const request =
              await tx.paymentAccountProvisioningRequest.findUnique({
                where: { paymentAccountId: slot.current.id },
              })
            // An identical accepted request that never reached the provider is a replay, without new effects.
            if (
              slot.current.mode === 'ASAAS_SUBACCOUNT' &&
              slot.current.status === 'PROVISIONING' &&
              slot.current.provisioningAttempts === 0 &&
              slot.current.requestedByUserId === principal.userId &&
              request &&
              !request.purgedAt &&
              request.incomeValue?.equals(value) &&
              request.mobilePhone === parsed.data.mobilePhone &&
              request.companyDataVersion === parsed.data.companyDataVersion
            )
              return { accepted: true as const }
            throw new OwnerSubaccountRequestError(
              409,
              'PAYMENT_ACCOUNT_ALREADY_EXISTS'
            )
          }
          if (slot.blockingIntegration)
            throw new OwnerSubaccountRequestError(
              409,
              'PAYMENT_INTEGRATION_ALREADY_EXISTS'
            )
          const data = subaccountCompanyOf(
            auth.organization,
            auth.ownerEmail,
            configured.site
          )
          if (!data || data.version !== parsed.data.companyDataVersion)
            throw new OwnerSubaccountRequestError(409, 'COMPANY_DATA_CHANGED')
          const policy = await subscriptionBlocker(
            tx,
            principal.tenantId,
            auth.organization.access,
            at
          )
          if (policy === 'MODULE_NOT_IN_PLAN')
            throw new OwnerSubaccountRequestError(402, 'MODULE_NOT_IN_PLAN')
          if (policy)
            throw new OwnerSubaccountRequestError(
              402,
              'SUBSCRIPTION_RESTRICTED'
            )
          if (
            configured.requiresPaid &&
            !(await firstPaymentConfirmed(tx, principal.tenantId))
          )
            throw new OwnerSubaccountRequestError(409, 'FIRST_PAYMENT_REQUIRED')
          if (
            !(await paymentsNoticeAccepted(
              tx,
              principal.tenantId,
              principal.userId,
              at
            ))
          )
            throw new OwnerSubaccountRequestError(
              409,
              'PAYMENTS_NOTICE_REQUIRED'
            )
          if (
            await documentInUse(
              tx,
              principal.tenantId,
              data.company.cpfCnpj,
              'request'
            )
          )
            throw new OwnerSubaccountRequestError(409, 'DOCUMENT_IN_USE')
          const integration = await tx.tenantIntegration.create({
            data: {
              tenantId: principal.tenantId,
              provider: 'ASAAS',
              environment: configured.environment,
              credentialSource: 'VAULT',
              status: 'PROVISIONING',
            },
          })
          const account = await tx.paymentAccount.create({
            data: {
              tenantId: principal.tenantId,
              integrationId: integration.id,
              mode: 'ASAAS_SUBACCOUNT',
              subaccountModel: configured.model,
              environment: configured.environment,
              status: 'PROVISIONING',
              requestedByUserId: principal.userId,
              nextAttemptAt: at,
            },
          })
          await tx.paymentAccountProvisioningRequest.create({
            data: {
              tenantId: principal.tenantId,
              paymentAccountId: account.id,
              incomeValue: value,
              mobilePhone: parsed.data.mobilePhone,
              companyDataVersion: parsed.data.companyDataVersion,
            },
          })
          // Neither the value nor the phone reaches the audit or the queue: both carry only identifiers.
          await tx.platformAuditLog.create({
            data: {
              actorKind: 'OWNER',
              actorUserId: principal.userId,
              tenantId: principal.tenantId,
              action: 'payment-account.provisioning.requested',
              targetType: 'PaymentAccount',
              targetId: account.id,
              reasonCategory: configured.model,
              createdAt: at,
            },
          })
          await enqueuePlatformOutbox(tx, {
            tenantId: principal.tenantId,
            topic: SUBACCOUNT_PROVISIONING_TOPIC,
            aggregateId: account.id,
            payload: { accountId: account.id },
            availableAt: at,
            dedupeKey: 'pa:create:' + account.id + ':' + at.toISOString(),
          })
          return { accepted: true as const }
        })
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
          throw new OwnerSubaccountRequestError(
            409,
            'PAYMENT_ACCOUNT_ALREADY_EXISTS'
          )
        throw error
      }
    },
  }
}
