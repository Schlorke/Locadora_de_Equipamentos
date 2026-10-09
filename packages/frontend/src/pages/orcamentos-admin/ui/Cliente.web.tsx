'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Card, CardContent } from '@gb-locacoes/ui'
import { Edit, User } from 'lucide-react'
import { getInitials } from '../../../shared/lib/formatting'
import type { Quote } from '../../../entities/orcamento'

export interface QuoteCustomerCardProps {
  selectedQuote: Quote
  onEditClick: () => void
}

export function QuoteCustomerCard({
  selectedQuote,
  onEditClick,
}: QuoteCustomerCardProps) {
  return (
    <Card className="border border-slate-200 bg-slate-50/60 shadow-md">
      <CardContent className="p-0">
        {/* Cabeçalho: avatar + nome/código; botão Editar abaixo */}
        <div className="space-y-2 p-5">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-12 w-12 shrink-0 rounded-full border-2 border-slate-200 bg-slate-100">
              {selectedQuote.customerImage ? (
                <AvatarImage
                  src={selectedQuote.customerImage}
                  alt=""
                  className="object-cover"
                />
              ) : null}
              <AvatarFallback className="rounded-full bg-gradient-to-br from-blue-500 to-orange-500 text-sm font-semibold text-white shadow-sm">
                {getInitials(selectedQuote.name) || (
                  <User className="h-5 w-5" />
                )}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                {selectedQuote.name}
              </p>
              <p className="mt-0.5 text-xs text-slate-600 sm:text-sm truncate">
                {selectedQuote.email ?? '—'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs w-full sm:w-auto gap-1.5 border-slate-200 text-slate-700"
            aria-label="Editar dados do cliente"
            onClick={onEditClick}
          >
            <Edit className="h-3 w-3" />
            Editar
          </Button>
        </div>
        {/* Lista de detalhes: Empresa, CPF, CNPJ primeiro; depois demais */}
        <div className="border-t border-slate-200">
          {selectedQuote.company && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                  Empresa
                </p>
                <p className="mt-0.5 text-sm text-slate-900">
                  {selectedQuote.company}
                </p>
              </div>
            </div>
          )}
          {selectedQuote.cpf && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                  CPF
                </p>
                <p className="mt-0.5 text-sm text-slate-900">
                  {selectedQuote.cpf}
                </p>
              </div>
            </div>
          )}
          {selectedQuote.cnpj && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                  CNPJ
                </p>
                <p className="mt-0.5 font-mono text-sm text-slate-900">
                  {selectedQuote.cnpj}
                </p>
              </div>
            </div>
          )}
          {selectedQuote.legacyExternalCode && (
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                  Código legado
                </p>
                {/* token-check-allow: lilás original do selo de código legado */}
                <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider shadow-sm bg-[#7b81f5] text-white hover:bg-[#6a70dd] transition-colors duration-200">
                  Referência
                </span>
              </div>
              <p className="text-sm font-medium text-slate-900">
                {selectedQuote.legacyExternalCode}
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                Telefone
              </p>
              <p className="mt-0.5 text-sm text-slate-900">
                {selectedQuote.phone}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                Email
              </p>
              <p className="mt-0.5 truncate text-sm text-slate-900">
                {selectedQuote.email}
              </p>
            </div>
          </div>
          {selectedQuote.cep && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                  CEP
                </p>
                <p className="mt-0.5 font-mono text-sm text-slate-900">
                  {selectedQuote.cep}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
