'use client'

import { quoteCalendarPeriod } from '../model/calendar'
import dynamic from 'next/dynamic'
import { CalendarDays } from 'lucide-react'
import { motion } from 'framer-motion'
import { AdminCard } from '../../../widgets/cartao-admin'
import type { CalendarEvent } from '../../../widgets/calendario'
import { statusConfig, type Quote } from '../../../entities/orcamento'

const AdvancedCalendar = dynamic(
  () =>
    import('../../../widgets/calendario').then((m) => ({
      default: m.AdvancedCalendar,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] animate-pulse rounded-lg bg-gray-100" />
    ),
  }
)

interface QuotesCalendarViewProps {
  quotes: Quote[]
  openQuoteDetails: (_quote: { id: string }) => void
}

export function QuotesCalendarView({
  quotes,
  openQuoteDetails,
}: QuotesCalendarViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mb-6"
    >
      <AdminCard
        title="Calendário de Orçamentos"
        variant="flat"
        icon={<CalendarDays className="w-5 h-5 text-orange-600" />}
      >
        <AdvancedCalendar
          events={quotes.map((quote): CalendarEvent => {
            const isPending = quote.status === 'pending',
              isRejected = quote.status === 'rejected'
            const { start, end, createdAt } = quoteCalendarPeriod(quote)

            const statusColors: Record<string, string> = {
              pending: '#F97316', // token-check-allow: laranja do orçamento pendente no calendário
              approved: '#22c55e', // token-check-allow: verde do orçamento aprovado no calendário
              rejected: '#ef4444', // token-check-allow: vermelho do orçamento rejeitado no calendário
            }

            const equipmentNames =
              quote.items
                ?.map((item) => item.equipment?.name)
                .filter(Boolean)
                .join(', ') ||
              quote.equipments?.map((e) => e.name).join(', ') ||
              'Equipamentos'

            return {
              id: quote.id,
              title: `${quote.name} - ${equipmentNames}`,
              start,
              end,
              resourceId: quote.status,
              color: statusColors[quote.status] || '#6B7280', // token-check-allow: cinza do status desconhecido no calendário
              type: 'rental',
              status: quote.status,
              isPendingRequest: isPending || isRejected,
              createdAt: isPending || isRejected ? createdAt : undefined,
              metadata: {
                clientName: quote.name,
                clientEmail: quote.email,
                clientPhone: quote.phone,
                company: quote.company,
                equipmentCount:
                  quote.items?.length || quote.equipments?.length || 0,
                total: quote.totalPrice,
                equipmentNames,
              },
            }
          })}
          resources={Object.entries(statusConfig).map(([status, config]) => ({
            id: status,
            name: config.label,
          }))}
          onEventClick={(event) => openQuoteDetails({ id: event.id })}
          defaultViewMode="weekly"
        />
      </AdminCard>
    </motion.div>
  )
}
