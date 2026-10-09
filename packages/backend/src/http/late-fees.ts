import type { createQuoteLateFees } from '../modules/quotations/index'
export function createCalculateAndApplyLateFeesJob({
  calculateAndApplyLateFees,
}: {
  calculateAndApplyLateFees: ReturnType<
    typeof createQuoteLateFees
  >['calculateAndApplyLateFees']
}) {
  async function runJob(context: { tenantId: string }) {
    try {
      // Verificar secret para segurança (em produção, usar variável de ambiente)

      const result = await calculateAndApplyLateFees(context)

      return Response.json({
        success: true,
        message: 'Late fees calculated and applied',
        ...result,
      })
    } catch (error) {
      console.error('Error in late fees cron job:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
  return { runJob }
}
