'use client'

import { Card, CardContent } from '@gb-locacoes/ui'
import { motion } from 'framer-motion'
import { Activity, Percent, DollarSign, TrendingUp } from 'lucide-react'
import type { DashboardStats } from '../model/contratos'

interface BusinessMetricsSectionProps {
  stats: DashboardStats | null
}

export function BusinessMetricsSection({ stats }: BusinessMetricsSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
      className="mb-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* Taxa de Utilização da Frota */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.3, ease: 'easeOut' }}
          className="h-full"
        >
          <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm hover:shadow-2xl transition-all duration-300 h-full flex flex-col">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
            <CardContent className="relative z-10 p-6 flex flex-col flex-1">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">
                    Taxa de Utilização
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats?.utilizationRate?.toFixed(1) || 0}%
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-2.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(stats?.utilizationRate || 0, 100)}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {stats?.availableEquipments || 0} de{' '}
                {stats?.totalEquipments || 0} disponíveis
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Taxa de Conversão */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.85, duration: 0.3, ease: 'easeOut' }}
          className="h-full"
        >
          <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm hover:shadow-2xl transition-all duration-300 h-full flex flex-col">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
            <CardContent className="relative z-10 p-6 flex flex-col flex-1">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">
                    Taxa de Conversão
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats?.conversionRate?.toFixed(1) || 0}%
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Percent className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-2.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(stats?.conversionRate || 0, 100)}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {(stats?.approvedQuotes || 0) + (stats?.completedQuotes || 0)}{' '}
                de {stats?.totalQuotes || 0} orçamentos
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Ticket Médio */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.3, ease: 'easeOut' }}
          className="h-full"
        >
          <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm hover:shadow-2xl transition-all duration-300 h-full flex flex-col">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
            <CardContent className="relative z-10 p-6 flex flex-col flex-1">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Ticket Médio</p>
                  <p className="text-2xl font-bold text-gray-900">
                    R${' '}
                    {stats?.averageTicket?.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) || '0,00'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-gray-200 h-2.5 rounded-full"></div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span>Valor médio por orçamento</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
