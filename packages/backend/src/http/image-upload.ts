import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantPrincipal } from '../modules/identity/index'
import type { TenantTransactionRunner } from '../modules/customers/types'
import { prepareUploadedImage } from '../modules/catalog/image-upload'
export function createImageUpload({
  withTenantTransaction,
  getImageStorage,
}: {
  withTenantTransaction: TenantTransactionRunner
  getImageStorage: () => Promise<ReturnType<SupabaseClient['storage']['from']>>
}) {
  async function uploadImage(
    principal: TenantPrincipal,
    request: Request
  ): Promise<Response> {
    if (Number(request.headers.get('content-length') ?? 0) > 6 * 1024 * 1024) {
      return Response.json({ error: 'Arquivo muito grande' }, { status: 413 })
    }
    const data = await request.formData()
    const file = data.get('file')
    const kind = data.get('type') ?? 'equipment'
    if (
      !(file instanceof File) ||
      !['equipment', 'logo'].includes(String(kind))
    ) {
      return Response.json(
        { error: 'Arquivo ou finalidade inválidos' },
        { status: 400 }
      )
    }
    const allowed = await withTenantTransaction(principal, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'image-upload:' + principal.tenantId + ':' + principal.userId}, 0))`
      const count = await tx.auditLog.count({
        where: {
          tenantId: principal.tenantId,
          userId: principal.userId,
          action: 'UPLOAD_REQUEST',
          entity: 'IMAGE',
          createdAt: { gte: new Date(Date.now() - 10 * 60_000) },
        },
      })
      if (count >= 30) return false
      await tx.auditLog.create({
        data: {
          tenantId: principal.tenantId,
          userId: principal.userId,
          action: 'UPLOAD_REQUEST',
          entity: 'IMAGE',
          entityId: randomUUID(),
        },
      })
      return true
    })
    if (!allowed)
      return Response.json(
        { error: 'Limite de uploads atingido. Tente novamente mais tarde.' },
        { status: 429 }
      )
    const image = await prepareUploadedImage(file)
    const prefix = kind === 'logo' ? 'logo' : 'equipment'
    const filename = prefix + '-' + randomUUID() + '.' + image.extension
    const filePath =
      `tenants/${principal.tenantId}/` +
      (kind === 'logo' ? 'logos/' : 'equipments/') +
      filename
    const bucket = await getImageStorage()
    const { data: uploaded, error } = await bucket.upload(
      filePath,
      image.buffer,
      {
        contentType: image.contentType,
        upsert: false,
        cacheControl: '31536000',
      }
    )
    if (error || !uploaded)
      return Response.json(
        { error: 'Erro ao armazenar imagem' },
        { status: 502 }
      )
    const {
      data: { publicUrl },
    } = bucket.getPublicUrl(uploaded.path)
    return Response.json({
      url: publicUrl,
      filename,
      size: image.buffer.length,
      originalSize: file.size,
      optimized: image.optimized,
      format: image.extension,
      success: true,
    })
  }
  return { uploadImage }
}
