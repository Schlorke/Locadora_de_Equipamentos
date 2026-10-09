'use client'

import { Badge } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Card, CardContent } from '@gb-locacoes/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@gb-locacoes/ui'
import { SmartPagination } from '@gb-locacoes/ui'
import { motion } from 'framer-motion'
import {
  Truck,
  Calendar,
  MapPin,
  Edit,
  Eye,
  CheckCircle,
  User,
  MoreHorizontal,
} from 'lucide-react'
import { type Delivery, typeConfig } from '../model/contracts'
import { formatDate, formatAddress, getStatusBadge } from './Utilidades'

interface LogisticsTableProps {
  paginatedDeliveries: Delivery[]
  totalItems: number
  currentPage: number
  totalPages: number
  onPageChange: (_page: number) => void
  onViewDelivery: (_delivery: Delivery) => void
  onEditDelivery: (_delivery: Delivery) => void
  onUpdateStatus: (_deliveryId: string, _status: string) => void
}

export function LogisticsTable({
  paginatedDeliveries,
  totalItems,
  currentPage,
  totalPages,
  onPageChange,
  onViewDelivery,
  onEditDelivery,
  onUpdateStatus,
}: LogisticsTableProps) {
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
                      Cliente
                    </th>
                    <th className="hidden sm:table-cell text-left p-4 font-semibold text-gray-700">
                      Tipo
                    </th>
                    <th className="hidden md:table-cell text-left p-4 font-semibold text-gray-700">
                      Endereço
                    </th>
                    <th className="hidden md:table-cell text-left p-4 font-semibold text-gray-700">
                      Agendada para
                    </th>
                    <th className="hidden lg:table-cell text-left p-4 font-semibold text-gray-700">
                      Motorista
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
                  {paginatedDeliveries.map((delivery) => (
                    <tr
                      key={delivery.id}
                      className="border-b border-gray-50 hover:bg-orange-50 transition-colors group"
                    >
                      <td className="p-4">
                        <div>
                          <div className="font-medium text-gray-900">
                            {delivery.rental.users.name || 'Sem nome'}
                          </div>
                          <div className="hidden sm:block text-sm text-gray-500">
                            {delivery.rental.users.email}
                          </div>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell p-4">
                        <Badge variant="outline">
                          {typeConfig[delivery.type] || delivery.type}
                        </Badge>
                      </td>
                      <td className="hidden md:table-cell p-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600 max-w-xs">
                          <MapPin className="w-4 h-4 shrink-0" />
                          <span className="truncate">
                            {formatAddress(delivery.address)}
                          </span>
                        </div>
                      </td>
                      <td className="hidden md:table-cell p-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          {formatDate(delivery.scheduledAt)}
                        </div>
                      </td>
                      <td className="hidden lg:table-cell p-4">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <User className="w-4 h-4" />
                          {delivery.driverName || 'Não definido'}
                        </div>
                      </td>
                      <td className="p-4">{getStatusBadge(delivery.status)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
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
                                onClick={() => onViewDelivery(delivery)}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Exibir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditDelivery(delivery)}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </Button>
                          {delivery.status === 'SCHEDULED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                onUpdateStatus(delivery.id, 'IN_TRANSIT')
                              }
                            >
                              <Truck className="w-4 h-4 mr-2" />
                              Iniciar
                            </Button>
                          )}
                          {delivery.status === 'IN_TRANSIT' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                onUpdateStatus(delivery.id, 'COMPLETED')
                              }
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Concluir
                            </Button>
                          )}
                        </div>
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
