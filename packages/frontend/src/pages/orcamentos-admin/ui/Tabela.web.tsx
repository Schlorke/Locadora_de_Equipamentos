'use client'

import { motion } from 'framer-motion'
import { Card, CardContent } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@gb-locacoes/ui'
import { StatusTooltip } from '@gb-locacoes/ui'
import { SmartPagination } from '@gb-locacoes/ui'
import {
  Building,
  Calendar,
  DollarSign,
  Eye,
  FileText,
  Hash,
  MoreHorizontal,
  Package,
  User,
} from 'lucide-react'
import { formatCurrency, getInitials } from '../../../shared/lib/formatting'
import { formatDate, normalizeStatus } from '../../../entities/orcamento'
import { statusConfig, type Quote } from '../../../entities/orcamento'

interface QuotesTableViewProps {
  paginatedTableQuotes: Quote[]
  tableQuotes: Quote[]
  totalCount: number
  currentPage: number
  totalPages: number
  setCurrentPage: (_page: number) => void
  hoveredRowId: string | null
  setHoveredRowId: (_id: string | null) => void
  openQuoteDetails: (_quote: Quote) => void
  openFinancialFromQuote: (_quote: Quote) => void
}

const getStatusBadge = (status: Quote['status']) => {
  const normalized = normalizeStatus(status) || 'pending'
  const fallback = {
    label: status || 'Desconhecido',
    color: 'bg-orange-500 text-white shadow-sm border-0',
  }
  const config = statusConfig[normalized] ?? fallback
  return (
    <StatusTooltip
      status={status.toUpperCase()}
      label={config.label}
      className={config.color}
    />
  )
}

export function QuotesTableView({
  paginatedTableQuotes,
  tableQuotes,
  totalCount,
  currentPage,
  totalPages,
  setCurrentPage,
  hoveredRowId,
  setHoveredRowId,
  openQuoteDetails,
  openFinancialFromQuote,
}: QuotesTableViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm">
        {/* Clean depth layers for table card */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-gray-50/40"></div>

        <CardContent className="relative z-10 p-0">
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-orange-800/25 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]">
                    <th className="text-left p-4 font-semibold text-white">
                      Cliente
                    </th>
                    <th className="hidden md:table-cell text-left p-4 font-semibold text-white">
                      Equipamentos
                    </th>
                    <th className="hidden md:table-cell text-left p-4 font-semibold text-white">
                      Período
                    </th>
                    <th className="text-left p-4 font-semibold text-white">
                      Valor Total
                    </th>
                    <th className="text-left p-4 font-semibold text-white">
                      Status
                    </th>
                    <th className="hidden lg:table-cell text-left p-4 font-semibold text-white">
                      Data
                    </th>
                    <th className="text-left p-4 font-semibold text-white">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(paginatedTableQuotes) &&
                    paginatedTableQuotes.map((quote, index) => {
                      const initials = getInitials(quote.name)
                      return (
                        <motion.tr
                          key={quote.id}
                          initial={{ opacity: 0, x: -32 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            duration: 0.24,
                            ease: 'easeOut',
                            delay: index * 0.055,
                          }}
                          className="border-b border-gray-100 transition-colors group hover:bg-orange-50"
                          style={{
                            backgroundColor:
                              hoveredRowId === quote.id
                                ? 'rgba(254, 243, 199, 0.3)' // token-check-allow: âmbar do hover da linha do orçamento
                                : undefined,
                          }}
                          onMouseEnter={() => setHoveredRowId(quote.id)}
                          onMouseLeave={() => setHoveredRowId(null)}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-gradient-to-br from-blue-500 to-orange-500 text-white font-semibold"
                                role="img"
                                aria-label={
                                  quote.name
                                    ? `Cliente: ${quote.name}`
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
                              <div>
                                <div className="font-medium text-gray-900">
                                  {quote.name}
                                </div>
                                <div className="hidden sm:block text-sm text-gray-500">
                                  {quote.email}
                                </div>
                                {(quote.quoteCode ||
                                  quote.legacyExternalCode) && (
                                  <div className="hidden md:flex text-xs text-gray-500 mt-0.5 items-center gap-1">
                                    <Hash className="w-3 h-3" />
                                    {quote.quoteCode || quote.id}
                                  </div>
                                )}
                                {quote.company && (
                                  <div className="hidden md:flex text-xs text-gray-400 items-center gap-1 mt-1">
                                    <Building className="w-3 h-3" />
                                    {quote.company}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="hidden md:table-cell p-4">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-medium">
                                {Array.isArray(quote.equipments)
                                  ? quote.equipments.length
                                  : quote.items?.length || 0}{' '}
                                equipamento(s)
                              </span>
                            </div>
                          </td>
                          <td className="hidden md:table-cell p-4">
                            <div className="text-sm">
                              {quote.startDate && quote.endDate ? (
                                <>
                                  <div className="flex items-center gap-1 text-gray-600">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(quote.startDate)}
                                  </div>
                                  <div className="text-gray-500 ml-4">
                                    até {formatDate(quote.endDate)}
                                  </div>
                                </>
                              ) : quote.items &&
                                quote.items.length > 0 &&
                                quote.items[0]?.days ? (
                                <div className="text-gray-600 font-medium">
                                  {quote.items[0].days}{' '}
                                  {quote.items[0].days === 1 ? 'dia' : 'dias'}
                                </div>
                              ) : (
                                <div className="text-gray-400 italic">
                                  Não definido
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="font-semibold text-lg text-green-600">
                              {formatCurrency(
                                quote.finalTotal ??
                                  quote.originalTotal ??
                                  quote.totalPrice ??
                                  0
                              )}
                            </span>
                          </td>
                          <td className="p-4">
                            {getStatusBadge(quote.status)}
                          </td>
                          <td className="hidden lg:table-cell p-4">
                            <div className="text-sm text-gray-600">
                              {new Date(quote.createdAt).toLocaleDateString(
                                'pt-BR'
                              )}
                            </div>
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
                                  onClick={() => openQuoteDetails(quote)}
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  Exibir (Modal)
                                </DropdownMenuItem>
                                {(quote.quoteCode ||
                                  quote.legacyExternalCode) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() =>
                                        openFinancialFromQuote(quote)
                                      }
                                    >
                                      <DollarSign className="w-4 h-4 mr-2" />
                                      Ver no Financeiro
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </motion.tr>
                      )
                    })}
                  {(!Array.isArray(tableQuotes) ||
                    tableQuotes.length === 0) && (
                    <tr>
                      <td colSpan={100} className="p-12">
                        <div className="text-center">
                          <div className="text-gray-400 mb-4">
                            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg font-medium text-gray-600 mb-2">
                              Nenhum orçamento encontrado
                            </p>
                            <p className="text-sm text-gray-500">
                              Tente ajustar os filtros ou aguarde novos
                              orçamentos
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {tableQuotes.length > 0 && totalPages > 1 && (
              <div className="flex flex-col items-center gap-3 px-4 py-4 border-t border-gray-100">
                <SmartPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  className="mx-auto flex w-full justify-center py-2"
                />
                <p className="text-sm text-gray-600">
                  Mostrando {tableQuotes.length} de {totalCount} orçamentos
                </p>
              </div>
            )}
          </>
        </CardContent>
      </Card>
    </motion.div>
  )
}
