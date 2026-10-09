'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@gb-locacoes/ui'
import { motion } from 'framer-motion'
import { Package, TrendingUp, DollarSign } from 'lucide-react'
import type { DashboardStats } from '../model/contratos'

interface TopEquipmentSectionProps {
  stats: DashboardStats | null
}

export function TopEquipmentSection({ stats }: TopEquipmentSectionProps) {
  return (
    <>
      {/* Top Equipamentos Mais Solicitados */}
      {stats?.topEquipments && stats.topEquipments.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mb-8"
        >
          <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
            <CardHeader className="relative z-10">
              <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Package className="h-5 w-5 text-white" />
                </div>
                Equipamentos Mais Solicitados
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="space-y-4">
                {stats.topEquipments.map((equipment, index) => {
                  const maxCount = stats.topEquipments?.[0]?.requestCount || 1
                  const percentage = (equipment.requestCount / maxCount) * 100

                  return (
                    <motion.div
                      key={equipment.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.55 + index * 0.1,
                        duration: 0.3,
                      }}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">
                            {equipment.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {equipment.category}
                          </p>
                        </div>
                        <div className="ml-4 text-right">
                          <p className="font-bold text-gray-900">
                            {equipment.requestCount}
                          </p>
                          <p className="text-xs text-gray-500">solicitações</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ROI por Equipamento */}
      {stats?.equipmentROI && stats.equipmentROI.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-8"
        >
          <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
            <CardHeader className="relative z-10">
              <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                ROI por Equipamento (Top 10)
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="space-y-4">
                {stats.equipmentROI
                  .sort((a, b) => b.roi - a.roi)
                  .slice(0, 10)
                  .map((equipment, index) => {
                    const maxROI = stats.equipmentROI?.[0]?.roi || 1
                    const percentage = Math.min(
                      (equipment.roi / maxROI) * 100,
                      100
                    )

                    return (
                      <motion.div
                        key={equipment.equipmentId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: 0.6 + index * 0.1,
                          duration: 0.3,
                        }}
                        className="space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">
                              {equipment.equipmentName}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                              <span>
                                Receita: R${' '}
                                {equipment.totalRevenue.toLocaleString(
                                  'pt-BR',
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )}
                              </span>
                              <span>
                                Manutenção: R${' '}
                                {equipment.totalMaintenanceCost.toLocaleString(
                                  'pt-BR',
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4 text-right">
                            <p
                              className={`font-bold text-lg ${
                                equipment.roi > 0
                                  ? 'text-green-600'
                                  : equipment.roi < 0
                                    ? 'text-red-600'
                                    : 'text-gray-600'
                              }`}
                            >
                              {equipment.roi > 0 ? '+' : ''}
                              {equipment.roi.toFixed(1)}%
                            </p>
                            <p className="text-xs text-gray-500">ROI</p>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              equipment.roi > 0
                                ? 'bg-gradient-to-r from-green-500 to-green-600'
                                : equipment.roi < 0
                                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                                  : 'bg-gray-400'
                            }`}
                            style={{ width: `${Math.abs(percentage)}%` }}
                          ></div>
                        </div>
                      </motion.div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Receita Média por Equipamento */}
      {stats?.averageRevenuePerEquipment !== undefined && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="mb-8"
        >
          <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
            <CardHeader className="relative z-10">
              <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
                Receita Média por Equipamento
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-center py-8">
                <p className="text-4xl font-bold text-green-600 mb-2">
                  R${' '}
                  {stats.averageRevenuePerEquipment.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="text-sm text-gray-500">
                  Média de receita por equipamento no período
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </>
  )
}
