import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { TenantPrincipal } from '../identity/index'
import { CustomerError } from './errors'
import type { TenantTransactionRunner } from './types'

export const REQUIRED_CLIENT_DOCUMENT_TYPES = [
  'ID_DOCUMENT',
  'SELFIE',
  'SIGNED_CONTRACT',
  'CPF_CNPJ_PROOF',
] as const

export type RequiredClientDocumentType =
  (typeof REQUIRED_CLIENT_DOCUMENT_TYPES)[number]

/** Armazenamento privado dos documentos, fornecido pela composição. */
export type ClientDocumentStorage = {
  /** Abre o bucket privado; deve falhar quando ele não estiver privado. */
  open(): Promise<{
    /** Chave pertence ao prefixo da locadora e do cliente. */
    isOwnedPath(_filePath: string, _tenantId: string, _userId: string): boolean
    /** URL assinada temporária para download, ou null. */
    signedUrl(_filePath: string, _fileName: string): Promise<string | null>
  }>
}

const documentSelect = {
  id: true,
  userId: true,
  rentalId: true,
  type: true,
  filePath: true,
  fileName: true,
  mimeType: true,
  fileSize: true,
  fileHash: true,
  captureMetadata: true,
  createdAt: true,
  uploadedByUser: { select: { id: true, name: true } },
} as const

export async function getMissingClientDocumentsInTransaction(
  context: TenantContext,
  options: { userId: string; rentalId?: string | null },
  db: Pick<Prisma.TransactionClient, 'clientDocument'>
): Promise<RequiredClientDocumentType[]> {
  const where = options.rentalId
    ? {
        userId: options.userId,
        OR: [{ rentalId: options.rentalId }, { rentalId: null }],
      }
    : {
        userId: options.userId,
      }

  const documents = await db.clientDocument.findMany({
    where: { ...where, tenantId: context.tenantId },
    select: {
      type: true,
    },
  })

  const existingTypes = new Set(documents.map((doc) => doc.type))
  return REQUIRED_CLIENT_DOCUMENT_TYPES.filter(
    (requiredType) => !existingTypes.has(requiredType)
  )
}

export function createClientDocumentService({
  withTenantTransaction,
  storage,
}: {
  withTenantTransaction: TenantTransactionRunner
  storage: ClientDocumentStorage
}) {
  /** Tipos obrigatórios ainda ausentes para o cliente (ou para a locação). */
  async function getMissingClientDocuments(
    context: TenantContext,
    options: {
      userId: string
      rentalId?: string | null
    },
    db?: Pick<Prisma.TransactionClient, 'clientDocument'>
  ): Promise<RequiredClientDocumentType[]> {
    if (!db)
      return withTenantTransaction(context, (tx) =>
        getMissingClientDocuments(context, options, tx)
      )
    return getMissingClientDocumentsInTransaction(context, options, db)
  }

  /**
   * Documentos privados de um cliente da locadora. ADMIN e OPERATOR veem
   * qualquer cliente; CLIENT apenas os próprios. Só chaves do prefixo da
   * locadora/cliente recebem URL assinada.
   */
  async function listClientDocuments(
    principal: TenantPrincipal,
    userId: string
  ) {
    if (
      !['ADMIN', 'OPERATOR'].includes(principal.role) &&
      !(principal.role === 'CLIENT' && principal.userId === userId)
    )
      throw new CustomerError('Acesso negado', 403)
    const documents = await withTenantTransaction(principal, async (tx) => {
      const client = await tx.clientProfile.findUnique({
        where: { tenantId_userId: { tenantId: principal.tenantId, userId } },
        select: { id: true },
      })
      if (!client) return null
      return tx.clientDocument.findMany({
        where: { tenantId: principal.tenantId, userId },
        orderBy: { createdAt: 'desc' },
        select: documentSelect,
      })
    })
    if (!documents) throw new CustomerError('Cliente não encontrado', 404)
    const bucket = await storage.open()
    return Promise.all(
      documents.map(async ({ filePath, ...document }) => {
        if (!bucket.isOwnedPath(filePath, principal.tenantId, userId))
          return { ...document, signedUrl: null }
        return {
          ...document,
          signedUrl: await bucket.signedUrl(filePath, document.fileName),
        }
      })
    )
  }

  return { getMissingClientDocuments, listClientDocuments }
}

export type ClientDocumentService = ReturnType<
  typeof createClientDocumentService
>
