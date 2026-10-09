'use client'

import { Button } from '@gb-locacoes/ui'
import { Card, CardContent, CardHeader, CardTitle } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { HybridTooltip } from '@gb-locacoes/ui'
import { Popover, PopoverContent, PopoverTrigger } from '@gb-locacoes/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@gb-locacoes/ui'
import { Calendar as CalendarPicker } from '../../../widgets/seletor-data'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '../../../shared/lib/cn.web'
import { formatCurrency } from '../../../shared/lib/formatting'
import { formatDate, parseLocalDate } from '../../../entities/orcamento'
import {
  Calendar,
  DollarSign,
  Download,
  Info,
  Loader2,
  Receipt,
} from 'lucide-react'
import type {
  Quote,
  QuotePayment,
  QuotePaymentTerms,
} from '../../../entities/orcamento'

export interface QuoteBoletoCardProps {
  selectedQuote: Quote
  selectedQuoteStatus: string | null
  isAdminApproved: boolean
  boletoPayment: QuotePayment | null
  boletoDueDateDraft: string
  setBoletoDueDateDraft: (_value: string) => void
  updatingBoletoDueDateId: string | null
  generatingBoletoId: string | null
  approvalPaymentTerms: QuotePaymentTerms
  setApprovalPaymentTerms: (_value: QuotePaymentTerms) => void
  isUpdating: boolean
  isSendingAdjustedQuote: boolean
  editPeriodCalendarRange: {
    fromDate: Date
    toDate: Date
    startMonth: Date
    endMonth: Date
  }
  formatDateForInput: (_value: string | null | undefined) => string
  formatPaymentStatus: (_status: string) => string
  getBoletoStatusBadgeClassName: (_status: string) => string
  handleUpdateBoletoDueDate: (
    _quoteId: string,
    _paymentId: string,
    _dueDateValue: string
  ) => void
  handleGenerateBoleto: (_quoteId: string) => void
  openFinancialFromQuote: (_quote: Quote) => void
}

export function QuoteBoletoCard({
  selectedQuote,
  selectedQuoteStatus,
  isAdminApproved,
  boletoPayment,
  boletoDueDateDraft,
  setBoletoDueDateDraft,
  updatingBoletoDueDateId,
  generatingBoletoId,
  approvalPaymentTerms,
  setApprovalPaymentTerms,
  isUpdating,
  isSendingAdjustedQuote,
  editPeriodCalendarRange,
  formatDateForInput,
  formatPaymentStatus,
  getBoletoStatusBadgeClassName,
  handleUpdateBoletoDueDate,
  handleGenerateBoleto,
  openFinancialFromQuote,
}: QuoteBoletoCardProps) {
  if (!(
    selectedQuoteStatus === 'pending' ||
    selectedQuoteStatus === 'approved' ||
    selectedQuoteStatus === 'completed' ||
    isAdminApproved
  )) {
    return null
  }

  return (
    <Card className="border border-slate-200 bg-slate-50/40 shadow-md">
      <CardHeader className="p-6">
        <CardTitle className="flex items-center gap-3 text-base font-semibold text-slate-900 sm:text-lg">
          <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg text-white">
            <DollarSign className="h-4 w-4" />
          </div>
          Boleto
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {boletoPayment &&
        (selectedQuoteStatus === 'approved' ||
          selectedQuoteStatus === 'completed' ||
          isAdminApproved) ? (
          <div className="border-t border-slate-200">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                  Valor pendente
                </p>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider shadow-sm ${getBoletoStatusBadgeClassName(
                    boletoPayment.status
                  )}`}
                >
                  {formatPaymentStatus(boletoPayment.status)}
                </span>
              </div>
              <p className="mt-0.5 text-lg font-bold text-slate-900">
                {formatCurrency(
                  selectedQuote?.finalTotal ??
                    selectedQuote?.originalTotal ??
                    selectedQuote?.totalPrice ??
                    boletoPayment.amount ??
                    0
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                  Vencimento
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {formatDate(boletoPayment.dueDate)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900 mb-2">
                  Alterar vencimento
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2 w-full">
                <div className="flex-1 min-w-[140px] sm:min-w-[180px]">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="quote-boleto-due-date"
                        variant="outline"
                        disabled={
                          updatingBoletoDueDateId === boletoPayment.id ||
                          ['PAID', 'CANCELLED', 'REFUNDED'].includes(
                            boletoPayment.status
                          )
                        }
                        className={cn(
                          'w-full justify-start text-left font-normal h-9 rounded-md border border-slate-200 bg-background text-slate-900 hover:scale-100',
                          !boletoDueDateDraft && 'text-muted-foreground'
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4 shrink-0" />
                        {boletoDueDateDraft ? (
                          format(
                            parseLocalDate(boletoDueDateDraft),
                            'dd/MM/yyyy',
                            { locale: ptBR }
                          )
                        ) : (
                          <span>Selecione a data</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 border border-gray-200 rounded-md bg-white shadow-md overflow-hidden max-w-full"
                      align="start"
                    >
                      <CalendarPicker
                        mode="single"
                        selected={
                          boletoDueDateDraft
                            ? parseLocalDate(boletoDueDateDraft)
                            : undefined
                        }
                        onSelect={(date) =>
                          setBoletoDueDateDraft(
                            date ? format(date, 'yyyy-MM-dd') : ''
                          )
                        }
                        locale={ptBR}
                        showOutsideDays={false}
                        initialFocus
                        fromDate={editPeriodCalendarRange.fromDate}
                        toDate={editPeriodCalendarRange.toDate}
                        startMonth={editPeriodCalendarRange.startMonth}
                        endMonth={editPeriodCalendarRange.endMonth}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {selectedQuote && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-9 flex-1 min-w-[140px] sm:min-w-[160px]"
                    onClick={() =>
                      handleUpdateBoletoDueDate(
                        selectedQuote.id,
                        boletoPayment.id,
                        boletoDueDateDraft
                      )
                    }
                    disabled={
                      !boletoDueDateDraft ||
                      updatingBoletoDueDateId === boletoPayment.id ||
                      ['PAID', 'CANCELLED', 'REFUNDED'].includes(
                        boletoPayment.status
                      ) ||
                      boletoDueDateDraft ===
                        formatDateForInput(boletoPayment.dueDate)
                    }
                  >
                    {updatingBoletoDueDateId === boletoPayment.id
                      ? 'Salvando...'
                      : 'Salvar vencimento'}
                  </Button>
                )}
              </div>
            </div>
            {['PAID', 'CANCELLED', 'REFUNDED'].includes(
              boletoPayment.status
            ) && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                    Aviso
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Não é possível alterar vencimento para boleto pago,
                    cancelado ou estornado.
                  </p>
                </div>
              </div>
            )}
            {boletoPayment.metadata?.digitableLine && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                    Linha digitável
                  </p>
                  <div className="mt-0.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-700 break-all">
                    {boletoPayment.metadata?.digitableLine}
                  </div>
                </div>
              </div>
            )}
            {boletoPayment.metadata?.barcode && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                    Código de barras
                  </p>
                  <div className="mt-0.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-700 break-all">
                    {boletoPayment.metadata?.barcode}
                  </div>
                </div>
              </div>
            )}
            <div className="flex w-full flex-wrap items-center justify-end gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex w-full flex-wrap items-stretch gap-2 sm:flex-nowrap">
                {boletoPayment.metadata?.pdfUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="min-w-0 flex-1"
                  >
                    <a
                      href={boletoPayment.metadata?.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download className="w-4 h-4 mr-2 shrink-0" />
                      Abrir boleto
                    </a>
                  </Button>
                )}
                {(selectedQuote?.quoteCode ||
                  selectedQuote?.legacyExternalCode) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-w-0 flex-1"
                    onClick={() => openFinancialFromQuote(selectedQuote!)}
                  >
                    <DollarSign className="w-4 h-4 mr-2 shrink-0" />
                    Ver no Financeiro
                  </Button>
                )}
              </div>
            </div>
            {boletoPayment.metadata?.boletoSentAt && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                    Enviado em
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {new Date(
                      boletoPayment.metadata.boletoSentAt
                    ).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="border-t border-slate-200">
            {selectedQuoteStatus === 'pending' && (
              <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                <Label className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                  Condição de pagamento
                </Label>
                <Select
                  value={approvalPaymentTerms}
                  onValueChange={(value) =>
                    setApprovalPaymentTerms(value as QuotePaymentTerms)
                  }
                  disabled={isUpdating || isSendingAdjustedQuote}
                >
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue placeholder="Selecione a condição" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UPFRONT">Antecipado</SelectItem>
                    <SelectItem value="ON_DELIVERY">Na entrega</SelectItem>
                    <SelectItem value="AT_END">No fim da locação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                    Status
                  </p>
                  <HybridTooltip
                    content="O botão Gerar Boleto só pode ser acionado quando o orçamento estiver aprovado."
                    side="top"
                    sideMobile="right"
                    delayDuration={300}
                  >
                    <Info className="size-4 text-gray-700 cursor-help transition-colors hover:text-orange-600 shrink-0" />
                  </HybridTooltip>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  Nenhum boleto gerado ainda.
                </p>
              </div>
              {selectedQuote && selectedQuoteStatus === 'approved' && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleGenerateBoleto(selectedQuote.id)}
                  disabled={generatingBoletoId === selectedQuote.id}
                >
                  {generatingBoletoId === selectedQuote.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Receipt className="w-4 h-4 mr-2" />
                  )}
                  {generatingBoletoId === selectedQuote.id
                    ? 'Gerando Boleto...'
                    : 'Gerar Boleto'}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
