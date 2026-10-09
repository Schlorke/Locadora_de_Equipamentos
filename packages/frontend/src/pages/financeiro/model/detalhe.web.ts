'use client'
import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  useFinancialEntryDetailsModel,
  type UseFinancialEntryDetailsParams,
} from './detalhe'
const requestRegeneration = (message: string) => window.confirm(message)
export function useFinancialEntryDetails(
  params: Omit<
    UseFinancialEntryDetailsParams,
    'navigate' | 'requestRegeneration'
  >
) {
  const router = useRouter()
  const navigate = useCallback((path: string) => router.push(path), [router])
  return useFinancialEntryDetailsModel({
    ...params,
    navigate,
    requestRegeneration,
  })
}
