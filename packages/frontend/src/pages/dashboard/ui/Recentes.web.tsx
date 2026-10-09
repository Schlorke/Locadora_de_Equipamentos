'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@gb-locacoes/ui'
import { Badge } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@gb-locacoes/ui'
import { motion } from 'framer-motion'
import {
  FileText,
  Eye,
  AlertTriangle,
  Calendar,
  Building,
  User,
} from 'lucide-react'
import { Link } from '@gb-locacoes/ui'
import type { RecentQuote } from '../model/contratos'
import { getInitials } from '../model/contratos'
import { dashboardStatusConfig } from '../model/tipos.web'

interface RecentQuotesSectionProps {
  recentQuotes: RecentQuote[]
}

export function RecentQuotesSection({
  recentQuotes,
}: RecentQuotesSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="mb-8"
    >
      <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
        <CardHeader className="relative z-10">
          <div className="flex flex-col gap-4">
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              Orçamentos Recentes
            </CardTitle>
            <div className="flex justify-center sm:justify-end">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="bg-white border-gray-200 hover:bg-white hover:border-gray-300 hover:text-orange-500"
              >
                <Link href="/admin/orcamentos">
                  <Eye className="h-4 w-4 mr-2" />
                  Ver Todos
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          {!Array.isArray(recentQuotes) || recentQuotes.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                delay: 0.35,
                duration: 0.3,
                ease: 'easeOut',
              }}
              className="text-center py-12"
            >
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-3">
                Nenhum orçamento recente
              </h3>
              <p className="text-sm md:text-base text-gray-500">
                Os orçamentos solicitados aparecerão aqui
              </p>
            </motion.div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200">
                    <TableHead className="min-w-[200px] font-semibold text-gray-700">
                      Cliente
                    </TableHead>
                    <TableHead className="hidden sm:table-cell min-w-[150px] font-semibold text-gray-700">
                      Empresa
                    </TableHead>
                    <TableHead className="hidden md:table-cell w-[100px] text-center font-semibold text-gray-700">
                      Itens
                    </TableHead>
                    <TableHead className="hidden lg:table-cell w-[120px] font-semibold text-gray-700">
                      Valor
                    </TableHead>
                    <TableHead className="w-[100px] font-semibold text-gray-700">
                      Status
                    </TableHead>
                    <TableHead className="hidden sm:table-cell w-[100px] font-semibold text-gray-700">
                      Data
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentQuotes.map((quote, index) => {
                    const StatusIcon =
                      dashboardStatusConfig[
                        quote.status as keyof typeof dashboardStatusConfig
                      ]?.icon || AlertTriangle
                    const initials = getInitials(quote.customerName)

                    return (
                      <motion.tr
                        key={quote.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: 0.35 + index * 0.08,
                          duration: 0.3,
                          ease: 'easeOut',
                        }}
                        className="hover:bg-orange-50 transition-colors duration-200"
                      >
                        <TableCell className="p-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-gradient-to-br from-blue-500 to-orange-500 text-white font-semibold"
                              role="img"
                              aria-label={
                                quote.customerName && quote.customerName !== '-'
                                  ? `Cliente: ${quote.customerName}`
                                  : 'Cliente'
                              }
                            >
                              {quote.customerImage ? (
                                <img
                                  src={quote.customerImage}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : initials ? (
                                <span className="text-sm font-semibold text-white select-none">
                                  {initials}
                                </span>
                              ) : (
                                <User className="h-5 w-5 text-white" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-900 truncate">
                                {quote.customerName}
                              </p>
                              <p className="text-sm text-gray-500 truncate">
                                {quote.customerEmail}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell p-4">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-gray-400 shrink-0" />
                            <span className="text-sm text-gray-700 truncate">
                              {quote.customerCompany || '-'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-center p-4">
                          <span className="font-semibold text-gray-900 text-sm">
                            {quote.itemsCount}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell p-4">
                          <span className="font-bold text-green-600 text-sm">
                            {quote.totalAmount
                              ? `R$ ${quote.totalAmount.toFixed(2)}`
                              : '-'}
                          </span>
                        </TableCell>
                        <TableCell className="p-4">
                          <Badge
                            className={`${dashboardStatusConfig[quote.status as keyof typeof dashboardStatusConfig]?.color} flex items-center gap-2 w-fit text-xs font-medium px-3 py-1 ${
                              quote.status === 'pending'
                                ? 'hover:bg-yellow-100 dark:hover:bg-yellow-900'
                                : quote.status === 'approved'
                                  ? 'hover:bg-green-100 dark:hover:bg-green-900'
                                  : quote.status === 'rejected'
                                    ? 'hover:bg-red-100 dark:hover:bg-red-900'
                                    : 'hover:bg-blue-100 dark:hover:bg-blue-900'
                            }`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            <span className="hidden sm:inline">
                              {
                                dashboardStatusConfig[
                                  quote.status as keyof typeof dashboardStatusConfig
                                ]?.label
                              }
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell p-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="h-4 w-4" />
                            {new Date(quote.createdAt).toLocaleDateString(
                              'pt-BR'
                            )}
                          </div>
                        </TableCell>
                      </motion.tr>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
