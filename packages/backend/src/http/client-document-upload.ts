import { ClientDocumentTypeSchema as DocumentType } from '@gb-locacoes/contracts/client-documents'
import type { TenantPrincipal } from '../modules/identity/index'
import type { TenantTransactionRunner } from '../modules/customers/index'
import {
  createDocumentPath,
  parseCaptureMetadata,
  preparePrivateDocument,
  PRIVATE_DOCUMENT_URL_TTL,
  type createPrivateDocumentStorage,
} from '../modules/documents/private-documents'
export function createClientDocumentUpload({
  withTenantTransaction,
  getPrivateDocumentStorage,
}: {
  withTenantTransaction: TenantTransactionRunner
  getPrivateDocumentStorage: ReturnType<
    typeof createPrivateDocumentStorage
  >['getPrivateDocumentStorage']
}) {
  async function uploadRentalClientDocument(
    principal: TenantPrincipal,
    rentalId: string,
    request: Request
  ): Promise<Response> {
    if (Number(request.headers.get('content-length') ?? 0) > 11 * 1024 * 1024)
      return Response.json({ error: 'Arquivo muito grande' }, { status: 413 })
    const rental = await withTenantTransaction(principal, (tx) =>
      tx.rentals.findFirst({
        where: { id: rentalId, tenantId: principal.tenantId },
        select: { id: true, userid: true },
      })
    )
    if (!rental)
      return Response.json({ error: 'Locação não encontrada' }, { status: 404 })
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File))
      return Response.json({ error: 'Arquivo obrigatório' }, { status: 400 })
    const type = DocumentType.parse(form.get('type'))
    const captureMetadata = parseCaptureMetadata(form.get('captureMetadata'))
    const prepared = await preparePrivateDocument(file)
    const fileName = (file.name || `${type}.${prepared.extension}`)
      .replace(/[^a-zA-Z0-9.\-_]/g, '_')
      .slice(0, 120)
    const filePath = createDocumentPath(
      principal.tenantId,
      rental.userid,
      prepared.extension
    )
    const bucket = await getPrivateDocumentStorage()
    const uploaded = await bucket.upload(filePath, prepared.buffer, {
      contentType: prepared.mimeType,
      upsert: false,
      cacheControl: '0',
    })
    if (uploaded.error)
      return Response.json(
        { error: 'Erro ao armazenar documento' },
        { status: 502 }
      )
    let document
    try {
      document = await withTenantTransaction(principal, (tx) =>
        tx.clientDocument.create({
          data: {
            tenantId: principal.tenantId,
            userId: rental.userid,
            rentalId,
            type,
            filePath,
            fileName,
            mimeType: prepared.mimeType,
            fileSize: prepared.buffer.length,
            fileHash: prepared.hash,
            captureMetadata,
            uploadedBy: principal.userId,
          },
          select: {
            id: true,
            userId: true,
            rentalId: true,
            type: true,
            fileName: true,
            mimeType: true,
            fileSize: true,
            fileHash: true,
            createdAt: true,
          },
        })
      )
    } catch (error) {
      await bucket.remove([filePath])
      throw error
    }
    const signed = await bucket.createSignedUrl(
      filePath,
      PRIVATE_DOCUMENT_URL_TTL,
      { download: fileName }
    )
    return Response.json(
      { document: { ...document, signedUrl: signed.data?.signedUrl || null } },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  }
  return { uploadRentalClientDocument }
}
