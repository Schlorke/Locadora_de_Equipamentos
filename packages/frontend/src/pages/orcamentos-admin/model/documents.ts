import { useMemo, useState, useEffect } from 'react'
import { useScopedApiClient, isAbortError } from '../../../shared/api'
import { toast } from '../../../shared/lib/toast'
import { createAdminQuoteDocumentsApi } from '../api/admin-documents'
import { getBoletoPayment, type Quote } from '../../../entities/orcamento'
export interface QuoteDocumentPorts {
  openDocument: (url: string) => Promise<void>
  shareDocument: (document: {
    blob: Blob
    name: string
    isCurrent: () => boolean
    dialogTitle?: string
  }) => Promise<void>
}
export function useQuoteDocuments(
  quote: Quote | null,
  ports: QuoteDocumentPorts
) {
  const client = useScopedApiClient(quote?.id ?? null),
    api = useMemo(() => createAdminQuoteDocumentsApi(client), [client]),
    [downloading, setDownloading] = useState(false)
  useEffect(() => {
    setDownloading(false)
  }, [client])
  const downloadAdjustment = async () => {
    if (!quote || downloading || !client.isCurrent()) return
    setDownloading(true)
    try {
      const result = await api.adjustments(quote.id)
      if (!client.isCurrent()) return
      if (!result.ok) {
        toast.error('Erro ao gerar PDF', {
          description: 'Não foi possível gerar o documento de reajuste.',
        })
        return
      }
      await ports.shareDocument({
        blob: result.blob,
        name: 'Reajuste-' + (quote.quoteCode || quote.id) + '.pdf',
        isCurrent: client.isCurrent,
        dialogTitle: 'Baixar Reajuste',
      })
      if (client.isCurrent()) toast.success('PDF gerado com sucesso')
    } catch (error) {
      if (!isAbortError(error) && client.isCurrent())
        toast.error('Erro ao baixar PDF')
    } finally {
      if (client.isCurrent()) setDownloading(false)
    }
  }
  const openBoleto = async () => {
    const url = getBoletoPayment(quote)?.metadata?.pdfUrl
    if (!url || !client.isCurrent()) return
    try {
      await ports.openDocument(url)
    } catch (error) {
      if (!isAbortError(error) && client.isCurrent())
        toast.error('Erro ao abrir boleto')
    }
  }
  return { downloading, downloadAdjustment, openBoleto }
}
