'use client'

import { useCallback, useRef } from 'react'
import {
  Calendar,
  DollarSign,
  Eye,
  FileText,
  Hash,
  MoreHorizontal,
  Trash2,
  TrendingUp,
  User,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@gb-locacoes/ui'
import { Card, CardContent } from '@gb-locacoes/ui'
import { Checkbox } from '@gb-locacoes/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@gb-locacoes/ui'
import { SmartPagination } from '@gb-locacoes/ui'
import { StatusTooltip } from '@gb-locacoes/ui'
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
import { formatDocument } from '../../../entities/orcamento'
import { formatCurrency, getInitials } from '../../../shared/lib/formatting'
import { statusLabel, statusBadgeClass, type FinancialEntry } from '../model/tipos'

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('pt-BR')
}

interface FinancialTableViewProps {
  entries: FinancialEntry[]
  paginatedEntries: FinancialEntry[]
  searchTerm: string
  statusFilter: string
  periodFilter: string
  tableTotalPages: number
  tableCurrentPage: number
  setTablePage: (_page: number) => void
  selectedEntryIds: Set<string>
  setSelectedEntryIds: React.Dispatch<React.SetStateAction<Set<string>>>
  allOnPageSelected: boolean
  someOnPageSelected: boolean
  toggleSelectAllOnPage: () => void
  toggleEntrySelection: (_id: string) => void
  isSelectionMode: boolean
  setSelectedEntry: (_entry: FinancialEntry) => void
  openQuoteFromEntry: (_entry: FinancialEntry) => void
  setEntryIdToDelete: (_id: string | null) => void
  setShowDeleteConfirm: (_show: boolean) => void
}

export function FinancialTableView({
  entries,
  paginatedEntries,
  searchTerm,
  statusFilter,
  periodFilter,
  tableTotalPages,
  tableCurrentPage,
  setTablePage,
  selectedEntryIds,
  setSelectedEntryIds,
  allOnPageSelected,
  someOnPageSelected,
  toggleSelectAllOnPage,
  toggleEntrySelection,
  isSelectionMode,
  setSelectedEntry,
  openQuoteFromEntry,
  setEntryIdToDelete,
  setShowDeleteConfirm,
}: FinancialTableViewProps) {
  // Long-press (touch-hold) to select rows on mobile — Outlook-style
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggeredRef = useRef(false)

  const handleRowTouchStart = useCallback(
    (entryId: string) => {
      longPressTriggeredRef.current = false
      longPressTimerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true
        toggleEntrySelection(entryId)
        if (navigator.vibrate) navigator.vibrate(50)
      }, 500)
    },
    [toggleEntrySelection]
  )

  const handleRowTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const handleRowTouchMove = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30" />
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-gray-50/40" />
        <CardContent className="relative z-10 p-0">
          {entries.length === 0 ? (
            <div className="p-12">
              <div className="text-center">
                <div className="text-gray-400 mb-4">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium text-gray-600 mb-2">
                    Nenhum lançamento encontrado
                  </p>
                  <p className="text-sm text-gray-500">
                    {searchTerm ||
                    statusFilter !== 'all' ||
                    periodFilter !== 'all'
                      ? 'Tente ajustar os filtros para encontrar lançamentos'
                      : 'Os lançamentos financeiros aparecerão aqui'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {selectedEntryIds.size > 0 && (
                <div className="flex items-center gap-3 px-4 py-2 border-b border-orange-800/25 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 border-gray-200 bg-white text-gray-700 hover:text-orange-600 hover:shadow-md transition-all"
                    onClick={() => setSelectedEntryIds(new Set())}
                  >
                    Desmarcar
                  </Button>
                  <span className="text-sm font-medium text-white">
                    {selectedEntryIds.size} lançamento(s) selecionado(s)
                  </span>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-orange-800/25 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]">
                      <th className="text-left p-4 font-semibold text-white">
                        <div className="flex items-center gap-3">
                          <div className="hidden md:flex items-center justify-center w-10 shrink-0">
                            <Checkbox
                              checked={
                                allOnPageSelected
                                  ? true
                                  : someOnPageSelected
                                    ? 'indeterminate'
                                    : false
                              }
                              onCheckedChange={toggleSelectAllOnPage}
                              aria-label="Selecionar todos os lançamentos da página"
                              variant="header"
                            />
                          </div>
                          <span>Cliente</span>
                        </div>
                      </th>
                      <th className="hidden sm:table-cell text-left p-4 font-semibold text-white">
                        Valores
                      </th>
                      <th className="hidden lg:table-cell text-left p-4 font-semibold text-white">
                        Nº Nota
                      </th>
                      <th className="text-left p-4 font-semibold text-white hidden lg:table-cell">
                        Datas
                      </th>
                      <th className="text-left p-4 font-semibold text-white">
                        Status
                      </th>
                      <th className="hidden lg:table-cell text-left p-4 font-semibold text-white">
                        Documento
                      </th>
                      <th className="text-center p-4 font-semibold text-white">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEntries.map((entry, index) => {
                      const initials = getInitials(entry.customerName)
                      return (
                        <tr
                          key={entry.id}
                          className={cn(
                            'border-b border-gray-100 transition-colors group hover:bg-orange-50 animate-in fade-in slide-in-from-left-2 duration-200',
                            selectedEntryIds.has(entry.id) && 'bg-orange-50/80'
                          )}
                          style={{
                            animationDelay: `${index * 30}ms`,
                            animationFillMode: 'backwards',
                          }}
                          onTouchStart={() => handleRowTouchStart(entry.id)}
                          onTouchEnd={handleRowTouchEnd}
                          onTouchMove={handleRowTouchMove}
                          onContextMenu={(e) => {
                            if (longPressTriggeredRef.current)
                              e.preventDefault()
                          }}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {/* Avatar-to-Checkbox swap container */}
                              <div className="relative w-10 h-10 shrink-0">
                                {/* Mobile (< md): avatar by default, checkbox in selection mode (long-press) */}
                                <div className="relative w-full h-full md:hidden">
                                  <div
                                    className={cn(
                                      'absolute inset-0 flex items-center justify-center rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-orange-500 text-white font-semibold',
                                      isSelectionMode ? 'hidden' : 'flex'
                                    )}
                                    role="img"
                                    aria-label={
                                      entry.customerName
                                        ? `Cliente: ${entry.customerName}`
                                        : 'Cliente'
                                    }
                                  >
                                    {initials ? (
                                      <span className="text-sm font-semibold text-white select-none">
                                        {initials}
                                      </span>
                                    ) : (
                                      <User className="h-5 w-5 text-white" />
                                    )}
                                  </div>
                                  <div
                                    className={cn(
                                      'absolute inset-0 items-center justify-center',
                                      isSelectionMode ? 'flex' : 'hidden'
                                    )}
                                  >
                                    <Checkbox
                                      checked={selectedEntryIds.has(entry.id)}
                                      onCheckedChange={() =>
                                        toggleEntrySelection(entry.id)
                                      }
                                      aria-label={`Selecionar ${entry.customerName}`}
                                    />
                                  </div>
                                </div>
                                {/* Desktop (≥ md): avatar-to-checkbox swap on hover over avatar only */}
                                <div className="hidden md:block w-full h-full group/avatar">
                                  <div
                                    className={cn(
                                      'absolute inset-0 flex items-center justify-center rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-orange-500 text-white font-semibold transition-opacity duration-150',
                                      selectedEntryIds.has(entry.id)
                                        ? 'opacity-0 pointer-events-none'
                                        : 'opacity-100 group-hover/avatar:opacity-0 group-hover/avatar:pointer-events-none'
                                    )}
                                    role="img"
                                    aria-label={
                                      entry.customerName
                                        ? `Cliente: ${entry.customerName}`
                                        : 'Cliente'
                                    }
                                  >
                                    {initials ? (
                                      <span className="text-sm font-semibold text-white select-none">
                                        {initials}
                                      </span>
                                    ) : (
                                      <User className="h-5 w-5 text-white" />
                                    )}
                                  </div>
                                  <div
                                    className={cn(
                                      'absolute inset-0 flex items-center justify-center transition-opacity duration-150',
                                      selectedEntryIds.has(entry.id)
                                        ? 'opacity-100'
                                        : 'opacity-0 pointer-events-none group-hover/avatar:opacity-100 group-hover/avatar:pointer-events-auto'
                                    )}
                                  >
                                    <Checkbox
                                      checked={selectedEntryIds.has(entry.id)}
                                      onCheckedChange={() =>
                                        toggleEntrySelection(entry.id)
                                      }
                                      aria-label={`Selecionar ${entry.customerName}`}
                                    />
                                  </div>
                                </div>
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {entry.customerName}
                                </div>
                                {entry.customerEmail && (
                                  <div className="hidden sm:block text-sm text-gray-500">
                                    {entry.customerEmail}
                                  </div>
                                )}
                                {entry.quoteCode && (
                                  <div className="hidden md:flex text-xs text-gray-500 mt-0.5 items-center gap-1">
                                    <Hash className="w-3 h-3" />
                                    {entry.quoteCode}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="hidden sm:table-cell p-4">
                            <div>
                              <span className="font-semibold text-lg text-green-600">
                                {formatCurrency(entry.grossAmount)}
                              </span>
                              <div className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                                <TrendingUp className="w-3 h-3" />
                                Líq. {formatCurrency(entry.netAmount)}
                              </div>
                            </div>
                          </td>
                          <td className="hidden lg:table-cell p-4">
                            <div className="text-sm text-gray-600">
                              {entry.invoiceNumber || (
                                <span className="text-gray-400 italic">
                                  Não emitida
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 hidden lg:table-cell">
                            <div className="flex flex-col gap-2 py-0.5">
                              <div className="flex items-center gap-1.5 text-sm">
                                <Calendar
                                  className="w-3.5 h-3.5 shrink-0 text-gray-400"
                                  aria-hidden
                                />
                                <span className="text-gray-500 shrink-0">
                                  Boleto:
                                </span>
                                <span
                                  className={
                                    entry.boletoIssuedAt &&
                                    formatDate(entry.boletoIssuedAt) !== '-'
                                      ? 'text-gray-800 font-medium'
                                      : 'text-gray-400'
                                  }
                                >
                                  {entry.boletoIssuedAt &&
                                  formatDate(entry.boletoIssuedAt) !== '-'
                                    ? formatDate(entry.boletoIssuedAt)
                                    : '—'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-sm">
                                <FileText
                                  className="w-3.5 h-3.5 shrink-0 text-gray-400"
                                  aria-hidden
                                />
                                <span className="text-gray-500 shrink-0">
                                  NF:
                                </span>
                                <span
                                  className={
                                    entry.invoiceIssuedAt &&
                                    formatDate(entry.invoiceIssuedAt) !== '-'
                                      ? 'text-gray-800 font-medium'
                                      : 'text-gray-400'
                                  }
                                >
                                  {entry.invoiceIssuedAt &&
                                  formatDate(entry.invoiceIssuedAt) !== '-'
                                    ? formatDate(entry.invoiceIssuedAt)
                                    : '—'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-sm">
                                <DollarSign
                                  className="w-3.5 h-3.5 shrink-0 text-gray-400"
                                  aria-hidden
                                />
                                <span className="text-gray-500 shrink-0">
                                  Pago:
                                </span>
                                <span
                                  className={
                                    entry.paidAt &&
                                    formatDate(entry.paidAt) !== '-'
                                      ? 'text-green-700 font-semibold'
                                      : 'text-gray-400'
                                  }
                                >
                                  {entry.paidAt &&
                                  formatDate(entry.paidAt) !== '-'
                                    ? formatDate(entry.paidAt)
                                    : '—'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <StatusTooltip
                              status={entry.billingStatus}
                              label={statusLabel[entry.billingStatus]}
                              className={statusBadgeClass[entry.billingStatus]}
                            />
                          </td>
                          <td className="hidden lg:table-cell p-4">
                            <div className="text-sm">
                              <span className="font-medium text-gray-700">
                                {entry.taxDocumentType}
                              </span>
                              <div className="text-sm text-gray-500 mt-0.5">
                                {entry.customerDocument
                                  ? formatDocument(entry.customerDocument)
                                  : '-'}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <DropdownMenu modal={false}>
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
                                  onClick={() => setSelectedEntry(entry)}
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  Exibir
                                </DropdownMenuItem>
                                {(entry.quoteCode ||
                                  entry.legacyExternalCode ||
                                  entry.quoteId) && (
                                  <DropdownMenuItem
                                    onClick={() => openQuoteFromEntry(entry)}
                                  >
                                    <FileText className="w-4 h-4 mr-2" />
                                    Ver orçamento
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEntryIdToDelete(entry.id)
                                    setShowDeleteConfirm(true)
                                  }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Deletar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {entries.length > 0 && tableTotalPages > 1 && (
                <div className="flex flex-col items-center gap-3 px-4 py-4 border-t border-gray-100">
                  <SmartPagination
                    currentPage={tableCurrentPage}
                    totalPages={tableTotalPages}
                    onPageChange={setTablePage}
                    className="mx-auto flex w-full justify-center py-2"
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
