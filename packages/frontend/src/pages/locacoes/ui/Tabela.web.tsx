'use client'

import { Button } from '@gb-locacoes/ui'
import { Card, CardContent } from '@gb-locacoes/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@gb-locacoes/ui'
import { SmartPagination } from '@gb-locacoes/ui'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Phone,
  Calendar,
  Eye,
  Building,
  MoreHorizontal,
} from 'lucide-react'
import type { Rental } from '../model/contratos'
import { formatCurrency, formatDate, getStatusBadge } from './formatar.web'

interface RentalTableProps {
  paginatedRentals: Rental[]
  totalItems: number
  currentPage: number
  totalPages: number
  onPageChange: (_page: number) => void
  onSelectRental: (_rental: Rental) => void
}

export function RentalTable({
  paginatedRentals,
  totalItems,
  currentPage,
  totalPages,
  onPageChange,
  onSelectRental,
}: RentalTableProps) {
  if (totalItems === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
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
                    <th className="hidden md:table-cell text-left p-4 font-semibold text-gray-700">
                      Equipamentos
                    </th>
                    <th className="hidden md:table-cell text-left p-4 font-semibold text-gray-700">
                      Período
                    </th>
                    <th className="text-left p-4 font-semibold text-gray-700">
                      Valor Total
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
                  <AnimatePresence>
                    {paginatedRentals.map((rental, index) => (
                      <motion.tr
                        key={rental.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b border-gray-50 hover:bg-orange-50 transition-colors group"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-orange-500 rounded-full flex items-center justify-center text-white font-semibold">
                              {rental.users.name?.charAt(0).toUpperCase() ||
                                '?'}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">
                                {rental.users.name || 'Sem nome'}
                              </div>
                              <div className="hidden sm:block text-sm text-gray-500">
                                {rental.users.email}
                              </div>
                              {rental.users.phone && (
                                <div className="hidden md:flex text-xs text-gray-400 items-center gap-1 mt-1">
                                  <Phone className="w-3 h-3" />
                                  {rental.users.phone}
                                </div>
                              )}
                              {rental.quote?.company && (
                                <div className="hidden md:flex text-xs text-gray-400 items-center gap-1 mt-1">
                                  <Building className="w-3 h-3" />
                                  {rental.quote.company}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="hidden md:table-cell p-4">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium">
                              {rental.rental_items.length} equipamento(s)
                            </span>
                          </div>
                        </td>
                        <td className="hidden md:table-cell p-4">
                          <div className="text-sm">
                            <div className="flex items-center gap-1 text-gray-600">
                              <Calendar className="w-3 h-3" />
                              {formatDate(rental.startdate)}
                            </div>
                            <div className="text-gray-500 ml-4">
                              até {formatDate(rental.enddate)}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="font-semibold text-lg text-green-600">
                            {formatCurrency(rental.total)}
                          </span>
                        </td>
                        <td className="p-4">{getStatusBadge(rental.status)}</td>
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
                                onClick={() => onSelectRental(rental)}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Exibir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
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
