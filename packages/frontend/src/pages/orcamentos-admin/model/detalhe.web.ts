import { useSearchParams } from 'next/navigation'
import { invalidateAdminBadges } from '../../../features/selos-admin'
import { useQuoteDetailsModel, type UseQuoteDetailsParams } from './detalhe'
export type { UseQuoteDetailsParams } from './detalhe'
export function useQuoteDetails(params: UseQuoteDetailsParams) {
  const searchParams = useSearchParams()
  return useQuoteDetailsModel({
    ...params,
    requestedQuoteId: searchParams.get('quoteId'),
    invalidateBadges: invalidateAdminBadges,
  })
}
