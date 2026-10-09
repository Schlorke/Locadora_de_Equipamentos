import type { TenantPrincipal } from '../identity/index'
import type { TenantTransactionRunner } from '../rentals/index'
type DocumentResult =
  | {
      kind: 'error'
      status: 404 | 409
      body: { error: string; processing?: 'PENDING' }
    }
  | { kind: 'redirect'; url: URL }
export function createPaymentDocuments({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  function readBoletoDocument(
    principal: TenantPrincipal,
    id: string
  ): Promise<DocumentResult> {
    return withTenantTransaction(principal, async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id, tenantId: principal.tenantId, method: 'BOLETO' },
        include: { rental: true, quote: true },
      })
      const canManage =
        principal.role === 'ADMIN' ||
        (principal.role !== 'CLIENT' &&
          Boolean(
            await tx.permission.findFirst({
              where: {
                tenantId: principal.tenantId,
                role: principal.role,
                module: 'FINANCIAL',
                action: 'READ',
              },
            })
          ))
      if (
        !payment ||
        (!canManage &&
          (payment.rental?.userid ?? payment.quote?.userId) !==
            principal.userId)
      )
        return {
          kind: 'error',
          status: 404,
          body: { error: 'Pagamento não encontrado' },
        }
      const data =
        payment.metadata &&
        typeof payment.metadata === 'object' &&
        !Array.isArray(payment.metadata)
          ? payment.metadata
          : {}
      if (typeof data.pdfUrl !== 'string')
        return {
          kind: 'error',
          status: 409,
          body: {
            error: 'Documento do provedor ainda não disponível',
            processing: 'PENDING',
          },
        }
      let url: URL
      try {
        url = new URL(data.pdfUrl)
      } catch {
        return {
          kind: 'error',
          status: 409,
          body: { error: 'Documento inválido' },
        }
      }
      if (
        url.protocol !== 'https:' ||
        !(
          url.hostname === 'asaas.com' || url.hostname.endsWith('.asaas.com')
        ) ||
        url.username ||
        url.password
      )
        return {
          kind: 'error',
          status: 409,
          body: { error: 'Origem do documento inválida' },
        }
      return { kind: 'redirect', url }
    })
  }
  return { readBoletoDocument }
}
