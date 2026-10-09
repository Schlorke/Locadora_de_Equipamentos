'use client'

import Image from 'next/image'
import { XCircle, User } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@gb-locacoes/ui'
import { Badge } from '@gb-locacoes/ui'
import { type Quote } from '../../../entities/orcamento'

interface QuoteRejectionCardProps {
  selectedQuote: Quote
}

export function QuoteRejectionCard({ selectedQuote }: QuoteRejectionCardProps) {
  return (
    <Card className="border border-slate-200 bg-slate-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <XCircle className="h-4 w-4 text-slate-400" />
          Detalhes da Rejeição
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          {selectedQuote.rejectionReason === 'Cancelado pelo cliente' ? (
            <Badge className="border border-slate-200 bg-slate-100 text-xs text-slate-700 px-2.5 py-0.5 hover:bg-slate-200/80">
              <User className="mr-1.5 h-3 w-3" />
              Cancelado pelo Cliente
            </Badge>
          ) : (
            <Badge className="border border-slate-200 bg-slate-100 text-xs text-slate-700 px-2.5 py-0.5 hover:bg-slate-200/80">
              <XCircle className="mr-1.5 h-3 w-3" />
              Rejeitado pelo Administrador
            </Badge>
          )}
        </div>

        {selectedQuote.rejectedBy &&
          selectedQuote.rejectionReason !== 'Cancelado pelo cliente' && (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              {selectedQuote.rejectedBy.image ? (
                <Image
                  src={selectedQuote.rejectedBy.image}
                  alt={selectedQuote.rejectedBy.name || 'Admin'}
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-full object-cover ring-2 ring-slate-200"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 ring-2 ring-slate-100">
                  <User className="h-3.5 w-3.5 text-slate-600" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {selectedQuote.rejectedBy.name || 'Administrador'}
                </p>
                <p className="text-xs text-slate-500">
                  Rejeitou este orçamento
                </p>
              </div>
            </div>
          )}

        {selectedQuote.rejectionReason &&
          selectedQuote.rejectionReason.trim() &&
          selectedQuote.rejectionReason !== 'Cancelado pelo cliente' && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-900">
                Motivo
              </p>
              <p className="text-sm leading-relaxed text-slate-900">
                {selectedQuote.rejectionReason}
              </p>
            </div>
          )}

        {selectedQuote.rejectedAt && (
          <p className="text-xs text-slate-500">
            {selectedQuote.rejectionReason === 'Cancelado pelo cliente'
              ? 'Cancelado'
              : 'Rejeitado'}{' '}
            em: {new Date(selectedQuote.rejectedAt).toLocaleString('pt-BR')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
