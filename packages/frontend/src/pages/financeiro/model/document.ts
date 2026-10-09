'use client'
import { useCallback, useMemo } from 'react'
import { toast } from '../../../shared/lib/toast'
import { useScopedApiClient, isAbortError } from '../../../shared/api'
import { createFinancialDocumentsApi } from '../api/documents'
import type { FinancialFilePorts } from './export'
export function useFinancialDocument(
  entryId: string | null,
  ports: FinancialFilePorts
) {
  const client = useScopedApiClient(entryId)
  const api = useMemo(() => createFinancialDocumentsApi(client), [client])
  return useCallback(async () => {
    if (!entryId || !client.isCurrent()) return
    const target = ports.open('oficio')
    try {
      const result = await api.oficio(entryId)
      if (!client.isCurrent()) {
        target?.close()
        return
      }
      if (!result.ok) {
        target?.close()
        toast.error('Erro ao gerar ofício')
        return
      }
      if (!target || !target.isOpen()) return
      await target.deliver({
        blob: result.blob,
        name: 'Oficio-' + entryId + '.pdf',
        isCurrent: client.isCurrent,
        dialogTitle: 'Baixar Ofício',
      })
    } catch (error) {
      target?.close()
      if (isAbortError(error) || !client.isCurrent()) return
      toast.error('Erro ao gerar ofício')
    }
  }, [api, entryId, client, ports])
}
