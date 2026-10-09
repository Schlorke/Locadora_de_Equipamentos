'use client'

import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { Package } from 'lucide-react'
import { formatCurrency } from '../../../shared/lib/formatting'
import { formatDate, getCardStatusBadge } from '../../../entities/orcamento'
import { statusConfig, type Quote } from '../../../entities/orcamento'

const KanbanPipeline = dynamic(
  () =>
    import('../../../widgets/quadro-kanban').then((m) => ({
      default: m.KanbanPipeline,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
    ),
  }
)
const KanbanMonthNavigator = dynamic(
  () =>
    import('../../../widgets/navegador-mes').then((m) => ({
      default: m.KanbanMonthNavigator,
    })),
  { ssr: false }
)

interface QuotesKanbanViewProps {
  kanbanFilteredQuotes: Array<Quote & { [key: string]: unknown }>
  kanbanMonth: Date
  setKanbanMonth: (_date: Date) => void
  itemCountsByMonth: Record<string, number>
  contentAnimReady: boolean
  kanbanMonthHasMounted: React.MutableRefObject<boolean>
  openQuoteDetails: (_quote: Quote) => void
}

export function QuotesKanbanView({
  kanbanFilteredQuotes,
  kanbanMonth,
  setKanbanMonth,
  itemCountsByMonth,
  contentAnimReady,
  kanbanMonthHasMounted,
  openQuoteDetails,
}: QuotesKanbanViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={contentAnimReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{
        duration: 0.35,
        ease: [0.25, 0.46, 0.45, 0.94],
        delay: 0.28,
      }}
      className="mb-6"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key="kanban-stable"
          initial={kanbanMonthHasMounted.current ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onAnimationComplete={() => {
            kanbanMonthHasMounted.current = true
          }}
        >
          <KanbanPipeline
            items={kanbanFilteredQuotes}
            statusConfig={statusConfig}
            onItemClick={(quote) => openQuoteDetails(quote as Quote)}
            headerContent={
              <KanbanMonthNavigator
                selectedDate={kanbanMonth}
                onDateChange={setKanbanMonth}
                itemCountsByMonth={itemCountsByMonth}
              />
            }
            columnsPerRow={{ mobile: 1, tablet: 2, desktop: 4, xl: 4 }}
            renderItem={(quote) => {
              const quoteTyped = quote as Quote
              const isRejected = quoteTyped.status === 'rejected'
              const shadowClasses = isRejected
                ? 'shadow-sm hover:shadow-md'
                : 'shadow-sm hover:shadow-md'
              const badge = getCardStatusBadge(quoteTyped)
              return (
                <div
                  className={`relative p-4 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer transition-all overflow-visible min-w-0 ${shadowClasses}`}
                  onClick={() => openQuoteDetails(quoteTyped)}
                >
                  <span
                    className={`absolute -top-2 right-2 z-10 shrink-0 whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold uppercase tracking-wider leading-tight ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  <div className="space-y-3 min-w-0">
                    <div className="space-y-1.5 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 leading-tight truncate">
                        {quoteTyped.name}
                      </p>
                      <p className="text-xs text-gray-500 leading-relaxed truncate">
                        {quoteTyped.email}
                      </p>
                      {quoteTyped.company && (
                        <p className="text-xs text-gray-400 leading-relaxed truncate">
                          {quoteTyped.company}
                        </p>
                      )}
                      {quoteTyped.quoteCode && (
                        <p className="text-[11px] text-gray-400 font-mono truncate">
                          {quoteTyped.quoteCode}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600 pt-1 min-w-0">
                      <Package className="w-3.5 h-3.5 shrink-0" />
                      <span className="leading-relaxed truncate min-w-0">
                        {Array.isArray(quoteTyped.equipments)
                          ? quoteTyped.equipments.length
                          : quoteTyped.items?.length || 0}{' '}
                        equipamento(s)
                      </span>
                    </div>
                    {(quoteTyped.finalTotal ??
                    quoteTyped.originalTotal ??
                    quoteTyped.totalPrice) ? (
                      <div className="flex items-end justify-between gap-2 pt-2 border-t border-gray-200 min-w-0">
                        <span className="text-sm font-bold text-orange-600 leading-none truncate min-w-0">
                          {formatCurrency(
                            quoteTyped.finalTotal ??
                              quoteTyped.originalTotal ??
                              quoteTyped.totalPrice ??
                              0
                          )}
                        </span>
                        <div className="text-right space-y-0.5 min-w-0 shrink-0">
                          {quoteTyped.startDate && (
                            <span className="text-xs text-gray-500 block leading-tight truncate">
                              {formatDate(quoteTyped.startDate)}
                            </span>
                          )}
                          {quoteTyped.createdAt && (
                            <span className="text-xs text-gray-400 block leading-tight truncate">
                              {new Date(
                                quoteTyped.createdAt
                              ).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            }}
          />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
