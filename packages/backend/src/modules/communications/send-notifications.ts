import {
  scheduledJobResult,
  type ScheduledTransaction,
} from '../../runtime/scheduled-job'
export function createNotificationJob({
  withTenantTransaction,
}: {
  withTenantTransaction: ScheduledTransaction
}) {
  async function runJob(context: { tenantId: string }) {
    try {
      // Verificar se é uma chamada autorizada (Vercel Cron ou com secret)

      const results = {
        rentalReminders: 0,
        overdueAlerts: 0,
        maintenanceAlerts: 0,
        errors: [] as string[],
      }

      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)

      // 1. Lembretes de devolução (24h antes)
      try {
        const rentalsDueTomorrow = await withTenantTransaction(context, (tx) =>
          tx.rentals.findMany({
            where: {
              status: 'ACTIVE',
              enddate: {
                gte: now,
                lte: tomorrow,
              },
            },
            include: {
              users: {
                select: {
                  email: true,
                  name: true,
                },
              },
            },
          })
        )

        for (const _rental of rentalsDueTomorrow) {
          // Em produção, enviar email/SMS/WhatsApp
          // await sendRentalReminderEmail(_rental)
          results.rentalReminders++
        }
      } catch (error) {
        results.errors.push(
          `Rental reminders: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }

      // 2. Alertas de locações atrasadas
      try {
        const overdueRentals = await withTenantTransaction(context, (tx) =>
          tx.rentals.findMany({
            where: {
              status: 'ACTIVE',
              enddate: {
                lt: now,
              },
            },
            include: {
              users: {
                select: {
                  email: true,
                  name: true,
                },
              },
            },
          })
        )

        for (const rental of overdueRentals) {
          // Atualizar status para OVERDUE
          const updated = await withTenantTransaction(context, (tx) =>
            tx.rentals.updateMany({
              where: {
                id: rental.id,
                tenantId: context.tenantId,
                status: 'ACTIVE',
              },
              data: { status: 'OVERDUE' },
            })
          )

          // Em produção, enviar email/SMS/WhatsApp
          // await sendOverdueAlertEmail(rental)
          results.overdueAlerts += updated.count
        }
      } catch (error) {
        results.errors.push(
          `Overdue alerts: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }

      // 3. Alertas de manutenção vencida
      try {
        const overdueMaintenances = await withTenantTransaction(context, (tx) =>
          tx.maintenance.findMany({
            where: {
              status: 'SCHEDULED',
              scheduledAt: {
                lt: now,
              },
            },
            include: {
              equipment: {
                select: {
                  name: true,
                },
              },
            },
          })
        )

        for (const _maintenance of overdueMaintenances) {
          // Em produção, enviar email/SMS/WhatsApp para equipe de manutenção
          // await sendMaintenanceAlertEmail(_maintenance)
          results.maintenanceAlerts++
        }
      } catch (error) {
        results.errors.push(
          `Maintenance alerts: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }

      return scheduledJobResult({
        success: true,
        message: 'Notifications processed',
        results,
      })
    } catch (error) {
      console.error('Error in send-notifications cron:', error)
      return scheduledJobResult(
        {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  }
  return { runJob }
}
