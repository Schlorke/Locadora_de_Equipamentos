import type { createQuoteConversion } from '../modules/rentals/index'
export function createAutoConvertApprovedQuotesJob({
  autoConvertApprovedQuotes,
}: {
  autoConvertApprovedQuotes: ReturnType<
    typeof createQuoteConversion
  >['autoConvertApprovedQuotes']
}) {
  async function runJob(context: { tenantId: string }) {
    try {
      const { processed, results } = await autoConvertApprovedQuotes(context)
      return Response.json({
        success: true,
        message: `Processed ${processed} quotes`,
        results,
      })
    } catch (error) {
      console.error('Error in auto-convert-quotes cron:', error)
      return Response.json(
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
