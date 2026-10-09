'use client'

import { Card } from '@gb-locacoes/ui'
import { Badge } from '@gb-locacoes/ui'
import { cn } from '../../../shared/lib/cn.web'
import { motion, AnimatePresence } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import type React from 'react'
import { useMemo, useRef, useState, useLayoutEffect } from 'react'

export interface KanbanStatusConfig {
  key: string
  label: string
  color: string
  icon: LucideIcon
  gradient: string
}

export interface KanbanItem {
  id: string
  status: string
  [key: string]: unknown
}

export interface KanbanPipelineProps<T extends KanbanItem> {
  items: T[]
  statusConfig: Record<string, KanbanStatusConfig>
  renderItem: (_item: T) => React.ReactNode
  onItemClick?: (_item: T) => void
  /** Conteúdo do header, ex: KanbanMonthNavigator. Renderizado acima do grid de colunas. */
  headerContent?: React.ReactNode
  className?: string
  columnsPerRow?: {
    mobile?: number
    tablet?: number
    desktop?: number
    xl?: number
  }
}

// Componente wrapper que anima a altura do conteúdo via ResizeObserver.
// Mede a altura real do conteúdo filho e anima o container externo
// para transicionar suavemente entre alturas (efeito "drenagem").
// Ignora estados vazios transitórios (ex: troca de mês na busca cross-mês)
// para evitar animação collapse→expand.
function AnimatedHeight({ children }: { children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)
  const lastCommitted = useRef(0)

  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    let timeoutId: ReturnType<typeof setTimeout>
    let stabilityId: ReturnType<typeof setTimeout>

    const commit = () => {
      const h = el.getBoundingClientRect().height
      lastCommitted.current = h
      setHeight(h)
    }

    // Primeira medição no mount: garante baseline para animar já na 1ª busca.
    commit()

    const observer = new ResizeObserver(() => {
      clearTimeout(timeoutId)
      clearTimeout(stabilityId)

      timeoutId = setTimeout(() => {
        const h = el.getBoundingClientRect().height
        const prev = lastCommitted.current

        // Queda brusca para quase-zero indica estado vazio transitório
        // (ex: entre setQuotes e setKanbanMonth na busca cross-mês).
        // Aguardar conteúdo real antes de commitar a altura.
        if (prev > 80 && h < 40) {
          stabilityId = setTimeout(commit, 200)
          return
        }

        lastCommitted.current = h
        setHeight(h)
      }, 50)
    })
    observer.observe(el)
    return () => {
      clearTimeout(timeoutId)
      clearTimeout(stabilityId)
      observer.disconnect()
    }
  }, [])

  return (
    <motion.div
      animate={height !== undefined ? { height } : undefined}
      initial={false}
      transition={{
        height: {
          duration: 0.35,
          ease: [0.0, 0.0, 0.58, 1.0],
        },
      }}
      style={{ overflow: 'hidden' }}
    >
      <div ref={contentRef}>{children}</div>
    </motion.div>
  )
}

export function KanbanPipeline<T extends KanbanItem>({
  items,
  statusConfig,
  renderItem,
  onItemClick,
  headerContent,
  className = '',
  columnsPerRow = {
    mobile: 1,
    tablet: 3,
    desktop: 3,
    xl: 6,
  },
}: KanbanPipelineProps<T>) {
  // Agrupar itens por status
  const itemsByStatus = useMemo(() => {
    return Object.keys(statusConfig).reduce(
      (acc, status) => {
        acc[status] = items.filter((item) => item.status === status)
        return acc
      },
      {} as Record<string, T[]>
    )
  }, [items, statusConfig])

  // Gradientes de header por status (sutilmente menos branco, menos no esquerdo)
  const headerGradientMap: Record<string, string> = {
    pending: 'from-orange-100 via-orange-100 via-20% to-orange-200',
    approved: 'from-emerald-100 via-emerald-100 via-20% to-emerald-200',
    rejected: 'from-rose-100 via-rose-100 via-20% to-rose-200',
    completed: 'from-blue-100 via-blue-100 via-20% to-blue-200',
  }

  // Mapear valores para classes Tailwind completas (necessário porque Tailwind não suporta classes dinâmicas)
  const getGridColsClass = () => {
    const mobile = columnsPerRow.mobile || 1
    const tablet = columnsPerRow.tablet || 3
    const desktop = columnsPerRow.desktop || 3
    const xl = columnsPerRow.xl || 6

    // Mapear valores para classes completas do Tailwind
    const gridColsMap: Record<number, string> = {
      1: 'grid-cols-1',
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-4',
      5: 'grid-cols-5',
      6: 'grid-cols-6',
    }

    const mobileCol = gridColsMap[mobile] || 'grid-cols-1'
    const tabletCol = gridColsMap[tablet]
      ? `md:${gridColsMap[tablet]}`
      : 'md:grid-cols-3'
    const desktopCol = gridColsMap[desktop]
      ? `lg:${gridColsMap[desktop]}`
      : 'lg:grid-cols-3'
    const xlCol = gridColsMap[xl] ? `xl:${gridColsMap[xl]}` : 'xl:grid-cols-6'

    return `${mobileCol} ${tabletCol} ${desktopCol} ${xlCol}`
  }

  return (
    <div className={className}>
      {headerContent && (
        <div className="mb-4 md:mb-6 shrink-0">{headerContent}</div>
      )}
      <div className={`grid ${getGridColsClass()} items-start gap-4`}>
        {Object.entries(statusConfig).map(([status, config]) => {
          const statusItems = itemsByStatus[status] || []
          const showScroll = statusItems.length > 4
          const Icon = config.icon

          return (
            <Card
              key={status}
              className="bg-white shadow-lg border-0 flex flex-col min-h-[14rem] overflow-hidden max-h-[48rem]"
              style={{
                maxHeight: 'min(48rem, calc(100vh - 140px))',
              }}
            >
              <div
                className={cn(
                  'relative flex shrink-0 items-center justify-between gap-3 p-4 md:p-6 border-b border-gray-100 rounded-t-lg bg-gradient-to-r',
                  headerGradientMap[status] ??
                    'from-slate-100 via-slate-100 via-20% to-slate-200'
                )}
                role="banner"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`p-2 rounded-lg bg-gradient-to-br ${config.gradient}`}
                  >
                    <Icon className="w-4 h-4 text-white" aria-hidden />
                  </div>
                  <h3 className="font-semibold text-sm text-slate-900">
                    {config.label}
                  </h3>
                </div>
                <Badge
                  variant="outline"
                  className="size-7 min-w-7 min-h-7 p-0 rounded-full text-xs bg-white border-slate-200 text-slate-700 font-semibold shrink-0 flex items-center justify-center"
                >
                  {statusItems.length}
                </Badge>
              </div>
              <AnimatedHeight>
                <div className="pl-4 flex flex-col min-h-0">
                  <div
                    className={`space-y-2 ${showScroll ? 'overflow-y-auto' : 'overflow-hidden'} pr-4 pb-4 pt-4 min-h-0 max-h-[44rem] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-orange-500 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-orange-600 [&::-webkit-scrollbar-button]:bg-orange-500`}
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgb(249 115 22) transparent', // token-check-allow: laranja da barra do kanban
                      scrollbarGutter: showScroll
                        ? 'stable both-edges'
                        : undefined,
                    }}
                  >
                    <div className="flex flex-col gap-5 min-w-0">
                      <AnimatePresence mode="popLayout" initial={false}>
                        {Array.isArray(statusItems) &&
                          statusItems.map((item, index) => (
                            <motion.div
                              key={item.id}
                              layout="position"
                              custom={{ index }}
                              variants={{
                                hidden: ({
                                  index: idx,
                                }: {
                                  index: number
                                }) => ({
                                  opacity: 0,
                                  x: -16,
                                  y: 10,
                                  transition: {
                                    duration: 0.24,
                                    delay: idx * 0.055,
                                  },
                                }),
                                show: ({ index: idx }: { index: number }) => ({
                                  opacity: 1,
                                  x: 0,
                                  y: 0,
                                  transition: {
                                    duration: 0.24,
                                    delay: idx * 0.055,
                                  },
                                }),
                                exit: ({ index: idx }: { index: number }) => ({
                                  opacity: 0,
                                  y: -10,
                                  transition: {
                                    duration: 0.18,
                                    // Stagger normal na saída (primeiro sai primeiro, de cima para baixo)
                                    delay: idx * 0.04,
                                  },
                                }),
                              }}
                              initial="hidden"
                              animate="show"
                              exit="exit"
                              className={
                                onItemClick
                                  ? 'cursor-pointer transition-colors min-w-0'
                                  : 'min-w-0'
                              }
                              onClick={() => onItemClick?.(item)}
                            >
                              {renderItem(item)}
                            </motion.div>
                          ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </AnimatedHeight>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
