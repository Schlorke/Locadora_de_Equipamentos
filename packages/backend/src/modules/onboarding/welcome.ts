import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { PLATFORM, isDisposableEmail } from '@gb-locacoes/contracts/platform'
import {
  platformEmail,
  platformMailEnvelopeSchema,
  type PlatformMailEnvelope,
} from '../communications/index'
import { PermanentDeliveryError, type OutboxHandler } from '../outbox/index'
import type { PlatformTransaction } from '../platform-scope/index'

export const ONBOARDING_WELCOME_TOPIC = 'onboarding.welcome'
const windowMs = 23 * 60 * 60_000
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const reasonSchema = z.enum([
  'RECIPIENT_UNAVAILABLE',
  'CONTENT_CHANGED',
  'IDEMPOTENCY_WINDOW_EXPIRED',
  'INVALID_ATTEMPT_TIME',
])
const payloadSchema = z
  .object({
    organizationId: z.string().min(1),
    intent: z
      .object({
        ownerUserId: z.string().min(1),
        recipientHash: z.string().regex(/^[a-f0-9]{64}$/),
        firstAttemptAt: z.string().datetime(),
        envelope: platformMailEnvelopeSchema,
      })
      .strict()
      .optional(),
    acceptedAt: z.string().datetime().optional(),
    quarantine: z
      .object({ reason: reasonSchema, at: z.string().datetime() })
      .strict()
      .optional(),
  })
  .strict()
  .refine((value) => !value.acceptedAt || !!value.intent)

/** Onboarding owns eligibility and receipts; runtime injects the shared mail transport. */
export function createOnboardingWelcome(options: {
  transaction: PlatformTransaction
  from: string
  panelUrl: string
  send: (_mail: PlatformMailEnvelope, _idempotencyKey: string) => Promise<void>
  now?: () => Date
}) {
  if (!options.from.trim() || /[\r\n]/.test(options.from))
    throw new Error('INVALID_PLATFORM_MAIL_CONFIGURATION')
  const render = (organization: string) =>
    platformEmail({
      platform: PLATFORM.displayName,
      organization,
      heading: 'Sua locadora está cadastrada',
      message:
        'O cadastro da sua locadora foi concluído. Acesse o painel para cadastrar equipamentos e acompanhar os primeiros passos.',
      actionUrl: options.panelUrl,
      actionLabel: 'Acessar painel',
    })
  // Reject an unsafe runtime URL before registering a consumer or claiming events.
  render('')
  const now = options.now ?? (() => new Date())
  const send: OutboxHandler<string | null> = async (message) => {
    if (
      message.topic !== ONBOARDING_WELCOME_TOPIC ||
      !message.tenantId ||
      message.aggregateId !== message.tenantId ||
      message.dedupeKey !== 'onboarding-welcome:' + message.tenantId
    )
      throw new PermanentDeliveryError('INVALID_ONBOARDING_WELCOME')
    const delivery = await options.transaction(async (tx) => {
      // Match platform mutations' organization -> event lock order.
      await tx.$queryRaw`SELECT id FROM organizations WHERE id=${message.tenantId} FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM platform_outbox_events WHERE id=${message.id} FOR UPDATE`
      const row = await tx.platformOutboxEvent.findUniqueOrThrow({
        where: { id: message.id },
      })
      if (
        row.topic !== message.topic ||
        row.tenantId !== message.tenantId ||
        row.aggregateId !== message.aggregateId ||
        row.dedupeKey !== message.dedupeKey
      )
        throw new PermanentDeliveryError('INVALID_ONBOARDING_WELCOME')
      if (
        row.status !== 'PROCESSING' ||
        row.lockedBy !== message.lockedBy ||
        row.attempts !== message.attempts ||
        !row.lockedUntil ||
        row.lockedUntil.getTime() - now().getTime() < 20_000
      )
        throw new Error('ONBOARDING_WELCOME_LEASE_LOST')
      const parsed = payloadSchema.safeParse(row.payload)
      if (!parsed.success || parsed.data.organizationId !== message.tenantId)
        throw new PermanentDeliveryError('INVALID_ONBOARDING_WELCOME')
      const payload = parsed.data
      if (payload.quarantine) return { blocked: true as const }
      if (payload.acceptedAt) return { accepted: true as const }
      const quarantine = async (reason: z.infer<typeof reasonSchema>) => {
        await tx.platformOutboxEvent.update({
          where: { id: row.id },
          data: {
            payload: {
              ...payload,
              quarantine: { reason, at: now().toISOString() },
            } as Prisma.InputJsonObject,
          },
        })
        await tx.platformAuditLog.create({
          data: {
            actorKind: 'SYSTEM',
            tenantId: row.tenantId,
            action: 'onboarding.welcome.reconciliation',
            targetType: 'PlatformOutboxEvent',
            targetId: row.id,
            reasonCategory: reason,
          },
        })
        return { blocked: true as const }
      }
      const org = await tx.organization.findUnique({
        where: { id: message.tenantId! },
        select: { name: true, ownerUserId: true, origin: true, status: true },
      })
      if (
        !org?.ownerUserId ||
        org.origin !== 'ONBOARDING' ||
        org.status !== 'ACTIVE'
      )
        return quarantine('RECIPIENT_UNAVAILABLE')
      const member = await tx.membership.findFirst({
        where: {
          tenantId: message.tenantId!,
          userId: org.ownerUserId,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
        select: { id: true },
      })
      const contact = (
        await tx.$queryRaw<{ email: string; authEmailVerified: boolean }[]>`
          SELECT email,"authEmailVerified" FROM platform_user_contacts WHERE id=${org.ownerUserId}
        `
      )[0]
      const email = z.email().safeParse(contact?.email.trim().toLowerCase())
      const staff = await tx.platformStaff.findFirst({
        where: { userId: org.ownerUserId, active: true },
        select: { id: true },
      })
      if (
        !member ||
        !contact?.authEmailVerified ||
        !email.success ||
        isDisposableEmail(email.data) ||
        staff
      )
        return quarantine('RECIPIENT_UNAVAILABLE')
      const envelope = {
        ...render(org.name),
        from: options.from,
        to: email.data,
      }
      const intent = payload.intent
      if (intent) {
        const age = now().getTime() - Date.parse(intent.firstAttemptAt)
        if (age < 0) return quarantine('INVALID_ATTEMPT_TIME')
        if (age >= windowMs) return quarantine('IDEMPOTENCY_WINDOW_EXPIRED')
        if (
          intent.ownerUserId !== org.ownerUserId ||
          intent.recipientHash !== hash(email.data) ||
          Object.keys(envelope).some(
            (key) =>
              envelope[key as keyof PlatformMailEnvelope] !==
              intent.envelope[key as keyof PlatformMailEnvelope]
          )
        )
          return quarantine('CONTENT_CHANGED')
      } else
        await tx.platformOutboxEvent.update({
          where: { id: row.id },
          data: {
            payload: {
              ...payload,
              intent: {
                ownerUserId: org.ownerUserId,
                recipientHash: hash(email.data),
                firstAttemptAt: now().toISOString(),
                envelope,
              },
            },
          },
        })
      return { envelope: intent?.envelope ?? envelope }
    })
    // Throw only after committing the quarantine and its audit record.
    if ('blocked' in delivery)
      throw new PermanentDeliveryError(
        'ONBOARDING_WELCOME_RECONCILIATION_REQUIRED'
      )
    if ('accepted' in delivery) return
    try {
      await options.send(delivery.envelope, 'onboarding-welcome:' + message.id)
    } catch {
      throw new Error('PLATFORM_MAIL_DELIVERY_FAILED')
    }
    await options.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id=${message.tenantId} FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM platform_outbox_events WHERE id=${message.id} FOR UPDATE`
      const row = await tx.platformOutboxEvent.findUniqueOrThrow({
        where: { id: message.id },
      })
      if (
        row.status !== 'PROCESSING' ||
        row.lockedBy !== message.lockedBy ||
        row.attempts !== message.attempts ||
        !row.lockedUntil ||
        row.lockedUntil <= now()
      )
        throw new Error('ONBOARDING_WELCOME_LEASE_LOST')
      if (
        row.topic !== message.topic ||
        row.tenantId !== message.tenantId ||
        row.aggregateId !== message.aggregateId ||
        row.dedupeKey !== message.dedupeKey
      )
        throw new PermanentDeliveryError('INVALID_ONBOARDING_WELCOME')
      const parsed = payloadSchema.safeParse(row.payload)
      if (
        !parsed.success ||
        !parsed.data.intent ||
        parsed.data.quarantine ||
        Object.keys(delivery.envelope).some(
          (key) =>
            delivery.envelope[key as keyof PlatformMailEnvelope] !==
            parsed.data.intent!.envelope[key as keyof PlatformMailEnvelope]
        )
      )
        throw new PermanentDeliveryError('INVALID_ONBOARDING_WELCOME')
      if (parsed.data.acceptedAt) return
      await tx.platformOutboxEvent.update({
        where: { id: row.id },
        data: { payload: { ...parsed.data, acceptedAt: now().toISOString() } },
      })
      await tx.platformAuditLog.create({
        data: {
          actorKind: 'SYSTEM',
          tenantId: row.tenantId,
          action: 'onboarding.welcome.accepted',
          targetType: 'PlatformOutboxEvent',
          targetId: row.id,
          reasonCategory: 'PROVIDER_ACCEPTED',
        },
      })
    })
  }
  return { handlers: { [ONBOARDING_WELCOME_TOPIC]: send } }
}
