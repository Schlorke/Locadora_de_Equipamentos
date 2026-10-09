'use client'
import { useCallback, useMemo } from 'react'
import { toast } from '../../../shared/lib/toast'
import { isAbortError, type HttpClient } from '../../../shared/api'
import { createFinancialApi } from '../api/financial'
export interface FinancialFile {
  blob: Blob
  name: string
  isCurrent(): boolean
  dialogTitle?: string
}
export interface FinancialFileTarget {
  isOpen(): boolean
  deliver(file: FinancialFile): void | Promise<void>
  close(): void
}
export interface FinancialFilePorts {
  open(kind: 'report' | 'oficio'): FinancialFileTarget | null
}
const fileNames = {
  pdf: 'relatorio-financeiro-oficio.pdf',
  xlsx: 'relatorio-financeiro.xlsx',
  csv: 'relatorio-financeiro.csv',
}
export function useFinancialExport(
  client: HttpClient & { isCurrent(): boolean },
  ports: FinancialFilePorts
) {
  const api = useMemo(() => createFinancialApi(client), [client])
  return useCallback(
    async (query: string, format: keyof typeof fileNames) => {
      if (!client.isCurrent()) return
      const target = ports.open('report')
      if (!target) return
      try {
        const file = await api.exportFile(query)
        if (!client.isCurrent()) {
          target.close()
          return
        }
        if (!file.ok) {
          target.close()
          toast.error('Erro ao exportar relatório financeiro')
          return
        }
        if (!target.isOpen()) return
        await target.deliver({
          blob: file.blob,
          name: fileNames[format],
          isCurrent: client.isCurrent,
          dialogTitle: 'Baixar Relatório Financeiro',
        })
      } catch (error) {
        target.close()
        if (isAbortError(error) || !client.isCurrent()) return
        toast.error('Erro ao exportar relatório financeiro')
      }
    },
    [api, client, ports]
  )
}
