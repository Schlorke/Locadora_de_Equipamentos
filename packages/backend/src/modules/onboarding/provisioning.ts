import { createHmac, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import {
  CreateOrganizationInputSchema,
  CreateOrganizationResponseSchema,
  IdempotencyKeySchema,
  type CreateOrganizationResponse,
} from '@gb-locacoes/contracts/onboarding'
import {
  isSignupSlug,
  isDisposableEmail,
} from '@gb-locacoes/contracts/platform'
import { validarCnpj } from '@gb-locacoes/domain/documento'
import { diaCivilEmSaoPaulo, somarDias } from '@gb-locacoes/domain/assinatura'
import type { PlatformScope } from '../platform-scope/index'
import {
  publicOfferWhere,
  SUBSCRIPTION_ISSUE_TOPIC,
} from '../subscriptions/index'
import { enqueuePlatformOutbox } from '../outbox/index'
import { OnboardingError } from './errors'
import {
  publishedSignupDocuments,
  assertPublishedAcceptances,
} from './legal-publication'
import { createOnboardingCreationLimit } from './rate-limit'
import { seedOnboardingTenant } from './seeds'
import { readSignupSlugAvailability } from './slug-availability'
import { ONBOARDING_WELCOME_TOPIC } from './welcome'

const auditAction = 'ORGANIZATION_PROVISIONED'
export type ProvisioningActor = { userId: string; staffUserId?: string }
type OnboardingPorts = {
  scope: PlatformScope
  trialSecret: string
  rateLimitSecret: string
  /** Current approved metadata; no network calls or draft documents. */
  publication(): unknown
  environment: 'sandbox' | 'production'
  now?: () => Date
  /** HTTP challenge is checked for new requests only; committed receipts remain replayable. */
  authorizeNewRequest?(): Promise<void>
}

/** Shared atomic use case for assisted provisioning and the future authenticated signup adapter. */
export function createOrganizationProvisioning(ports: OnboardingPorts) {
  if (
    Buffer.byteLength(ports.trialSecret, 'utf8') < 32 ||
    !['sandbox', 'production'].includes(ports.environment)
  )
    throw new OnboardingError(503, 'ONBOARDING_CONFIGURATION_INVALID')
  const hmac = (purpose: string, value: unknown) =>
    createHmac('sha256', ports.trialSecret)
      .update(JSON.stringify([purpose, value]))
      .digest('hex')
  const trialKey = (kind: 'cnpj' | 'email', value: string) =>
    createHmac('sha256', ports.trialSecret)
      .update(kind + ':' + value)
      .digest('hex')
  const limit = createOnboardingCreationLimit({
    transaction: ports.scope.withPlatformTransaction,
    secret: ports.rateLimitSecret,
    now: ports.now,
  })
  const clock = ports.now ?? (() => new Date())
  async function identity(
    tx: Prisma.TransactionClient,
    actor: ProvisioningActor
  ) {
    if (actor.staffUserId) {
      const staff = await tx.platformStaff.findFirst({
        where: {
          userId: actor.staffUserId,
          role: 'PLATFORM_ADMIN',
          active: true,
          revokedAt: null,
        },
        select: { id: true },
      })
      if (!staff) throw new OnboardingError(403, 'PLATFORM_ADMIN_REQUIRED')
    }
    // The global contact view intentionally exposes neither password nor business records.
    const user = (
      await tx.$queryRaw<{ email: string; authEmailVerified: boolean }[]>`
      SELECT email,"authEmailVerified" FROM platform_user_contacts WHERE id=${actor.userId}
    `
    )[0]
    if (!user) throw new OnboardingError(401, 'AUTHENTICATION_REQUIRED')
    if (!user.authEmailVerified)
      throw new OnboardingError(403, 'EMAIL_NOT_VERIFIED')
    const parsed = z.email().safeParse(user.email.trim().toLowerCase())
    if (!parsed.success || isDisposableEmail(parsed.data))
      throw new OnboardingError(403, 'EMAIL_NOT_ALLOWED')
    if (
      await tx.platformStaff.findFirst({
        where: { userId: actor.userId, active: true },
        select: { id: true },
      })
    )
      throw new OnboardingError(403, 'PLATFORM_STAFF_CANNOT_OWN_TENANT')
    return parsed.data
  }
  async function replay(
    tx: Prisma.TransactionClient,
    actor: ProvisioningActor,
    key: string,
    requestHash: string
  ): Promise<CreateOrganizationResponse | null> {
    const org = await tx.organization.findUnique({
      where: { provisioningKey: key },
      select: { id: true, ownerUserId: true },
    })
    if (!org) return null
    if (org.ownerUserId !== actor.userId)
      throw new OnboardingError(409, 'IDEMPOTENCY_KEY_REUSED')
    const record = await tx.platformAuditLog.findFirst({
      where: { tenantId: org.id, action: auditAction, targetId: org.id },
      select: { metadata: true },
    })
    const data = record?.metadata as {
      requestHash?: string
      receipt?: unknown
    } | null
    if (!data || data.requestHash !== requestHash)
      throw new OnboardingError(409, 'IDEMPOTENCY_KEY_REUSED')
    const receipt = CreateOrganizationResponseSchema.safeParse(data.receipt)
    if (!receipt.success || receipt.data.organization.id !== org.id)
      throw new OnboardingError(503, 'ONBOARDING_RECEIPT_UNAVAILABLE')
    return receipt.data
  }
  return async (
    actor: ProvisioningActor,
    raw: unknown,
    rawKey: unknown,
    metadata: { ip: string | null; userAgent: string | null }
  ): Promise<CreateOrganizationResponse> => {
    if (
      !/^[A-Za-z0-9_-]{1,128}$/.test(actor.userId) ||
      (actor.staffUserId !== undefined &&
        !/^[A-Za-z0-9_-]{1,128}$/.test(actor.staffUserId))
    )
      throw new OnboardingError(401, 'AUTHENTICATION_REQUIRED')
    const parsed = CreateOrganizationInputSchema.safeParse(raw)
    if (!parsed.success)
      throw new OnboardingError(400, 'ONBOARDING_INPUT_INVALID')
    const input = parsed.data
    const parsedKey = IdempotencyKeySchema.safeParse(rawKey)
    if (!parsedKey.success)
      throw new OnboardingError(400, 'INVALID_IDEMPOTENCY_KEY')
    if (!validarCnpj(input.company.cnpj))
      throw new OnboardingError(422, 'INVALID_CNPJ')
    const key =
      'onboarding:' + hmac('provisioning', [actor.userId, parsedKey.data])
    const requestHash = hmac('request', {
      ...input,
      acceptances: [...input.acceptances].sort((a, b) =>
        a.kind.localeCompare(b.kind)
      ),
    })
    // A committed receipt remains replayable after the catalogue/terms/quotas change.
    const previous = await ports.scope.withPlatformTransaction(async (tx) => {
      await identity(tx, actor)
      return replay(tx, actor, key, requestHash)
    })
    if (previous) return previous
    await limit(actor.userId, metadata.ip)
    await ports.authorizeNewRequest?.()
    const tenantId = randomUUID()
    try {
      return await ports.scope.withProvisioningTransaction(
        tenantId,
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'onboarding:owner:' + actor.userId},0))`
          const again = await replay(tx, actor, key, requestHash)
          const email = await identity(tx, actor)
          if (again) return again
          if (
            (await tx.organization.count({
              where: { ownerUserId: actor.userId },
            })) >= 3
          )
            throw new OnboardingError(409, 'ORGANIZATION_LIMIT_REACHED')
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'onboarding:slug:' + input.slug},0))`
          if (
            !isSignupSlug(input.slug) ||
            (await tx.organization.findUnique({
              where: { slug: input.slug },
              select: { id: true },
            }))
          )
            throw new OnboardingError(409, 'SLUG_UNAVAILABLE')
          const trialKeys = [
            trialKey('cnpj', input.company.cnpj),
            trialKey('email', email),
          ].sort()
          for (const claimKey of trialKeys)
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'onboarding:trial:' + claimKey},0))`
          await tx.$queryRaw`SELECT v.id FROM plan_versions v JOIN plans p ON p.id=v."planId"
        WHERE v.id=${input.planVersionId} FOR SHARE OF v,p`
          const now = clock()
          if ((await identity(tx, actor)) !== email)
            throw new OnboardingError(409, 'IDENTITY_CHANGED')
          const publication = publishedSignupDocuments(
            ports.publication(),
            diaCivilEmSaoPaulo(now)
          )
          assertPublishedAcceptances(input.acceptances, publication)
          const offer = await tx.planVersion.findFirst({
            where: {
              ...publicOfferWhere(now),
              id: input.planVersionId,
              interval: 'MONTHLY',
            },
          })
          if (!offer) throw new OnboardingError(409, 'PLAN_NOT_AVAILABLE')
          const used =
            (await tx.trialClaim.count({
              where: { keyHash: { in: trialKeys } },
            })) > 0
          const trial = offer.trialDays > 0 && !used
          const trialEndsAt = trial
            ? somarDias(diaCivilEmSaoPaulo(now), offer.trialDays)
            : null
          await tx.organization.create({
            data: {
              id: tenantId,
              slug: input.slug,
              name: input.company.tradeName,
              origin: 'ONBOARDING',
              status: 'ACTIVE',
              access: trial ? 'FULL' : 'SETUP',
              ownerUserId: actor.userId,
              provisioningKey: key,
              documentNormalized: input.company.cnpj,
              document: input.company.cnpj,
              documentVerifiedAt: null,
              legalName: input.company.legalName,
              companyType: input.company.companyType,
              phone: input.company.phone,
              addressLine: input.company.addressLine,
              addressNumber: input.company.addressNumber,
              addressComplement: input.company.addressComplement,
              district: input.company.district,
              city: input.company.city,
              state: input.company.state,
              postalCode: input.company.postalCode,
              sitePublishedAt: null,
              siteIndexable: false,
              directoryListed: false,
            },
          })
          await tx.membership.create({
            data: {
              tenantId,
              userId: actor.userId,
              role: 'ADMIN',
              status: 'ACTIVE',
            },
          })
          if (trial)
            await tx.trialClaim.createMany({
              data: [
                {
                  keyHash: trialKey('cnpj', input.company.cnpj),
                  kind: 'CNPJ',
                  tenantId,
                },
                { keyHash: trialKey('email', email), kind: 'EMAIL', tenantId },
              ],
            })
          const status = trial ? 'TRIALING' : 'INCOMPLETE'
          const sub = await tx.subscription.create({
            data: {
              tenantId,
              planVersionId: offer.id,
              status,
              trialEndsAt: trialEndsAt
                ? new Date(trialEndsAt + 'T00:00:00.000Z')
                : null,
              billingMode: 'ASAAS',
              providerEnvironment: ports.environment,
              providerSync: trial ? 'NOT_REQUIRED' : 'PENDING',
              providerNextAttemptAt: now,
              createdAt: now,
            },
          })
          await tx.subscriptionEvent.create({
            data: {
              tenantId,
              subscriptionId: sub.id,
              toStatus: status,
              reason: trial ? 'TRIAL_STARTED' : 'ONBOARDING_CREATED',
              source: 'SYSTEM',
              actorUserId: actor.userId,
              planVersionId: offer.id,
              dedupeKey: key,
              occurredAt: now,
            },
          })
          const ipHash = metadata.ip ? hmac('ip', metadata.ip) : null
          await tx.legalAcceptance.createMany({
            data: input.acceptances.map((row) => ({
              ...row,
              tenantId,
              userId: actor.userId,
              acceptedAt: now,
              ipHash,
              userAgent: metadata.userAgent?.slice(0, 200) ?? null,
            })),
          })
          await seedOnboardingTenant(tx, tenantId, input.company, email)
          const receipt = CreateOrganizationResponseSchema.parse({
            organization: {
              id: tenantId,
              slug: input.slug,
              name: input.company.tradeName,
            },
            subscription: { status, trialEndsAt },
            notices: used && offer.trialDays > 0 ? ['TRIAL_ALREADY_USED'] : [],
          })
          await tx.platformAuditLog.create({
            data: {
              tenantId,
              actorKind: actor.staffUserId ? 'STAFF' : 'OWNER',
              actorUserId: actor.staffUserId ?? actor.userId,
              action: auditAction,
              targetType: 'Organization',
              targetId: tenantId,
              reasonCategory: 'ONBOARDING',
              ipHash,
              metadata: { requestHash, receipt },
              createdAt: now,
            },
          })
          await enqueuePlatformOutbox(tx, {
            tenantId,
            topic: ONBOARDING_WELCOME_TOPIC,
            aggregateId: tenantId,
            payload: { organizationId: tenantId },
            dedupeKey: 'onboarding-welcome:' + tenantId,
          })
          if (!trial)
            await enqueuePlatformOutbox(tx, {
              tenantId,
              topic: SUBSCRIPTION_ISSUE_TOPIC,
              aggregateId: sub.id,
              payload: { subscriptionId: sub.id },
              dedupeKey: 'subscription-issue:onboarding:' + sub.id,
            })
          return receipt
        }
      )
    } catch (error) {
      const collision =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        JSON.stringify(error.meta ?? {}).includes('slug')
      if (
        collision ||
        (error instanceof OnboardingError && error.code === 'SLUG_UNAVAILABLE')
      ) {
        const result = await ports.scope.withPlatformTransaction((tx) =>
          readSignupSlugAvailability(tx, input.slug)
        )
        throw new OnboardingError(
          409,
          'SLUG_UNAVAILABLE',
          undefined,
          result.available ? [] : result.suggestions
        )
      }
      throw error
    }
  }
}
