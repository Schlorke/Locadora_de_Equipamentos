import { integrationCredentialReference } from '../../runtime/index'
import PDFDocument from 'pdfkit'
import DOMPurify from 'isomorphic-dompurify'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { PermanentDeliveryError, enqueueOutbox } from '../outbox/index'
import {
  ZapSignRequestError,
  type ZapSignCredential,
  type createZapSignDocument as Create,
  type getZapSignDocument as Get,
} from './zapsign'
import {
  preparePrivateDocument,
  type createPrivateDocumentStorage,
} from './private-documents'
import type { createIntegrationCredentialResolver } from '../../runtime/integration-credentials'
type Context = { tenantId: string }
type Transaction = <T>(
  _context: Context,
  _operation: (_tx: Prisma.TransactionClient) => Promise<T>,
  _options?: { timeout?: number; maxWait?: number }
) => Promise<T>
export function createContractSignatureEffects({
  withTenantTransaction: runTenantTransaction,
  resolveIntegrationCredential,
  provider: {
    createDocument: createZapSignDocument,
    getDocument: getZapSignDocument,
  },
  getPrivateDocumentStorage,
}: {
  withTenantTransaction: Transaction
  resolveIntegrationCredential: ReturnType<
    typeof createIntegrationCredentialResolver
  >
  provider: { createDocument: typeof Create; getDocument: typeof Get }
  getPrivateDocumentStorage: ReturnType<
    typeof createPrivateDocumentStorage
  >['getPrivateDocumentStorage']
}) {
  const withTenantTransaction: Transaction = (context, operation, options) =>
    runTenantTransaction(context, operation, {
      timeout: 5000,
      maxWait: 3000,
      ...options,
    })
  const Payload = z.object({ contractId: z.string().min(1).max(128) })
  async function credentialFor(integration: {
    id: string
    tenantId: string
    provider: string
    credentialSource: string
    environment: string | null
    credentialsRef: string | null
    status: string
    organization: { status: string }
  }): Promise<ZapSignCredential> {
    const credential = await resolveIntegrationCredential(
      integrationCredentialReference(integration)
    )
    if (
      integration.status !== 'ACTIVE' ||
      integration.organization.status !== 'ACTIVE' ||
      !credential?.apiKey ||
      !['sandbox', 'production'].includes(credential.environment || '')
    )
      throw new Error('SIGNATURE_INTEGRATION_UNAVAILABLE')
    return {
      apiKey: credential.apiKey,
      environment: credential.environment as 'sandbox' | 'production',
    }
  }
  async function contractPdf(content: string): Promise<Buffer> {
    const safe = DOMPurify.sanitize(
      content.replace(/<\/(?:p|h[1-6]|div)>/gi, '$&\n'),
      { RETURN_DOM: true, FORBID_TAGS: ['style', 'script'] }
    )
    const text = (safe.textContent || '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]*/g, '\n')
      .trim()
    if (!text) throw new PermanentDeliveryError('CONTRACT_CONTENT_EMPTY')
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({ size: 'A4', margin: 48 })
      const chunks: Buffer[] = []
      document.on('data', (chunk: Buffer) => chunks.push(chunk))
      document.on('end', () => resolve(Buffer.concat(chunks)))
      document.on('error', reject)
      document.fontSize(11).text(text)
      document.end()
    })
  }
  async function runContractSignatureEffect(
    context: Context,
    eventId: string,
    payload: unknown
  ) {
    const input = Payload.safeParse(payload)
    if (!input.success)
      throw new PermanentDeliveryError('INVALID_SIGNATURE_PAYLOAD')
    const attempt = await withTenantTransaction(context, (tx) =>
      tx.contractSignatureAttempt.findFirst({
        where: {
          tenantId: context.tenantId,
          eventId,
          contractId: input.data.contractId,
        },
        include: {
          integration: {
            include: { organization: { select: { status: true } } },
          },
          contract: { include: { rental: true } },
        },
      })
    )
    if (!attempt) throw new PermanentDeliveryError('SIGNATURE_ATTEMPT_MISSING')
    if (attempt.status === 'SUCCEEDED') return
    if (attempt.status !== 'QUEUED') {
      if (attempt.status === 'PROCESSING')
        await withTenantTransaction(context, (tx) =>
          tx.contractSignatureAttempt.updateMany({
            where: {
              id: attempt.id,
              tenantId: context.tenantId,
              status: 'PROCESSING',
            },
            data: { status: 'UNKNOWN', lastError: 'INTERRUPTED_REQUEST' },
          })
        )
      throw new PermanentDeliveryError('SIGNATURE_RECONCILIATION_REQUIRED')
    }
    if (attempt.contract.status !== 'DRAFT' || !attempt.contract.content)
      throw new PermanentDeliveryError('CONTRACT_NOT_SIGNABLE')
    const credential = await credentialFor(attempt.integration)
    const client = await withTenantTransaction(context, (tx) =>
      tx.clientProfile.findUnique({
        where: {
          tenantId_userId: {
            tenantId: context.tenantId,
            userId: attempt.contract.rental.userid,
          },
        },
        select: { name: true, email: true },
      })
    )
    if (!client?.email)
      throw new PermanentDeliveryError('CONTRACT_SIGNER_MISSING')
    const pdf = await contractPdf(attempt.contract.content)
    const claimed = await withTenantTransaction(context, (tx) =>
      tx.contractSignatureAttempt.updateMany({
        where: { id: attempt.id, tenantId: context.tenantId, status: 'QUEUED' },
        data: { status: 'PROCESSING' },
      })
    )
    if (claimed.count !== 1)
      throw new PermanentDeliveryError('SIGNATURE_ALREADY_CLAIMED')
    try {
      const document = await createZapSignDocument(credential, {
        name: `Contrato de Locação - ${attempt.contract.rentalId}`,
        pdf,
        reference: attempt.id,
        signer: { name: client.name, email: client.email },
      })
      if (document.external_id !== attempt.id)
        throw new ZapSignRequestError('UNKNOWN')
      await withTenantTransaction(context, async (tx) => {
        await tx.externalResourceTenant.create({
          data: {
            tenantId: context.tenantId,
            integrationId: attempt.integrationId,
            provider: 'ZAPSIGN',
            resourceType: 'CONTRACT',
            resourceId: attempt.contractId,
            externalId: document.token,
          },
        })
        const updated = await tx.contract.updateMany({
          where: {
            id: attempt.contractId,
            tenantId: context.tenantId,
            status: 'DRAFT',
          },
          data: { status: 'SENT', zapSignId: document.token },
        })
        if (updated.count !== 1) throw new Error('CONTRACT_CHANGED')
        await tx.contractSignatureAttempt.updateMany({
          where: {
            id: attempt.id,
            tenantId: context.tenantId,
            status: 'PROCESSING',
          },
          data: { status: 'SUCCEEDED', externalId: document.token },
        })
      })
    } catch (error) {
      const rejected =
        error instanceof ZapSignRequestError && error.outcome === 'REJECTED'
      await withTenantTransaction(context, (tx) =>
        tx.contractSignatureAttempt.updateMany({
          where: {
            id: attempt.id,
            tenantId: context.tenantId,
            status: 'PROCESSING',
          },
          data: {
            status: rejected ? 'FAILED' : 'UNKNOWN',
            lastError: rejected
              ? 'PROVIDER_REJECTED'
              : 'PROVIDER_OUTCOME_UNKNOWN',
          },
        })
      )
      throw new PermanentDeliveryError(
        rejected ? 'SIGNATURE_REJECTED' : 'SIGNATURE_RECONCILIATION_REQUIRED'
      )
    }
  }

  async function fetchSignedPdf(url: string): Promise<Buffer> {
    const parsed = new URL(url)
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      !/^zapsign\.s3(?:\.[a-z0-9-]+)?\.amazonaws\.com$/.test(parsed.hostname)
    )
      throw new PermanentDeliveryError('UNTRUSTED_SIGNED_FILE_HOST')
    const response = await fetch(parsed, {
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
    })
    if (
      !response.ok ||
      !response.body ||
      Number(response.headers.get('content-length') ?? 0) > 10 * 1024 * 1024
    )
      throw new Error('SIGNED_FILE_UNAVAILABLE')
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let length = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        length += value.length
        if (length > 10 * 1024 * 1024)
          throw new PermanentDeliveryError('SIGNED_FILE_TOO_LARGE')
        chunks.push(value)
      }
    } finally {
      await reader.cancel()
    }
    return Buffer.concat(chunks)
  }
  async function runContractSignedArchiveEffect(
    context: Context,
    _eventId: string,
    payload: unknown
  ) {
    const input = Payload.safeParse(payload)
    if (!input.success)
      throw new PermanentDeliveryError('INVALID_CONTRACT_PAYLOAD')
    const contract = await withTenantTransaction(context, (tx) =>
      tx.contract.findFirst({
        where: {
          id: input.data.contractId,
          tenantId: context.tenantId,
          status: 'SIGNED',
        },
        include: { rental: true },
      })
    )
    if (!contract?.zapSignId)
      throw new PermanentDeliveryError('SIGNED_CONTRACT_MISSING')
    if (contract.pdfUrl?.startsWith('private:')) return
    const registry = await withTenantTransaction(context, (tx) =>
      tx.externalResourceTenant.findFirst({
        where: {
          tenantId: context.tenantId,
          provider: 'ZAPSIGN',
          resourceType: 'CONTRACT',
          resourceId: contract.id,
          externalId: contract.zapSignId!,
        },
        include: {
          integration: {
            include: { organization: { select: { status: true } } },
          },
        },
      })
    )
    if (!registry) throw new PermanentDeliveryError('CONTRACT_REGISTRY_MISSING')
    const detail = await getZapSignDocument(
      await credentialFor(registry.integration),
      contract.zapSignId
    )
    if (
      detail.token !== contract.zapSignId ||
      detail.status.toLowerCase() !== 'signed' ||
      !detail.signed_file
    )
      throw new Error('SIGNED_FILE_PENDING')
    const bytes = await fetchSignedPdf(detail.signed_file)
    const prepared = await preparePrivateDocument(
      new File([new Uint8Array(bytes)], 'contrato.pdf', {
        type: 'application/pdf',
      })
    )
    const path = `tenants/${context.tenantId}/clients/${contract.rental.userid}/contract-${contract.id}.pdf`
    const bucket = await getPrivateDocumentStorage()
    const upload = await bucket.upload(path, prepared.buffer, {
      contentType: 'application/pdf',
      upsert: false,
      cacheControl: '0',
    })
    if (upload.error) {
      const stored = await bucket.download(path)
      if (
        stored.error ||
        !stored.data ||
        !Buffer.from(await stored.data.arrayBuffer()).equals(prepared.buffer)
      )
        throw new PermanentDeliveryError('SIGNED_FILE_STORAGE_CONFLICT')
    }
    await withTenantTransaction(context, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'contract:' + context.tenantId + ':' + contract.rentalId}, 0))`
      const existing = await tx.clientDocument.findFirst({
        where: { tenantId: context.tenantId, filePath: path },
      })
      if (!existing)
        await tx.clientDocument.create({
          data: {
            tenantId: context.tenantId,
            userId: contract.rental.userid,
            rentalId: contract.rentalId,
            type: 'SIGNED_CONTRACT',
            filePath: path,
            fileName: `contrato-${contract.rentalId}.pdf`,
            mimeType: 'application/pdf',
            fileSize: prepared.buffer.length,
            fileHash: prepared.hash,
            uploadedBy: contract.rental.userid,
          },
        })
      await tx.contract.updateMany({
        where: {
          id: contract.id,
          tenantId: context.tenantId,
          status: 'SIGNED',
          OR: [
            { pdfUrl: null },
            { pdfUrl: { not: { startsWith: 'private:' } } },
          ],
        },
        data: { pdfUrl: 'private:' + path },
      })
    })
  }

  async function reconcileContractSignature(
    context: Context,
    contractId: string,
    externalId: string
  ) {
    const attempt = await withTenantTransaction(context, (tx) =>
      tx.contractSignatureAttempt.findFirst({
        where: { tenantId: context.tenantId, contractId, status: 'UNKNOWN' },
        include: {
          integration: {
            include: { organization: { select: { status: true } } },
          },
        },
      })
    )
    if (!attempt) throw new Error('UNKNOWN_ATTEMPT_NOT_FOUND')
    const document = await getZapSignDocument(
      await credentialFor(attempt.integration),
      externalId
    )
    if (document.token !== externalId || document.external_id !== attempt.id)
      throw new Error('PROVIDER_REFERENCE_MISMATCH')
    await withTenantTransaction(context, async (tx) => {
      const existing = await tx.externalResourceTenant.findUnique({
        where: {
          integrationId_resourceType_externalId: {
            integrationId: attempt.integrationId,
            resourceType: 'CONTRACT',
            externalId,
          },
        },
      })
      if (
        existing &&
        (existing.tenantId !== context.tenantId ||
          existing.resourceId !== contractId ||
          existing.provider !== 'ZAPSIGN')
      )
        throw new Error('PROVIDER_REGISTRY_CONFLICT')
      await tx.externalResourceTenant.upsert({
        where: {
          integrationId_resourceType_externalId: {
            integrationId: attempt.integrationId,
            resourceType: 'CONTRACT',
            externalId,
          },
        },
        create: {
          tenantId: context.tenantId,
          integrationId: attempt.integrationId,
          provider: 'ZAPSIGN',
          resourceType: 'CONTRACT',
          resourceId: contractId,
          externalId,
        },
        update: {},
      })
      const signed = document.status.toLowerCase() === 'signed'
      const updated = await tx.contract.updateMany({
        where: { id: contractId, tenantId: context.tenantId, status: 'DRAFT' },
        data: {
          status: signed ? 'SIGNED' : 'SENT',
          zapSignId: externalId,
          ...(signed ? { signedAt: new Date() } : {}),
        },
      })
      if (updated.count !== 1) throw new Error('CONTRACT_CHANGED')
      await tx.contractSignatureAttempt.updateMany({
        where: {
          id: attempt.id,
          tenantId: context.tenantId,
          status: 'UNKNOWN',
        },
        data: { status: 'SUCCEEDED', externalId, lastError: null },
      })
      if (signed)
        await enqueueOutbox(tx, {
          tenantId: context.tenantId,
          topic: 'contract.signed.archive',
          aggregateId: contractId,
          payload: { contractId },
          dedupeKey: `contract-archive:${contractId}`,
        })
    })
  }

  return {
    runContractSignatureEffect,
    runContractSignedArchiveEffect,
    reconcileContractSignature,
  }
}
