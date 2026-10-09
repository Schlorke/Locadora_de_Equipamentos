'use client'

import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@gb-locacoes/ui'
import { AlertCircle, AlertTriangle } from 'lucide-react'

interface Debtor {
  clientName: string
  overdueAmount: number
  daysOverdue: number
  status: 'overdue' | 'attention' | 'critical'
}

interface DebtorsTableProps {
  data: Debtor[]
  expanded?: boolean
}

const statusConfig = {
  overdue: {
    label: 'Atrasado',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: AlertCircle,
  },
  attention: {
    label: 'Atenção',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: AlertTriangle,
  },
  critical: {
    label: 'Crítico',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: AlertCircle,
  },
}

function DebtorsTableInner({ data, expanded }: DebtorsTableProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={`${expanded ? 'h-[320px] lg:h-[460px]' : 'h-[280px] md:h-[320px]'} flex items-center justify-center text-gray-400`}
      >
        Sem dados disponíveis
      </div>
    )
  }

  return (
    <div
      className={`overflow-x-auto ${expanded ? 'max-h-[320px] lg:max-h-[460px] overflow-y-auto' : ''}`}
    >
      <Table>
        <TableHeader>
          <TableRow className="border-gray-200">
            <TableHead className="font-semibold text-gray-700">
              Cliente
            </TableHead>
            <TableHead className="font-semibold text-gray-700">
              Valor em Atraso
            </TableHead>
            <TableHead className="font-semibold text-gray-700">
              Dias em Atraso
            </TableHead>
            <TableHead className="font-semibold text-gray-700">
              Status
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((debtor, index) => {
            const StatusIcon = statusConfig[debtor.status]?.icon || AlertCircle
            return (
              <TableRow
                key={index}
                className="hover:bg-orange-50 transition-colors duration-200"
              >
                <TableCell className="font-semibold text-gray-900">
                  {debtor.clientName}
                </TableCell>
                <TableCell>
                  <span className="font-bold text-red-600">
                    R${' '}
                    {debtor.overdueAmount.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-gray-700">
                    {debtor.daysOverdue} Dias
                  </span>
                </TableCell>
                <TableCell>
                  <div
                    className={`${statusConfig[debtor.status]?.color} flex items-center gap-2 w-fit text-xs font-medium px-3 py-1 rounded-full`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    <span>{statusConfig[debtor.status]?.label}</span>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export const DebtorsTable = React.memo(DebtorsTableInner)
