'use client'

import { Card, CardContent } from '@gb-locacoes/ui'
import { motion } from 'framer-motion'
import type { DashboardStats } from '../model/contratos'
import { mainStatsCards, statusStatsCards } from '../model/tipos.web'

interface DashboardStatsGridProps {
  stats: DashboardStats | null
  isLoading: boolean
}

export function MainStatsGrid({ stats, isLoading }: DashboardStatsGridProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mb-8"
    >
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {mainStatsCards.map((card, index) => {
          const IconComponent = card.icon
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: 0.1 + index * 0.08,
                duration: 0.3,
                ease: 'easeOut',
              }}
              className="group"
            >
              <Card className="relative overflow-hidden border border-gray-100 bg-gradient-to-br from-white via-white to-slate-50 text-gray-900 shadow-lg hover:shadow-xl transition-all duration-300 h-full hover:scale-[1.02]">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-100/60 via-white to-slate-50/40"></div>
                <CardContent className="relative z-10 p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 shadow-inner ${card.iconBg || 'bg-gray-100'}`}
                      >
                        <IconComponent
                          className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${card.iconColor || 'text-orange-600'}`}
                        />
                      </div>
                      <p className="text-xs sm:text-sm text-gray-500 truncate">
                        {card.title}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 text-right">
                    {isLoading ? (
                      <>
                        <div className="h-7 sm:h-8 w-16 bg-gray-200 animate-pulse rounded mt-1" />
                        <div className="h-4 w-24 bg-gray-100 animate-pulse rounded mt-2" />
                      </>
                    ) : (
                      <>
                        <p className="text-sm sm:text-base lg:text-lg font-bold text-gray-900 text-left truncate">
                          {card.value(stats)}
                        </p>
                        <p className="text-xs sm:text-sm font-medium text-gray-600 mt-1 text-left">
                          {card.subtitle(stats)}
                        </p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

export function StatusStatsGrid({ stats, isLoading }: DashboardStatsGridProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mb-8"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statusStatsCards.map((card, index) => {
          const IconComponent = card.icon
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: 0.2 + index * 0.08,
                duration: 0.3,
                ease: 'easeOut',
              }}
              className="group"
            >
              <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm hover:shadow-2xl transition-all duration-300 h-full hover:scale-[1.02]">
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${card.borderColor}`}
                ></div>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-600 mb-2">{card.title}</p>
                      {isLoading ? (
                        <div className="h-8 w-12 bg-gray-200 animate-pulse rounded" />
                      ) : (
                        <p
                          className={`text-xl sm:text-2xl font-bold ${card.valueColor}`}
                        >
                          {card.value(stats)}
                        </p>
                      )}
                    </div>
                    <div
                      className={`w-12 h-12 ${card.iconBg} rounded-full flex items-center justify-center shrink-0`}
                    >
                      <IconComponent className={`h-6 w-6 ${card.iconColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
