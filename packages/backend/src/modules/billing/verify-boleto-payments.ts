import { Prisma } from '@prisma/client'
import type { createTenantBoletoVerifier } from './boleto-verification'
import type { createPaymentProcessor } from './payment-processor'
import {
  scheduledJobResult,
  type ScheduledTransaction,
  type CronBudget,
} from '../../runtime/scheduled-job'
export function createBoletoVerificationJob({
  withTenantTransaction,
  verifyTenantBoleto,
  processPayment,
}: {
  withTenantTransaction: ScheduledTransaction
  verifyTenantBoleto: ReturnType<
    typeof createTenantBoletoVerifier
  >['verifyTenantBoleto']
  processPayment: ReturnType<typeof createPaymentProcessor>['processPayment']
}) {
  async function runJob(context: { tenantId: string }, budget: CronBudget) {
    try {
      // Verificar se é chamada autorizada (Vercel Cron ou com secret)

      const now = new Date()
      const results = {
        checked: 0,
        paid: 0,
        overdue: 0,
        settled: 0,
        errors: 0,
      }

      const pendingBoletos = await withTenantTransaction(
        context,
        async (tx) => {
          const checkpoint = await tx.auditLog.findFirst({
            where: {
              tenantId: context.tenantId,
              action: 'CRON_BOLETO_CHECKPOINT',
              entity: 'cron',
              entityId: 'verify-boleto-payments',
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: { changes: true },
          })
          const changes = checkpoint?.changes
          const afterId =
            changes &&
            typeof changes === 'object' &&
            !Array.isArray(changes) &&
            typeof changes.afterId === 'string'
              ? changes.afterId
              : undefined
          const where = {
            tenantId: context.tenantId,
            method: 'BOLETO' as const,
            status: {
              in: ['PENDING', 'OVERDUE'] as Array<'PENDING' | 'OVERDUE'>,
            },
            transactionId: { not: null },
          }
          const rows = await tx.payment.findMany({
            where: { ...where, ...(afterId ? { id: { gt: afterId } } : {}) },
            orderBy: { id: 'asc' },
            take: 100,
          })
          return rows.length || !afterId
            ? rows
            : tx.payment.findMany({ where, orderBy: { id: 'asc' }, take: 100 })
        }
      )
      let lastCheckedId: string | undefined

      // Verificar cada boleto
      for (const payment of pendingBoletos) {
        if (Date.now() + budget.minRemainingMs >= budget.deadline) break
        lastCheckedId = payment.id
        try {
          results.checked++

          if (!payment.transactionId) continue

          // Verificar status no gateway
          const verification = await verifyTenantBoleto(context, {
            id: payment.id,
            transactionId: payment.transactionId,
          })

          if (verification.status === 'paid') {
            if (
              typeof verification.amount !== 'number' ||
              !Number.isFinite(verification.amount) ||
              !new Prisma.Decimal(verification.amount).equals(payment.amount)
            )
              throw new Error('PAYMENT_AMOUNT_RECONCILIATION_REQUIRED')
            await processPayment(context, payment.id, {
              status: 'PAID',
              externalId: payment.transactionId,
              paidAt: verification.paidAt || new Date(),
            })
            results.paid++
            continue
          }

          if (verification.status === 'cancelled') {
            const updated = await withTenantTransaction(context, (tx) =>
              tx.paymentAttempt.updateMany({
                where: {
                  tenantId: context.tenantId,
                  paymentId: payment.id,
                  externalId: payment.transactionId,
                  status: { in: ['QUEUED', 'PROCESSING', 'UNKNOWN', 'ISSUED'] },
                },
                data: { status: 'CANCELLED' },
              })
            )
            results.settled += updated.count
            continue
          }

          if (verification.status === 'refunded') {
            const updated = await withTenantTransaction(context, (tx) =>
              tx.payment.updateMany({
                where: {
                  tenantId: context.tenantId,
                  id: payment.id,
                  transactionId: payment.transactionId,
                  status: 'PAID',
                },
                data: {
                  status: 'REFUNDED',
                  billingStatus: 'SETTLED',
                  settledAt: new Date(),
                },
              })
            )
            results.settled += updated.count
            continue
          }

          if (
            verification.status === 'overdue' ||
            (verification.status === 'pending' && payment.dueDate < now)
          ) {
            const updated = await withTenantTransaction(context, (tx) =>
              tx.payment.updateMany({
                where: {
                  tenantId: context.tenantId,
                  id: payment.id,
                  transactionId: payment.transactionId,
                  status: 'PENDING',
                },
                data: {
                  status: 'OVERDUE',
                  billingStatus: 'UNPAID',
                  settledAt: null,
                },
              })
            )
            results.overdue += updated.count
          }
        } catch {
          console.error('Boleto reconciliation failed', {
            paymentId: payment.id,
          })
          results.errors++
        }
      }

      if (lastCheckedId)
        await withTenantTransaction(context, (tx) =>
          tx.auditLog.create({
            data: {
              tenantId: context.tenantId,
              action: 'CRON_BOLETO_CHECKPOINT',
              entity: 'cron',
              entityId: 'verify-boleto-payments',
              changes: { afterId: lastCheckedId!, checked: results.checked },
            },
          })
        )
      return scheduledJobResult({
        success: true,
        timestamp: now.toISOString(),
        results,
      })
    } catch (error) {
      console.error('Error in verify-boleto-payments cron:', error)
      return scheduledJobResult(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
  return { runJob }
}
