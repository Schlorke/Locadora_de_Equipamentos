import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import {
  diaCivilEmSaoPaulo,
  planejarAvisos,
} from '@gb-locacoes/domain/assinatura'
import { PLATFORM } from '@gb-locacoes/contracts/platform'
import {
  subscriptionEmail,
  platformMailEnvelopeSchema as envelopeSchema,
} from '../communications/index'
import {
  enqueuePlatformOutbox,
  PermanentDeliveryError,
  type OutboxHandler,
} from '../outbox/index'
import type { PlatformTransaction } from '../platform-scope/index'
import { subscriptionFacts } from './facts'

const NOTIFY = 'subscriptions.notify'
const SCAN = 'subscriptions.dunning'
const MAIL = 'subscriptions.mail'
const reminderSchema = z
  .object({
    tipo: z.enum(['TESTE', 'FATURA']),
    passo: z.string(),
    dia: z.string(),
    faturaId: z.string().nullable(),
    vencimento: z.string(),
    valor: z.string().nullable(),
    pausaEm: z.string().nullable(),
    encerramentoEm: z.string().nullable(),
  })
  .strict()
const noticeSchema = z
  .object({
    subscriptionEventId: z.string().optional(),
    reminder: reminderSchema.optional(),
  })
  .strict()
  .refine((p) => Boolean(p.subscriptionEventId) !== Boolean(p.reminder))
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const email = (value: string | null) => {
  const parsed = z.string().email().safeParse(value?.trim().toLowerCase())
  return parsed.success ? parsed.data : null
}
type Notice = z.infer<typeof noticeSchema>
type Mail = z.infer<typeof envelopeSchema>
type Message = Parameters<OutboxHandler<string | null>>[0]

/** Billing owns selection/eligibility; communications renders; runtime injects transport. */
export function createSubscriptionNotices(options: {
  transaction: PlatformTransaction
  environment: 'sandbox' | 'production'
  panelUrl: string
  from: string
  send: (_mail: Mail, _idempotencyKey: string) => Promise<void>
  now?: () => Date
}) {
  const now = options.now ?? (() => new Date())
  const today = () => diaCivilEmSaoPaulo(now())
  const load = async (tx: Prisma.TransactionClient, message: Message) => {
    const sub = await tx.subscription.findUniqueOrThrow({
      where: { id: message.aggregateId },
      include: { invoices: true, planVersion: true, organization: true },
    })
    if (
      !message.tenantId ||
      sub.tenantId !== message.tenantId ||
      (sub.providerEnvironment &&
        sub.providerEnvironment !== options.environment)
    )
      throw new PermanentDeliveryError('INVALID_SUBSCRIPTION_NOTICE')
    await tx.$queryRaw`SELECT id FROM organizations WHERE id=${sub.tenantId} FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM subscriptions WHERE id=${sub.id} FOR UPDATE`
    // Refresh after locks, including billing contact and invoice/status changes.
    const current = await tx.subscription.findUniqueOrThrow({
      where: { id: sub.id },
      include: { invoices: true, planVersion: true, organization: true },
    })
    if (
      current.tenantId !== message.tenantId ||
      (current.providerEnvironment &&
        current.providerEnvironment !== options.environment)
    )
      throw new PermanentDeliveryError('INVALID_SUBSCRIPTION_NOTICE')
    return current
  }
  type Current = Awaited<ReturnType<typeof load>>
  const reminders = (sub: Current) =>
    planejarAvisos(subscriptionFacts(sub), now(), sub.planVersion)
  const content = async (
    tx: Prisma.TransactionClient,
    sub: Current,
    notice: Notice
  ) => {
    let heading: string,
      message: string,
      actionUrl = options.panelUrl
    if (notice.subscriptionEventId) {
      const event = await tx.subscriptionEvent.findFirst({
        where: { subscriptionId: sub.id, tenantId: sub.tenantId },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      })
      if (
        !event ||
        event.id !== notice.subscriptionEventId ||
        event.toStatus !== sub.status
      )
        return null
      const titles = {
        INCOMPLETE: 'Conclua a configuração da assinatura',
        TRIALING: 'Seu teste está ativo',
        ACTIVE: 'Sua assinatura está ativa',
        PAST_DUE: 'Fatura da assinatura em atraso',
        SUSPENDED: 'Sua assinatura está suspensa',
        CANCELED: 'Assinatura encerrada',
      }
      heading = titles[sub.status]
      message =
        'Este aviso reflete a situação atual da assinatura. Seus dados continuam guardados.'
    } else {
      const reminder = notice.reminder!
      const current = reminders(sub).find(
        (a) =>
          a.tipo === reminder.tipo &&
          a.faturaId === reminder.faturaId &&
          a.passo === reminder.passo &&
          a.dia === reminder.dia &&
          a.vencimento === reminder.vencimento
      )
      if (!current) return null
      if (current.tipo === 'TESTE') {
        heading = 'Seu teste termina em ' + current.vencimento
        message = 'Este lembrete informa a data final do período de teste.'
      } else {
        const invoice = sub.invoices.find((i) => i.id === current.faturaId)!
        heading =
          current.passo === 'D0'
            ? 'Sua fatura vence hoje'
            : current.passo.startsWith('D+')
              ? 'Lembrete de fatura em atraso'
              : 'Sua fatura vence em cinco dias'
        message = `Fatura de R$ ${current.valor!.replace('.', ',')}, com vencimento em ${current.vencimento}.`
        if (current.pausaEm && current.encerramentoEm)
          message += ` Pausa prevista: ${current.pausaEm}. Encerramento previsto: ${current.encerramentoEm}. Seus dados continuam guardados.`
        if (invoice.invoiceUrl) {
          const url = new URL(invoice.invoiceUrl)
          if (
            url.protocol !== 'https:' ||
            url.username ||
            url.password ||
            !(
              url.hostname === 'asaas.com' ||
              url.hostname.endsWith('.asaas.com')
            )
          )
            throw new PermanentDeliveryError('INVALID_SUBSCRIPTION_INVOICE_URL')
          actionUrl = url.href
        }
      }
    }
    return subscriptionEmail({
      platform: PLATFORM.displayName,
      organization: sub.organization.name,
      heading,
      message,
      actionUrl,
    })
  }
  const recipients = async (tx: Prisma.TransactionClient, sub: Current) => {
    const contacts = await tx.$queryRaw<{ email: string | null }[]>`
      SELECT c.email FROM memberships m JOIN platform_user_contacts c ON c.id=m."userId"
      WHERE m."tenantId"=${sub.tenantId} AND m.status='ACTIVE'
        AND (m.role='FINANCIAL' OR (m."userId"=${sub.organization.ownerUserId} AND m.role='ADMIN'))`
    return [
      ...new Set(
        [
          sub.billingEmail,
          sub.organization.billingEmail,
          ...contacts.map((c) => c.email),
        ]
          .map(email)
          .filter((address): address is string => address !== null)
      ),
    ]
  }
  const notify: OutboxHandler<string | null> = async (message) => {
    const notice = noticeSchema.parse(message.payload)
    await options.transaction(async (tx) => {
      const sub = await load(tx, message)
      if (!(await content(tx, sub, notice))) return
      const addresses = await recipients(tx, sub)
      if (!addresses.length) throw new Error('SUBSCRIPTION_CONTACT_UNAVAILABLE')
      for (const address of addresses)
        await enqueuePlatformOutbox(tx, {
          tenantId: sub.tenantId,
          topic: MAIL,
          aggregateId: sub.id,
          dedupeKey: message.dedupeKey + ':mail:' + hash(address),
          payload: { notice, recipientHash: hash(address) },
          availableAt: now(),
        })
    })
  }
  const scan: OutboxHandler<string | null> = async (message) => {
    const input = z
      .object({ subscriptionId: z.string(), day: z.string() })
      .strict()
      .parse(message.payload)
    if (input.subscriptionId !== message.aggregateId)
      throw new PermanentDeliveryError('INVALID_SUBSCRIPTION_NOTICE')
    await options.transaction(async (tx) => {
      const sub = await load(tx, message)
      if (input.day !== today()) return // No flood of missed historical reminders after downtime.
      for (const reminder of reminders(sub))
        await enqueuePlatformOutbox(tx, {
          tenantId: sub.tenantId,
          topic: NOTIFY,
          aggregateId: sub.id,
          dedupeKey:
            reminder.tipo === 'TESTE'
              ? `trial:${sub.id}:${reminder.passo}`
              : `dunning:${reminder.faturaId}:${reminder.passo}`,
          payload: { reminder: reminder as Prisma.InputJsonObject },
          availableAt: now(),
        })
    })
  }
  const send: OutboxHandler<string | null> = async (message) => {
    const delivery = await options.transaction(async (tx) => {
      const sub = await load(tx, message)
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
        throw new Error('SUBSCRIPTION_MAIL_LEASE_LOST')
      if (
        row.topic !== MAIL ||
        row.aggregateId !== sub.id ||
        row.tenantId !== sub.tenantId
      )
        throw new PermanentDeliveryError('INVALID_SUBSCRIPTION_NOTICE')
      const payload = z
        .object({
          notice: noticeSchema,
          recipientHash: z.string().regex(/^[a-f0-9]{64}$/),
          firstAttemptAt: z.string().datetime().optional(),
          envelope: envelopeSchema.optional(),
        })
        .strict()
        .parse(row.payload)
      const rendered = await content(tx, sub, payload.notice)
      const address = (await recipients(tx, sub)).find(
        (a) => hash(a) === payload.recipientHash
      )
      if (!rendered || !address) return null
      if (
        payload.firstAttemptAt &&
        now().getTime() - Date.parse(payload.firstAttemptAt) >= 23 * 60 * 60_000
      ) {
        await tx.platformAuditLog.create({
          data: {
            actorKind: 'SYSTEM',
            tenantId: sub.tenantId,
            action: 'subscription.mail.reconciliation',
            targetType: 'PlatformOutboxEvent',
            targetId: row.id,
            reasonCategory: 'IDEMPOTENCY_WINDOW_EXPIRED',
          },
        })
        return { expired: true as const }
      }
      if (Boolean(payload.firstAttemptAt) !== Boolean(payload.envelope))
        throw new PermanentDeliveryError('INVALID_SUBSCRIPTION_MAIL_INTENT')
      const envelope = payload.envelope ?? {
        ...rendered,
        from: options.from,
        to: address,
      }
      if (
        payload.envelope &&
        (envelope.to !== address ||
          envelope.subject !== rendered.subject ||
          envelope.html !== rendered.html ||
          envelope.text !== rendered.text)
      )
        throw new PermanentDeliveryError('SUBSCRIPTION_MAIL_CONTENT_CHANGED')
      if (!payload.envelope)
        await tx.platformOutboxEvent.update({
          where: { id: row.id },
          data: {
            payload: {
              ...payload,
              firstAttemptAt: now().toISOString(),
              envelope,
            },
          },
        })
      return { expired: false as const, envelope }
    })
    if (!delivery) return
    if (delivery.expired)
      throw new PermanentDeliveryError(
        'SUBSCRIPTION_MAIL_RECONCILIATION_REQUIRED'
      )
    try {
      await options.send(delivery.envelope, 'platform-notice:' + message.id)
    } catch {
      throw new Error('PLATFORM_MAIL_DELIVERY_FAILED')
    }
  }
  return {
    handlers: { [NOTIFY]: notify, [SCAN]: scan, [MAIL]: send },
    enqueue: () =>
      options.transaction(async (tx) => {
        const day = today()
        const subscriptions = await tx.$queryRaw<
          { id: string; tenantId: string; revision: number }[]
        >`
        SELECT s.id,s."tenantId",s.revision FROM subscriptions s
        WHERE s.status IN ('TRIALING','ACTIVE','PAST_DUE','SUSPENDED') AND s."billingMode"='ASAAS'
          AND (s."providerEnvironment" IS NULL OR s."providerEnvironment"=${options.environment})
          AND NOT EXISTS (SELECT 1 FROM platform_outbox_events o WHERE o."dedupeKey"=
            'dunning-scan:'||s.id||':'||${day}||':'||s.revision::text)
        ORDER BY (SELECT max(o."createdAt") FROM platform_outbox_events o WHERE o.topic=${SCAN} AND o."aggregateId"=s.id) ASC NULLS FIRST,s.id
        LIMIT 20`
        for (const candidate of subscriptions) {
          // Match projection's organization -> subscription lock order. Locking
          // subscriptions first could deadlock with the tenant FK on enqueue.
          const org = await tx.$queryRaw<
            { id: string }[]
          >`SELECT id FROM organizations WHERE id=${candidate.tenantId} FOR UPDATE SKIP LOCKED`
          if (!org.length) continue
          const current = await tx.$queryRaw<
            { id: string; revision: number }[]
          >`
            SELECT s.id,s.revision FROM subscriptions s WHERE s.id=${candidate.id}
              AND s.status IN ('TRIALING','ACTIVE','PAST_DUE','SUSPENDED') AND s."billingMode"='ASAAS'
              AND (s."providerEnvironment" IS NULL OR s."providerEnvironment"=${options.environment})
              AND NOT EXISTS (SELECT 1 FROM platform_outbox_events o WHERE o."dedupeKey"=
                'dunning-scan:'||s.id||':'||${day}||':'||s.revision::text)
            FOR UPDATE OF s SKIP LOCKED`
          const sub = current[0]
          if (!sub) continue
          await enqueuePlatformOutbox(tx, {
            tenantId: candidate.tenantId,
            topic: SCAN,
            aggregateId: sub.id,
            payload: { subscriptionId: sub.id, day },
            dedupeKey: `dunning-scan:${sub.id}:${day}:${sub.revision}`,
            availableAt: now(),
          })
        }
      }),
  }
}
