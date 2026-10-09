import {
  isOwnedDocumentPath,
  PRIVATE_DOCUMENT_URL_TTL,
  type createPrivateDocumentStorage,
  type createRentalContracts,
} from '../modules/documents/index'
import type { TenantPrincipal } from '../modules/identity/index'
import type { TenantTransactionRunner } from '../modules/rentals/index'
export function createContractDownload({
  withTenantTransaction,
  readRentalContract,
  getPrivateDocumentStorage,
}: {
  withTenantTransaction: TenantTransactionRunner
  readRentalContract: ReturnType<
    typeof createRentalContracts
  >['readRentalContract']
  getPrivateDocumentStorage: ReturnType<
    typeof createPrivateDocumentStorage
  >['getPrivateDocumentStorage']
}) {
  async function downloadRentalContract(
    principal: TenantPrincipal,
    rentalId: string
  ): Promise<Response> {
    const contract = await readRentalContract(principal, rentalId)
    if (!contract)
      return Response.json(
        { error: 'Contrato não encontrado' },
        { status: 404 }
      )
    if (contract.status === 'SIGNED') {
      const document = await withTenantTransaction(principal, (tx) =>
        tx.clientDocument.findFirst({
          where: {
            tenantId: principal.tenantId,
            rentalId,
            type: 'SIGNED_CONTRACT',
            filePath: contract.pdfUrl?.startsWith('private:')
              ? contract.pdfUrl.slice(8)
              : '__unavailable__',
          },
          select: { filePath: true, userId: true, fileName: true },
        })
      )
      if (
        !document ||
        !isOwnedDocumentPath(
          document.filePath,
          principal.tenantId,
          document.userId
        )
      )
        return Response.json(
          { error: 'Arquivo assinado aguardando armazenamento privado' },
          { status: 409 }
        )
      const bucket = await getPrivateDocumentStorage()
      const signed = await bucket.createSignedUrl(
        document.filePath,
        PRIVATE_DOCUMENT_URL_TTL,
        { download: document.fileName }
      )
      if (!signed.data?.signedUrl)
        return Response.json({ error: 'Arquivo indisponível' }, { status: 502 })
      return new Response(null, {
        status: 303,
        headers: {
          Location: signed.data.signedUrl,
          'Cache-Control': 'private, no-store',
        },
      })
    }
    if (!contract.content)
      return Response.json({ error: 'Contrato indisponível' }, { status: 404 })
    const safeId = rentalId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 128)
    return new Response(contract.content, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="contrato-${safeId}.html"`,
        'Content-Security-Policy':
          "sandbox; default-src 'none'; style-src 'unsafe-inline'",
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    })
  }
  return { downloadRentalContract }
}
