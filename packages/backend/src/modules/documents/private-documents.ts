import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import sharp from 'sharp'
import type { Prisma } from '@prisma/client'

export const PRIVATE_DOCUMENT_BUCKET = 'gb-locacoes-client-documents'
export const PRIVATE_DOCUMENT_URL_TTL = 300
export class InvalidDocumentError extends Error {}

const segment = /^[A-Za-z0-9_-]{1,128}$/
export function isOwnedDocumentPath(
  path: string,
  tenantId: string,
  userId: string
): boolean {
  return (
    segment.test(tenantId) &&
    segment.test(userId) &&
    path.startsWith(`tenants/${tenantId}/clients/${userId}/`) &&
    !path
      .split('/')
      .some(
        (part) => !segment.test(part.replace(/\.(?:pdf|jpeg|png|webp)$/, ''))
      )
  )
}
export function createDocumentPath(
  tenantId: string,
  userId: string,
  extension: string
): string {
  if (
    !segment.test(tenantId) ||
    !segment.test(userId) ||
    !['pdf', 'jpeg', 'png', 'webp'].includes(extension)
  )
    throw new InvalidDocumentError('Identificador inválido')
  return `tenants/${tenantId}/clients/${userId}/${randomUUID()}.${extension}`
}
export function parseCaptureMetadata(
  value: string | File | null
): Prisma.InputJsonObject | undefined {
  if (value === null || value === '') return undefined
  if (typeof value !== 'string' || value.length > 16_384)
    throw new InvalidDocumentError('Metadados inválidos')
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new InvalidDocumentError('captureMetadata deve ser JSON válido')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new InvalidDocumentError('Metadados devem ser um objeto JSON')
  return parsed as Prisma.InputJsonObject
}
export async function preparePrivateDocument(file: File) {
  if (!file.size || file.size > 10 * 1024 * 1024)
    throw new InvalidDocumentError('Envie um documento de até 10MB')
  const buffer = Buffer.from(await file.arrayBuffer())
  const formats: Record<string, string> = {
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpeg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  }
  const extension = formats[file.type]
  if (!extension)
    throw new InvalidDocumentError('Tipo de documento não permitido')
  if (extension === 'pdf') {
    if (
      !/^%PDF-1\.[0-9]|^%PDF-2\.0/.test(
        buffer.subarray(0, 8).toString('ascii')
      ) ||
      !/%%EOF\s*$/.test(buffer.subarray(-1024).toString('ascii'))
    )
      throw new InvalidDocumentError('PDF inválido')
  } else {
    try {
      const image = sharp(buffer, { limitInputPixels: 25_000_000 })
      const metadata = await image.metadata()
      if (metadata.format !== extension || (metadata.pages ?? 1) !== 1)
        throw new Error('Format mismatch')
      await image.raw().toBuffer()
    } catch {
      throw new InvalidDocumentError('Imagem do documento inválida')
    }
  }
  return {
    buffer,
    extension,
    mimeType: extension === 'pdf' ? 'application/pdf' : `image/${extension}`,
    hash: createHash('sha256').update(buffer).digest('hex'),
  }
}

export function createPrivateDocumentStorage({
  getClient,
}: {
  getClient: () => Promise<Pick<SupabaseClient, 'storage'>>
}) {
  async function getPrivateDocumentStorage() {
    const supabaseAdmin = await getClient()
    const { data, error } = await supabaseAdmin.storage.getBucket(
      PRIVATE_DOCUMENT_BUCKET
    )
    if (error || !data || data.public !== false)
      throw new Error('PRIVATE_DOCUMENT_STORAGE_UNAVAILABLE')
    return supabaseAdmin.storage.from(PRIVATE_DOCUMENT_BUCKET)
  }

  return { getPrivateDocumentStorage }
}
