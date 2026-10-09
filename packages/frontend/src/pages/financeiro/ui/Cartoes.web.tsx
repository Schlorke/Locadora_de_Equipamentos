'use client'

import { motion } from 'framer-motion'
import { type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@gb-locacoes/ui'
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface StatCard {
  title: string
  value: string
  subtitle: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
}

interface FinancialStatCardsProps {
  statCards: StatCard[]
  hasSelection: boolean
}

export function FinancialStatCards({
  statCards,
  hasSelection,
}: FinancialStatCardsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
        {statCards.map((card, index) => {
          const IconComponent = card.icon
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: 0.2 + index * 0.06,
              }}
              className="group"
            >
              <Card
                className={cn(
                  'relative overflow-hidden border bg-gradient-to-br from-white via-white to-slate-50 text-gray-900 shadow-lg hover:shadow-xl transition-all duration-300 h-full hover:scale-[1.02]',
                  hasSelection
                    ? 'border-orange-300 ring-1 ring-orange-200'
                    : 'border-gray-100'
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-slate-100/60 via-white to-slate-50/40" />
                <CardContent className="relative z-10 p-4 sm:p-6">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 shadow-inner ${card.iconBg}`}
                      >
                        <IconComponent
                          className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${card.iconColor}`}
                        />
                      </div>
                      <p className="text-xs sm:text-sm text-gray-500 truncate">
                        {card.title}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 truncate">
                      {card.value}
                    </p>
                    <p className="text-xs font-medium text-gray-600 mt-1 truncate">
                      {card.subtitle}
                    </p>
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
