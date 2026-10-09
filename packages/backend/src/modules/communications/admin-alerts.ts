import { NotificationPriority, NotificationType } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { TenantTransactionRunner } from '../rentals/index'
import { createAdminNotificationService } from './admin-notifications'
const DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000
const QUOTE_PENDING_HOURS = 4
const BOLETO_AFTER_APPROVAL_HOURS = 2
const BOLETO_PENDING_HOURS = 24
const CHECKIN_PENDING_HOURS = 2
const RETURN_PENDING_HOURS = 2
const CONTRACT_PENDING_HOURS = 4
const APPROVED_NO_RENTAL_HOURS = 4

type BoletoMetadata = {
  boletoSentAt?: string
}

function getBoletoSentAt(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null
  }

  const { boletoSentAt } = metadata as BoletoMetadata
  if (!boletoSentAt) {
    return null
  }

  const parsed = new Date(boletoSentAt)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function getCutoff(now: Date, hours: number) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000)
}

export function createAdminAlertSync({
  withTenantTransaction,
  notifications = createAdminNotificationService({ withTenantTransaction }),
}: {
  withTenantTransaction: TenantTransactionRunner
  notifications?: ReturnType<typeof createAdminNotificationService>
}) {
  const { getAdminUserIds, createAdminNotifications } = notifications
  async function syncAdminAlerts(context: TenantContext) {
    const adminIds = await getAdminUserIds(context)
    if (adminIds.length === 0) {
      return { success: true, results: { created: 0, checks: 0 } }
    }

    const now = new Date()
    const results = {
      created: 0,
      checks: 0,
    }

    const notifyAdmins = async (input: {
      type: NotificationType
      title: string
      message: string
      priority: NotificationPriority
      actionUrl: string
      metadata?: Record<string, unknown>
      /** Chave estavel para deduplicacao; sem ela, a mensagem unica por recurso impede coalescencia. */
      dedupeKey: string
    }) => {
      const created = await createAdminNotifications(context, {
        ...input,
        adminIds,
        dedupeWindowMs: DEDUPE_WINDOW_MS,
      })
      results.created += created.count
      results.checks += 1
    }

    const pendingQuoteCutoff = getCutoff(now, QUOTE_PENDING_HOURS)
    const pendingQuotes = await withTenantTransaction(context, (tx) =>
      tx.quote.findMany({
        where: {
          tenantId: context.tenantId,
          status: 'PENDING',
          approvedAt: null,
          rejectedAt: null,
          clientDeletedAt: null,
          createdAt: { lte: pendingQuoteCutoff },
        },
        select: { id: true },
      })
    )

    for (const quote of pendingQuotes) {
      await notifyAdmins({
        type: NotificationType.QUOTE,
        title: 'Orçamento pendente sem ação',
        message: `Um ou mais orçamentos aguardando análise há mais de ${QUOTE_PENDING_HOURS}h.`,
        priority: NotificationPriority.HIGH,
        actionUrl: '/admin/orcamentos',
        metadata: { quoteId: quote.id },
        dedupeKey: 'admin:sync:quote_pending',
      })
    }

    const approvedQuotes = await withTenantTransaction(context, (tx) =>
      tx.quote.findMany({
        where: {
          tenantId: context.tenantId,
          approvedAt: { not: null },
          status: 'PENDING',
          rejectedAt: null,
        },
        select: {
          id: true,
          approvedAt: true,
          cpf: true,
          cnpj: true,
          payments: {
            where: { tenantId: context.tenantId, method: 'BOLETO' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              dueDate: true,
              createdAt: true,
              metadata: true,
            },
          },
        },
      })
    )

    const boletoApprovalCutoff = getCutoff(now, BOLETO_AFTER_APPROVAL_HOURS)
    const boletoPendingCutoff = getCutoff(now, BOLETO_PENDING_HOURS)

    for (const quote of approvedQuotes) {
      const hasDocument = Boolean(quote.cpf || quote.cnpj)

      if (!hasDocument || !quote.approvedAt) {
        continue
      }

      const boleto = quote.payments[0] ?? null
      const approvedAt = new Date(quote.approvedAt)

      if (approvedAt <= boletoApprovalCutoff && !boleto) {
        await notifyAdmins({
          type: NotificationType.PAYMENT,
          title: 'Boleto não gerado',
          message: `Um ou mais orçamentos aprovados há mais de ${BOLETO_AFTER_APPROVAL_HOURS}h sem boleto.`,
          priority: NotificationPriority.HIGH,
          actionUrl: '/admin/orcamentos',
          metadata: { quoteId: quote.id },
          dedupeKey: 'admin:sync:boleto_not_generated',
        })
        continue
      }

      if (boleto) {
        const boletoSentAt = getBoletoSentAt(boleto.metadata)

        if (approvedAt <= boletoApprovalCutoff && !boletoSentAt) {
          await notifyAdmins({
            type: NotificationType.PAYMENT,
            title: 'Boleto não enviado',
            message: 'Um ou mais boletos ainda não foram enviados ao cliente.',
            priority: NotificationPriority.HIGH,
            actionUrl: '/admin/orcamentos',
            metadata: { quoteId: quote.id, paymentId: boleto.id },
            dedupeKey: 'admin:sync:boleto_not_sent',
          })
        }

        if (
          boletoSentAt &&
          ['PENDING', 'OVERDUE'].includes(boleto.status) &&
          boletoSentAt <= boletoPendingCutoff
        ) {
          await notifyAdmins({
            type: NotificationType.PAYMENT,
            title: 'Pagamento pendente',
            message: `Um ou mais boletos enviados há mais de ${BOLETO_PENDING_HOURS}h sem pagamento.`,
            priority: NotificationPriority.MEDIUM,
            actionUrl: '/admin/orcamentos',
            metadata: { quoteId: quote.id, paymentId: boleto.id },
            dedupeKey: 'admin:sync:payment_pending',
          })
        }
      }
    }

    const approvedNoRentalCutoff = getCutoff(now, APPROVED_NO_RENTAL_HOURS)
    const approvedNoRental = await withTenantTransaction(context, (tx) =>
      tx.quote.findMany({
        where: {
          tenantId: context.tenantId,
          status: 'APPROVED',
          convertedToRentalId: null,
        },
        select: { id: true, updatedAt: true },
      })
    )

    for (const quote of approvedNoRental) {
      if (quote.updatedAt <= approvedNoRentalCutoff) {
        await notifyAdmins({
          type: NotificationType.RENTAL,
          title: 'Orçamento aprovado sem locação',
          message:
            'Um ou mais orçamentos aprovados sem conversão para locação.',
          priority: NotificationPriority.MEDIUM,
          actionUrl: '/admin/orcamentos',
          metadata: { quoteId: quote.id },
          dedupeKey: 'admin:sync:approved_no_rental',
        })
      }
    }

    const pendingCheckinCutoff = getCutoff(now, CHECKIN_PENDING_HOURS)
    const pendingCheckins = await withTenantTransaction(context, (tx) =>
      tx.rentals.findMany({
        where: {
          tenantId: context.tenantId,
          status: 'PENDING',
          checkInAt: null,
          startdate: { lte: pendingCheckinCutoff },
        },
        select: { id: true },
      })
    )

    for (const rental of pendingCheckins) {
      await notifyAdmins({
        type: NotificationType.RENTAL,
        title: 'Check-in pendente',
        message: `Uma ou mais locações sem check-in há mais de ${CHECKIN_PENDING_HOURS}h.`,
        priority: NotificationPriority.HIGH,
        actionUrl: '/admin/rentals',
        metadata: { rentalId: rental.id },
        dedupeKey: 'admin:sync:checkin_pending',
      })
    }

    const pendingReturnCutoff = getCutoff(now, RETURN_PENDING_HOURS)
    const pendingReturns = await withTenantTransaction(context, (tx) =>
      tx.rentals.findMany({
        where: {
          tenantId: context.tenantId,
          status: 'PENDING_RETURN',
          enddate: { lte: pendingReturnCutoff },
        },
        select: { id: true },
      })
    )

    for (const rental of pendingReturns) {
      await notifyAdmins({
        type: NotificationType.RENTAL,
        title: 'Devolucao pendente',
        message: 'Uma ou mais locações aguardando devolução após o término.',
        priority: NotificationPriority.HIGH,
        actionUrl: '/admin/rentals',
        metadata: { rentalId: rental.id },
        dedupeKey: 'admin:sync:return_pending',
      })
    }

    const overdueRentals = await withTenantTransaction(context, (tx) =>
      tx.rentals.findMany({
        where: { tenantId: context.tenantId, status: 'OVERDUE' },
        select: { id: true },
      })
    )
    const overdueActive = await withTenantTransaction(context, (tx) =>
      tx.rentals.findMany({
        where: {
          tenantId: context.tenantId,
          status: 'ACTIVE',
          enddate: { lt: now },
        },
        select: { id: true },
      })
    )

    const overdueIds = new Set([
      ...overdueRentals.map((rental) => rental.id),
      ...overdueActive.map((rental) => rental.id),
    ])

    for (const rentalId of overdueIds) {
      await notifyAdmins({
        type: NotificationType.RENTAL,
        title: 'Locação em atraso',
        message: 'Uma ou mais locações em atraso.',
        priority: NotificationPriority.HIGH,
        actionUrl: '/admin/rentals',
        metadata: { rentalId },
        dedupeKey: 'admin:sync:rental_overdue',
      })
    }

    const contractCutoff = getCutoff(now, CONTRACT_PENDING_HOURS)
    const contractsMissing = await withTenantTransaction(context, (tx) =>
      tx.rentals.findMany({
        where: {
          tenantId: context.tenantId,
          status: 'ACTIVE',
          checkInAt: { not: null, lte: contractCutoff },
          contract: { is: null },
        },
        select: { id: true },
      })
    )

    for (const rental of contractsMissing) {
      await notifyAdmins({
        type: NotificationType.CONTRACT,
        title: 'Contrato pendente',
        message: 'Uma ou mais locações ativas sem contrato gerado.',
        priority: NotificationPriority.MEDIUM,
        actionUrl: '/admin/rentals',
        metadata: { rentalId: rental.id },
        dedupeKey: 'admin:sync:contract_pending',
      })
    }

    return { success: true, results }
  }

  return { syncAdminAlerts }
}
