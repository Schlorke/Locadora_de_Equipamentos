import { createQuoteExpiration } from '@gb-locacoes/backend/quotations'
import { withTenantTransaction } from '@/lib/tenant'

export { isQuoteValid } from '@gb-locacoes/domain/orcamento'

export const { checkAndExpireQuotes } = createQuoteExpiration({
  withTenantTransaction: (context, operation) =>
    withTenantTransaction(context, operation),
})
