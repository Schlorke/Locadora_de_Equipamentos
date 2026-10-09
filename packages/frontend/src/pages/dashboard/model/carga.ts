'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from '@gb-locacoes/ui'
import { useScopedApiClient, isAbortError } from '../../../shared/api'
import { createDashboardApi } from '../api/dashboard'
import type {
  DashboardStats,
  RecentQuote,
  RevenueData,
  AgingData,
} from './types'

export function useDashboardData() {
  const client = useScopedApiClient(null)
  const api = useMemo(() => createDashboardApi(client), [client])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [recentQuotes, setRecentQuotes] = useState<RecentQuote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null)
  const [agingData, setAgingData] = useState<AgingData | null>(null)

  const fetchDashboardData = useCallback(async () => {
    if (!client.isCurrent()) return
    setIsLoading(true)
    setStatsError(null)
    setRecentQuotes([])

    try {
      const statsPromise = api.stats()
      const secondary = Promise.all([api.quotes(), api.revenue(), api.aging()])
      // Observe failures when the primary request prevents awaiting these reads.
      void secondary.catch(() => {})

      const statsResponse = await statsPromise
      if (!client.isCurrent()) return
      if (statsResponse.ok) {
        const statsData = statsResponse.data
        setStats(statsData || null)
        setStatsError(null)
        setIsLoading(false)

        try {
          const [quotesResponse, revenueResponse, agingResponse] =
            await secondary
          if (!client.isCurrent()) return

          if (revenueResponse.ok) {
            const revData = revenueResponse.data
            setRevenueData(revData || null)
          } else {
            setRevenueData(null)
          }

          if (agingResponse.ok) {
            const agData = agingResponse.data
            setAgingData(agData || null)
          } else {
            setAgingData(null)
          }

          if (quotesResponse.ok) {
            const quotesData = quotesResponse.data
            let rawQuotes: Array<Record<string, unknown>> = []

            if (Array.isArray(quotesData)) {
              rawQuotes = quotesData
            } else if (
              quotesData &&
              quotesData.quotes &&
              Array.isArray(quotesData.quotes)
            ) {
              rawQuotes = quotesData.quotes
            } else {
              console.warn('Quotes data is not in expected format:', quotesData)
            }

            const quotes: RecentQuote[] = rawQuotes.slice(0, 5).map((q) => ({
              id: String(q.id ?? ''),
              customerName: String(q.name || q.customerName || '-'),
              customerEmail: String(q.email || q.customerEmail || '-'),
              customerCompany:
                q.company != null && q.company !== ''
                  ? String(q.company)
                  : (q.customerCompany as string | undefined),
              totalAmount:
                typeof q.finalTotal === 'number'
                  ? q.finalTotal
                  : typeof q.totalPrice === 'number'
                    ? q.totalPrice
                    : (q.totalAmount as number | undefined),
              status: String(q.status ?? 'pending'),
              createdAt: String(q.createdAt ?? ''),
              itemsCount: Array.isArray(q.items)
                ? q.items.length
                : typeof q.itemsCount === 'number'
                  ? q.itemsCount
                  : 0,
              customerImage:
                typeof q.customerImage === 'string' && q.customerImage.trim()
                  ? q.customerImage
                  : null,
            }))
            setRecentQuotes(quotes)
          } else {
            console.warn('Failed to fetch quotes:', quotesResponse.status)
            setRecentQuotes([])
          }
        } catch (secondaryError) {
          if (isAbortError(secondaryError) || !client.isCurrent()) return
          console.error('Erro ao carregar dados secundários:', secondaryError)
          toast.error('Alguns dados do dashboard não puderam ser carregados')
          setRevenueData(null)
          setAgingData(null)
          setRecentQuotes([])
        }
      } else {
        setStats(null)
        setStatsError(
          'Não foi possível carregar os dados principais do dashboard.'
        )
        setIsLoading(false)
      }
    } catch (error) {
      if (isAbortError(error) || !client.isCurrent()) return
      console.error('Erro ao carregar dados do dashboard:', error)
      toast.error('Erro ao carregar dados do dashboard')
      setStatsError('Erro ao carregar dados do dashboard.')
      setRecentQuotes([])
      setStats(null)
      setRevenueData(null)
      setAgingData(null)
    } finally {
      if (client.isCurrent()) setIsLoading(false)
    }
  }, [api, client])

  useEffect(() => {
    setStats(null)
    setRevenueData(null)
    setAgingData(null)
    setExpandedCardId(null)
    void fetchDashboardData()
  }, [fetchDashboardData])

  const statusChartData = stats
    ? [
        { name: 'Pendentes', value: stats.pendingQuotes, color: '#f97316' }, // token-check-allow: cor do gráfico de status do dashboard
        { name: 'Aprovados', value: stats.approvedQuotes, color: '#22c55e' }, // token-check-allow: cor do gráfico de status do dashboard
        { name: 'Rejeitados', value: stats.rejectedQuotes, color: '#ef4444' }, // token-check-allow: cor do gráfico de status do dashboard
        { name: 'Concluídos', value: stats.completedQuotes, color: '#3b82f6' }, // token-check-allow: cor do gráfico de status do dashboard
      ].filter((item) => item.value > 0)
    : []

  return {
    stats,
    expandedCardId,
    setExpandedCardId,
    statsError,
    recentQuotes,
    isLoading,
    revenueData,
    agingData,
    statusChartData,
    fetchDashboardData,
  }
}
