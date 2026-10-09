import {
  scheduledJobResult,
  type ScheduledTransaction,
} from '../../runtime/scheduled-job'
export function createBoletoOverdueAlerts({
  withTenantTransaction,
  logger,
}: {
  withTenantTransaction: ScheduledTransaction
  logger: { info(message: string): void }
}) {
  async function runJob(context: { tenantId: string }) {
    try {
      // Verificar se é chamada autorizada

      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(23, 59, 59, 999)

      const threeDaysAgo = new Date(now)
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

      const results = {
        dueTomorrow: 0,
        overdue: 0,
        emailsSent: 0,
        errors: 0,
      }

      // Boletos que vencem amanhã
      const dueTomorrow = await withTenantTransaction(context, (tx) =>
        tx.payment.findMany({
          where: {
            method: 'BOLETO',
            status: 'PENDING',
            dueDate: {
              gte: new Date(
                tomorrow.getFullYear(),
                tomorrow.getMonth(),
                tomorrow.getDate()
              ),
              lte: tomorrow,
            },
          },
          include: {
            rental: {
              include: {
                users: {
                  select: {
                    email: true,
                    name: true,
                  },
                },
              },
            },
            quote: {
              include: {
                user: {
                  select: {
                    email: true,
                    name: true,
                  },
                },
              },
            },
          },
        })
      )

      // Boletos vencidos há menos de 3 dias
      const overdue = await withTenantTransaction(context, (tx) =>
        tx.payment.findMany({
          where: {
            method: 'BOLETO',
            status: {
              in: ['PENDING', 'OVERDUE'],
            },
            dueDate: {
              gte: threeDaysAgo,
              lt: now,
            },
          },
          include: {
            rental: {
              include: {
                users: {
                  select: {
                    email: true,
                    name: true,
                  },
                },
              },
            },
            quote: {
              include: {
                user: {
                  select: {
                    email: true,
                    name: true,
                  },
                },
              },
            },
          },
        })
      )

      results.dueTomorrow = dueTomorrow.length
      results.overdue = overdue.length

      // O alerta por e-mail ao cliente ainda não é enviado (nenhum canal está ligado a este cron): por ora ele
      // só registra o alerta no log, pelo id do pagamento e sem dado pessoal do cliente.
      for (const payment of [...dueTomorrow, ...overdue]) {
        try {
          const customer = payment.rental?.users || payment.quote?.user
          if (!customer?.email) continue

          logger.info(
            `[BOLETO ALERT] Payment ${payment.id} - ${payment.dueDate > now ? 'Vence amanhã' : 'Vencido'}`
          )
          results.emailsSent++
        } catch (error) {
          console.error(`Error sending alert for payment ${payment.id}:`, error)
          results.errors++
        }
      }

      return scheduledJobResult({
        success: true,
        timestamp: now.toISOString(),
        results,
      })
    } catch (error) {
      console.error('Error in boleto-overdue-alerts cron:', error)
      return scheduledJobResult(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
  return { runJob }
}
