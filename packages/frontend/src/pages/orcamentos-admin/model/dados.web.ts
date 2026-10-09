'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuotesModel, type UseQuotesDataReturn } from './dados'
export type { UseQuotesDataReturn } from './dados'
export function useQuotesData(): UseQuotesDataReturn {
  const searchParams = useSearchParams()
  const model = useQuotesModel(searchParams.get('search') || '')
  const [contentAnimReady, setContentAnimReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setContentAnimReady(true))
    })
    return () => cancelAnimationFrame(id)
  }, [])
  return { ...model, contentAnimReady }
}
