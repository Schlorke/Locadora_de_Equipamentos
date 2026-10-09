import type { createQuoteExpiration } from '../modules/quotations/index'
export function createCheckAndExpireQuotesJob({
  checkAndExpireQuotes,
}: {
  checkAndExpireQuotes: ReturnType<
    typeof createQuoteExpiration
  >['checkAndExpireQuotes']
}) {
  async function runJob(context: { tenantId: string }) {
    try {
      // Verificar secret para segurança (em produção, usar variável de ambiente)

      const result = await checkAndExpireQuotes(context)

      return Response.json({
        success: true,
        message: 'Quotes checked and expired',
        ...result,
      })
    } catch (error) {
      console.error('Error in expire quotes cron job:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
  return { runJob }
}
