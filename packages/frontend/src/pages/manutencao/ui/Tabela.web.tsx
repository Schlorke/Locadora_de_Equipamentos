'use client'

import { Button } from '@gb-locacoes/ui'
import { Badge } from '@gb-locacoes/ui'
import { Card, CardContent } from '@gb-locacoes/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@gb-locacoes/ui'
import { SmartPagination } from '@gb-locacoes/ui'
import { motion } from 'framer-motion'
import { Eye, Calendar, MoreHorizontal } from 'lucide-react'
import { type Maintenance, typeConfig } from '../model/contracts'
import { formatCurrency, formatDate, getStatusBadge } from './formatar'

interface MaintenanceTableProps {
  paginatedMaintenances: Maintenance[]
  totalItems: number
  currentPage: number
  totalPages: number
  onPageChange: (_page: number) => void
  onSelectMaintenance: (_maintenance: Maintenance) => void
}

export function MaintenanceTable({
  paginatedMaintenances,
  totalItems,
  currentPage,
  totalPages,
  onPageChange,
  onSelectMaintenance,
}: MaintenanceTableProps) {
  if (totalItems === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mb-6"
    >
      <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm">
        <CardContent className="relative z-10 p-0">
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left p-4 font-semibold text-gray-700">
                      Equipamento
                    </th>
                    <th className="hidden sm:table-cell text-left p-4 font-semibold text-gray-700">
                      Tipo
                    </th>
                    <th className="hidden md:table-cell text-left p-4 font-semibold text-gray-700">
                      Agendada para
                    </th>
                    <th className="hidden lg:table-cell text-left p-4 font-semibold text-gray-700">
                      Técnico
                    </th>
                    <th className="hidden md:table-cell text-left p-4 font-semibold text-gray-700">
                      Custo
                    </th>
                    <th className="text-left p-4 font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="text-left p-4 font-semibold text-gray-700">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMaintenances.map((maintenance) => (
                    <tr
                      key={maintenance.id}
                      className="border-b border-gray-50 hover:bg-orange-50 transition-colors group"
                    >
                      <td className="p-4">
                        <div className="font-medium text-gray-900">
                          {maintenance.equipment.name}
                        </div>
                        {maintenance.equipment.category && (
                          <div className="hidden sm:block text-sm text-gray-500">
                            {maintenance.equipment.category.name}
                          </div>
                        )}
                      </td>
                      <td className="hidden sm:table-cell p-4">
                        <Badge variant="outline">
                          {typeConfig[maintenance.type] || maintenance.type}
                        </Badge>
                      </td>
                      <td className="hidden md:table-cell p-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          {formatDate(maintenance.scheduledAt)}
                        </div>
                      </td>
                      <td className="hidden lg:table-cell p-4">
                        <span className="text-sm text-gray-700">
                          {maintenance.technician || 'Não definido'}
                        </span>
                      </td>
                      <td className="hidden md:table-cell p-4">
                        <span className="font-semibold text-green-600">
                          {formatCurrency(maintenance.cost)}
                        </span>
                      </td>
                      <td className="p-4">
                        {getStatusBadge(maintenance.status)}
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 border border-gray-200 bg-white shadow opacity-0 transition-all group-hover:opacity-100 hover:shadow-md hover:text-orange-600"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => onSelectMaintenance(maintenance)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Exibir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalItems > 0 && totalPages > 1 && (
              <div className="flex flex-col items-center gap-3 px-4 py-4 border-t border-gray-100">
                <SmartPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={onPageChange}
                  className="mx-auto flex w-full justify-center py-2"
                />
              </div>
            )}
          </>
        </CardContent>
      </Card>
    </motion.div>
  )
}
