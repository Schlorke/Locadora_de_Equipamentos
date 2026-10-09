'use client'

import { useMemo } from 'react'
import { useScopedApiClient } from '../../../shared/api'
import { createQuoteApi } from '../api/quote-api'

export function useQuoteApi(tenantSlug: string | null) {
  const client = useScopedApiClient(tenantSlug)
  return useMemo(() => createQuoteApi(client, tenantSlug), [client, tenantSlug])
}
