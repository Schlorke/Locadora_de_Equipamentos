import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { createContractSignatureEffects } from './contract-signature-effects'
import { ZapSignRequestError } from './zapsign'

const pdf = Buffer.from('%PDF-1.7\nlocal archive fixture\n%%EOF')
const integration = {
  id: 'integration-1',
  credentialsRef: 'env:LOCAL_FIXTURE',
  status: 'ACTIVE',
  organization: { status: 'ACTIVE' },
}
const contract = {
  id: 'contract-1',
  rentalId: 'rental-1',
  status: 'SIGNED',
  content: '<p>Contrato &amp; evidência</p>',
  zapSignId: 'doc-1',
  pdfUrl: null,
  rental: { userid: 'client-1' },
}
const attempt = {
  id: 'attempt-1',
  eventId: 'event-1',
  contractId: contract.id,
  integrationId: integration.id,
  integration,
  status: 'QUEUED',
  contract: { ...contract, status: 'DRAFT' },
}
function fixture() {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    contract: {
      findFirst: vi.fn().mockResolvedValue(contract),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    contractSignatureAttempt: {
      findFirst: vi.fn().mockResolvedValue(attempt),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    clientProfile: {
      findUnique: vi.fn().mockResolvedValue({
        name: 'Cliente da locadora',
        email: 'tenant@example.test',
      }),
    },
    externalResourceTenant: {
      findFirst: vi.fn().mockResolvedValue({ integration }),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      upsert: vi.fn().mockResolvedValue({}),
    },
    clientDocument: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'archive-1' }),
    },
    outboxEvent: { upsert: vi.fn().mockResolvedValue({ id: 'archive-event' }) },
  }
  const bucket = {
    upload: vi.fn().mockResolvedValue({ error: null }),
    download: vi.fn().mockResolvedValue({ error: null, data: new Blob([pdf]) }),
  }
  const credential = vi.fn().mockResolvedValue({
    apiKey: 'local-provider-fixture-only',
    environment: 'sandbox',
  })
  const get = vi.fn().mockResolvedValue({
    token: 'doc-1',
    external_id: attempt.id,
    status: 'signed',
    signed_file: 'https://zapsign.s3.sa-east-1.amazonaws.com/doc-1.pdf',
  })
  const create = vi.fn().mockResolvedValue({
    token: 'doc-1',
    external_id: attempt.id,
    status: 'pending',
  })
  const scope = vi.fn()
  const storage = vi.fn().mockResolvedValue(bucket)
  const effects = createContractSignatureEffects({
    withTenantTransaction: async (context, operation, options) => {
      scope(context, options)
      return operation(tx as unknown as Prisma.TransactionClient)
    },
    resolveIntegrationCredential: credential,
    provider: { createDocument: create, getDocument: get },
    getPrivateDocumentStorage: storage,
  })
  return { tx, bucket, credential, get, create, scope, storage, ...effects }
}
const network = vi.fn<typeof fetch>()
const context = { tenantId: 'tenant-1' },
  payload = { contractId: contract.id }
beforeEach(() => {
  network.mockReset().mockResolvedValue(new Response(pdf))
  vi.stubGlobal('fetch', network)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('durable contract effects', () => {
  it('an accepted signature does not repeat subscription admission in enforcement mode', async () => {
    vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
    const f = fixture()
    await f.runContractSignatureEffect(context, attempt.eventId, payload)
    expect(f.create).toHaveBeenCalledTimes(1)
    expect(f.tx.contract.updateMany.mock.calls[0]![0].data.status).toBe('SENT')
  })
  it('issues one PDF for the tenant signer and records the binding after provider success', async () => {
    const f = fixture()
    await f.runContractSignatureEffect(context, attempt.eventId, payload)
    expect(f.create).toHaveBeenCalledTimes(1)
    expect(f.create.mock.calls[0]![1]).toMatchObject({
      reference: attempt.id,
      signer: { name: 'Cliente da locadora', email: 'tenant@example.test' },
    })
    expect(f.create.mock.calls[0]![1].pdf.subarray(0, 5).toString()).toBe(
      '%PDF-'
    )
    expect(f.tx.externalResourceTenant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: context.tenantId,
        integrationId: integration.id,
        resourceId: contract.id,
        externalId: 'doc-1',
      }),
    })
    expect(f.tx.contract.updateMany.mock.calls[0]![0].data.status).toBe('SENT')
    for (const call of f.scope.mock.calls)
      expect(call).toEqual([context, { timeout: 5000, maxWait: 3000 }])
  })
  it.each(['REJECTED', 'UNKNOWN'] as const)(
    'persists %s and never automatically retries an ambiguous POST',
    async (outcome) => {
      const f = fixture()
      f.create.mockRejectedValue(new ZapSignRequestError(outcome))
      await expect(
        f.runContractSignatureEffect(context, attempt.eventId, payload)
      ).rejects.toThrow(
        outcome === 'REJECTED'
          ? 'SIGNATURE_REJECTED'
          : 'SIGNATURE_RECONCILIATION_REQUIRED'
      )
      expect(
        f.tx.contractSignatureAttempt.updateMany.mock.calls.at(-1)![0].data
          .status
      ).toBe(outcome === 'REJECTED' ? 'FAILED' : 'UNKNOWN')
      expect(f.tx.contract.updateMany).not.toHaveBeenCalled()
      expect(f.create).toHaveBeenCalledTimes(1)
    }
  )
  it.each(['UNKNOWN', 'PROCESSING', 'FAILED'])(
    'does not POST again after attempt state %s',
    async (status) => {
      const f = fixture()
      f.tx.contractSignatureAttempt.findFirst.mockResolvedValue({
        ...attempt,
        status,
      })
      await expect(
        f.runContractSignatureEffect(context, attempt.eventId, payload)
      ).rejects.toThrow('SIGNATURE_RECONCILIATION_REQUIRED')
      expect(f.create).not.toHaveBeenCalled()
    }
  )
  it('leaves an already succeeded signature untouched', async () => {
    const f = fixture()
    f.tx.contractSignatureAttempt.findFirst.mockResolvedValue({
      ...attempt,
      status: 'SUCCEEDED',
    })
    await f.runContractSignatureEffect(context, attempt.eventId, payload)
    expect(f.create).not.toHaveBeenCalled()
    expect(f.tx.contract.updateMany).not.toHaveBeenCalled()
  })
  it('marks a mismatched provider reference UNKNOWN without binding another contract', async () => {
    const f = fixture()
    f.create.mockResolvedValue({
      token: 'doc-1',
      status: 'pending',
      external_id: 'other-attempt',
    })
    await expect(
      f.runContractSignatureEffect(context, attempt.eventId, payload)
    ).rejects.toThrow('SIGNATURE_RECONCILIATION_REQUIRED')
    expect(f.tx.externalResourceTenant.create).not.toHaveBeenCalled()
  })
  it.each([
    'http://zapsign.s3.amazonaws.com/file',
    'https://evil.example.test/file',
    'https://user@zapsign.s3.amazonaws.com/file',
    'https://zapsign.s3.amazonaws.com:444/file',
    'https://127.0.0.1/file',
  ])(
    'refuses an untrusted signed file %s before network/storage',
    async (signed_file) => {
      const f = fixture()
      f.get.mockResolvedValue({
        token: 'doc-1',
        status: 'signed',
        external_id: attempt.id,
        signed_file,
      })
      await expect(
        f.runContractSignedArchiveEffect(context, 'archive-event', payload)
      ).rejects.toThrow('UNTRUSTED_SIGNED_FILE_HOST')
      expect(network).not.toHaveBeenCalled()
      expect(f.storage).not.toHaveBeenCalled()
    }
  )
  it('archives only validated bytes under the tenant/client path and records their hash', async () => {
    const f = fixture()
    await f.runContractSignedArchiveEffect(context, 'archive-event', payload)
    const path = 'tenants/tenant-1/clients/client-1/contract-contract-1.pdf'
    expect(network.mock.calls[0]![1]).toMatchObject({
      redirect: 'error',
      signal: expect.any(AbortSignal),
    })
    expect(f.bucket.upload).toHaveBeenCalledWith(path, pdf, {
      contentType: 'application/pdf',
      upsert: false,
      cacheControl: '0',
    })
    expect(f.tx.clientDocument.create.mock.calls[0]![0].data).toMatchObject({
      tenantId: context.tenantId,
      userId: 'client-1',
      rentalId: contract.rentalId,
      filePath: path,
      fileSize: pdf.length,
      type: 'SIGNED_CONTRACT',
    })
    expect(f.tx.clientDocument.create.mock.calls[0]![0].data.fileHash).toMatch(
      /^[a-f0-9]{64}$/
    )
    expect(f.tx.contract.updateMany.mock.calls[0]![0].data).toEqual({
      pdfUrl: 'private:' + path,
    })
  })
  it('does not fetch an archive already bound to a private file', async () => {
    const f = fixture()
    f.tx.contract.findFirst.mockResolvedValue({
      ...contract,
      pdfUrl: 'private:existing.pdf',
    })
    await f.runContractSignedArchiveEffect(context, 'archive-event', payload)
    expect(f.get).not.toHaveBeenCalled()
    expect(network).not.toHaveBeenCalled()
    expect(f.storage).not.toHaveBeenCalled()
  })
  it('accepts an existing storage object only if bytes match, without overwriting it', async () => {
    const f = fixture()
    f.bucket.upload.mockResolvedValue({ error: 'already exists' })
    await f.runContractSignedArchiveEffect(context, 'archive-event', payload)
    expect(f.bucket.download).toHaveBeenCalledTimes(1)
    expect(f.tx.clientDocument.create).toHaveBeenCalledTimes(1)
    expect(f.bucket.upload.mock.calls[0]![2].upsert).toBe(false)
  })
  it('refuses an existing object with different bytes', async () => {
    const f = fixture()
    f.bucket.upload.mockResolvedValue({ error: 'already exists' })
    f.bucket.download.mockResolvedValue({
      error: null,
      data: new Blob(['different']),
    })
    await expect(
      f.runContractSignedArchiveEffect(context, 'archive-event', payload)
    ).rejects.toThrow('SIGNED_FILE_STORAGE_CONFLICT')
    expect(f.tx.clientDocument.create).not.toHaveBeenCalled()
    expect(f.tx.contract.updateMany).not.toHaveBeenCalled()
  })
  it('validates provider bytes before opening private storage', async () => {
    const f = fixture()
    network.mockResolvedValue(new Response('not a PDF'))
    await expect(
      f.runContractSignedArchiveEffect(context, 'archive-event', payload)
    ).rejects.toThrow('PDF inválido')
    expect(f.storage).not.toHaveBeenCalled()
  })
  it('enforces the streamed size even without Content-Length', async () => {
    const f = fixture()
    network.mockResolvedValue(
      new Response(new Uint8Array(10 * 1024 * 1024 + 1))
    )
    await expect(
      f.runContractSignedArchiveEffect(context, 'archive-event', payload)
    ).rejects.toThrow('SIGNED_FILE_TOO_LARGE')
    expect(f.storage).not.toHaveBeenCalled()
  })
  it('reconciles a matching signed outcome and queues its archive, without another POST', async () => {
    const f = fixture()
    f.tx.contractSignatureAttempt.findFirst.mockResolvedValue({
      ...attempt,
      status: 'UNKNOWN',
    })
    await f.reconcileContractSignature(context, contract.id, 'doc-1')
    expect(f.create).not.toHaveBeenCalled()
    expect(
      f.tx.contractSignatureAttempt.findFirst.mock.calls[0]![0].where
    ).toEqual({
      tenantId: context.tenantId,
      contractId: contract.id,
      status: 'UNKNOWN',
    })
    expect(f.tx.contract.updateMany.mock.calls[0]![0].data).toMatchObject({
      status: 'SIGNED',
      zapSignId: 'doc-1',
    })
    expect(f.tx.outboxEvent.upsert.mock.calls[0]![0].create).toMatchObject({
      tenantId: context.tenantId,
      topic: 'contract.signed.archive',
      aggregateId: contract.id,
    })
  })
  it('refuses reconciliation for another attempt reference before updating data', async () => {
    const f = fixture()
    f.get.mockResolvedValue({
      token: 'doc-1',
      external_id: 'other-attempt',
      status: 'signed',
      signed_file: '',
    })
    await expect(
      f.reconcileContractSignature(context, contract.id, 'doc-1')
    ).rejects.toThrow('PROVIDER_REFERENCE_MISMATCH')
    expect(f.tx.externalResourceTenant.upsert).not.toHaveBeenCalled()
    expect(f.tx.contract.updateMany).not.toHaveBeenCalled()
  })
})
