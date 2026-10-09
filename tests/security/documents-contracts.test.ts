import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

const mocks = vi.hoisted(() => {
  const model = () => ({
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  })
  return {
    principal: {
      userId: 'client-A',
      tenantId: 'tenant-A',
      membershipId: 'membership-A',
      role: 'ADMIN',
    },
    anonymous: false,
    tx: {
      $executeRaw: vi.fn(),
      rentals: model(),
      contract: model(),
      contractSignatureAttempt: model(),
      clientProfile: model(),
      organization: model(),
      tenantIntegration: model(),
      clientDocument: model(),
      auditLog: model(),
      outboxEvent: model(),
      externalResourceTenant: model(),
    },
    bucket: {
      getBucket: vi.fn(),
      upload: vi.fn(),
      remove: vi.fn(),
      createSignedUrl: vi.fn(),
      getPublicUrl: vi.fn(),
      download: vi.fn(),
    },
    createProvider: vi.fn(),
    getProvider: vi.fn(),
    credential: vi.fn(),
    scope: vi.fn(),
  }
})
vi.mock('@/lib/tenant', () => ({
  resolveTenantPrincipal: async () =>
    mocks.anonymous
      ? { ok: false, response: Response.json({}, { status: 401 }) }
      : { ok: true, principal: mocks.principal },
  withTenantTransaction: async (
    context: unknown,
    operation: (_tx: unknown) => unknown
  ) => {
    mocks.scope(context)
    return operation(mocks.tx)
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    storage: { from: () => mocks.bucket, getBucket: mocks.bucket.getBucket },
  },
}))
vi.mock('@/lib/security/tenant-webhook', () => ({
  resolveIntegrationCredential: mocks.credential,
}))
vi.mock('@/lib/zapsign', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/zapsign')>()),
  createZapSignDocument: mocks.createProvider,
  getZapSignDocument: mocks.getProvider,
}))

import {
  runContractSignatureEffect,
  runContractSignedArchiveEffect,
} from '@/lib/contract-signature-effects'
import { ZapSignRequestError } from '../../packages/backend/src/modules/documents/zapsign'
import { generateContractHTML } from '../../packages/backend/src/modules/documents/contract-rendering'
import { isOwnedDocumentPath } from '@/lib/security/private-documents'
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => ({ prisma: {} }),
  ...(await (async () => {
    const F = await (() => ({
      supabaseAdmin: {
        storage: {
          from: () => mocks.bucket,
          getBucket: mocks.bucket.getBucket,
        },
      },
    }))()
    return {
      createSupabaseDocumentStorage: () => {
        let storage:
          { getPrivateDocumentStorage(): Promise<unknown> } | undefined
        return {
          async getPrivateDocumentStorage() {
            const { createPrivateDocumentStorage } =
              await import('@gb-locacoes/backend/documents')
            storage ??= createPrivateDocumentStorage({
              getClient: async () => F.supabaseAdmin as never,
            }) as never
            return storage!.getPrivateDocumentStorage()
          },
        }
      },
      createSupabaseImageStorage: () => ({
        async getImageStorage() {
          return F.supabaseAdmin.storage.from('gb-locacoes-images')
        },
      }),
    }
  })()),
}))
vi.mock('@gb-locacoes/backend/documents', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/documents')>()),
  ...(await (async () => {
    const F = await (async () => ({
      createZapSignDocument: mocks.createProvider,
      getZapSignDocument: mocks.getProvider,
    }))()
    return {
      createZapSignDocument: F.createZapSignDocument,
      getZapSignDocument: F.getZapSignDocument,
    }
  })()),
}))
vi.mock(
  '../../apps/services/api/src/host/private-identity',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/private-identity')
    >()),
    ...(await (() => ({
      resolveTenantPrincipal: async () =>
        mocks.anonymous
          ? { ok: false, response: Response.json({}, { status: 401 }) }
          : { ok: true, principal: mocks.principal },
      withTenantTransaction: async (
        context: unknown,
        operation: (_tx: unknown) => unknown
      ) => {
        mocks.scope(context)
        return operation(mocks.tx)
      },
    }))()),
  })
)
vi.mock(
  '../../apps/services/api/src/host/tenant-transaction',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/tenant-transaction')
    >()),
    ...(await (() => ({
      resolveTenantPrincipal: async () =>
        mocks.anonymous
          ? { ok: false, response: Response.json({}, { status: 401 }) }
          : { ok: true, principal: mocks.principal },
      withTenantTransaction: async (
        context: unknown,
        operation: (_tx: unknown) => unknown
      ) => {
        mocks.scope(context)
        return operation(mocks.tx)
      },
    }))()),
  })
)
vi.mock(
  '../../apps/services/api/src/host/webhook-authentication',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/webhook-authentication')
    >()),
    ...(await (() => ({
      resolveIntegrationCredential: mocks.credential,
    }))()),
  })
)
import * as legacyRoute0 from '@/app/api/upload/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/upload/route'
import * as legacyRoute1 from '@/app/api/admin/clients/[id]/documents/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/admin/clients/[id]/documents/route'
import * as legacyRoute2 from '@/app/api/admin/rentals/[id]/client-documents/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/admin/rentals/[id]/client-documents/route'
import * as legacyRoute3 from '@/app/api/contracts/generate/route'
import * as serviceRoute3 from '../../apps/services/api/src/app/api/contracts/generate/route'
import * as legacyRoute4 from '@/app/api/contracts/sign/route'
import * as serviceRoute4 from '../../apps/services/api/src/app/api/contracts/sign/route'
import * as legacyRoute5 from '@/app/api/contracts/[rentalId]/download/route'
import * as serviceRoute5 from '../../apps/services/api/src/app/api/contracts/[rentalId]/download/route'

const HOSTS = [
  [
    'legacy root',
    {
      uploadImage: legacyRoute0.POST,
      listDocuments: legacyRoute1.GET,
      uploadDocument: legacyRoute2.POST,
      generate: legacyRoute3.POST,
      sign: legacyRoute4.POST,
      download: legacyRoute5.GET,
    },
  ],
  [
    'service',
    {
      uploadImage: serviceRoute0.POST,
      listDocuments: serviceRoute1.GET,
      uploadDocument: serviceRoute2.POST,
      generate: serviceRoute3.POST,
      sign: serviceRoute4.POST,
      download: serviceRoute5.GET,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (
    _host,
    { uploadImage, listDocuments, uploadDocument, generate, sign, download }
  ) => {
    const route = { params: Promise.resolve({ id: 'rental-A' }) }
    const clientRoute = { params: Promise.resolve({ id: 'client-A' }) }
    const downloadRoute = { params: Promise.resolve({ rentalId: 'rental-A' }) }
    const json = (body: unknown) =>
      new NextRequest('https://test.invalid/api', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      })
    const request = () => new NextRequest('https://test.invalid/api')
    function form(
      file = new File(['%PDF-1.7\nbody\n%%EOF'], 'document.pdf', {
        type: 'application/pdf',
      }),
      metadata?: string
    ) {
      const body = new FormData()
      body.set('file', file)
      body.set('type', 'ID_DOCUMENT')
      if (metadata) body.set('captureMetadata', metadata)
      return new NextRequest('https://test.invalid/api', {
        method: 'POST',
        body,
      })
    }
    const contract = {
      id: 'contract-A',
      tenantId: 'tenant-A',
      rentalId: 'rental-A',
      status: 'DRAFT',
      content: '<p>Contrato</p>',
      signedAt: null,
      pdfUrl: null,
    }
    const rental = {
      id: 'rental-A',
      tenantId: 'tenant-A',
      userid: 'client-A',
      startdate: new Date(),
      enddate: new Date(),
      total: 10,
      rental_items: [],
    }
    const integration = {
      id: 'integration-A',
      tenantId: 'tenant-A',
      credentialsRef: 'env:LOCADORA_INTEGRATION_A',
      status: 'ACTIVE',
      organization: { status: 'ACTIVE' },
    }
    const attempt = {
      id: 'attempt-A',
      tenantId: 'tenant-A',
      eventId: 'event-A',
      contractId: 'contract-A',
      integrationId: 'integration-A',
      status: 'QUEUED',
      integration,
      contract: { ...contract, rental },
    }
    beforeEach(() => {
      vi.resetAllMocks()
      mocks.anonymous = false
      mocks.principal.role = 'ADMIN'
      mocks.tx.rentals.findFirst.mockResolvedValue(rental)
      mocks.tx.contract.findFirst.mockResolvedValue(contract)
      mocks.tx.contract.findFirstOrThrow.mockResolvedValue(contract)
      mocks.tx.contract.updateMany.mockResolvedValue({ count: 1 })
      mocks.tx.contract.create.mockImplementation(async ({ data }) => ({
        id: 'contract-A',
        ...data,
      }))
      mocks.tx.contractSignatureAttempt.findFirst.mockResolvedValue(null)
      mocks.tx.contractSignatureAttempt.updateMany.mockResolvedValue({
        count: 1,
      })
      mocks.tx.clientProfile.findUnique.mockResolvedValue({
        id: 'profile-A',
        name: 'Cliente',
        email: 'client@example.test',
        phone: null,
      })
      mocks.tx.organization.findUnique.mockResolvedValue({ name: 'Locadora A' })
      mocks.tx.tenantIntegration.findMany.mockResolvedValue([integration])
      mocks.tx.clientDocument.findMany.mockResolvedValue([])
      mocks.tx.clientDocument.create.mockImplementation(async ({ data }) => ({
        id: 'document-A',
        ...data,
      }))
      mocks.tx.auditLog.count.mockResolvedValue(0)
      mocks.tx.outboxEvent.upsert.mockResolvedValue({ id: 'event-A' })
      mocks.bucket.getBucket.mockResolvedValue({ data: { public: false } })
      mocks.bucket.upload.mockImplementation(async (path: string) => ({
        data: { path },
        error: null,
      }))
      mocks.bucket.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://storage.invalid/signed' },
      })
      mocks.bucket.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.invalid/image' },
      })
      mocks.credential.mockResolvedValue({
        signingSecret: 'test-secret',
        apiKey: 'test-key',
        environment: 'sandbox',
      })
    })

    describe('tenant image and private document HTTP ACL', () => {
      it.each(['CLIENT', 'FINANCIAL', 'OPERATOR'])(
        'denies %s image writes before storage',
        async (role) => {
          mocks.principal.role = role
          expect((await uploadImage(form())).status).toBe(403)
          expect(mocks.bucket.upload).not.toHaveBeenCalled()
        }
      )
      it('namespaces ADMIN image keys and quota by tenant', async () => {
        const bytes = await sharp({
          create: { width: 2, height: 2, channels: 3, background: '#fff' },
        })
          .png()
          .toBuffer()
        const body = new FormData()
        body.set(
          'file',
          new File([new Uint8Array(bytes)], 'x.png', { type: 'image/png' })
        )
        body.set('type', 'logo')
        expect(
          (
            await uploadImage(
              new NextRequest('https://test.invalid/api', {
                method: 'POST',
                body,
              })
            )
          ).status
        ).toBe(200)
        expect(mocks.bucket.upload.mock.calls[0][0]).toMatch(
          /^tenants\/tenant-A\/logos\/logo-/
        )
        expect(mocks.tx.auditLog.create.mock.calls[0][0].data.tenantId).toBe(
          'tenant-A'
        )
      })
      it.each(['CLIENT', 'FINANCIAL'])(
        'denies %s document uploads',
        async (role) => {
          mocks.principal.role = role
          expect((await uploadDocument(form(), route)).status).toBe(403)
          expect(mocks.bucket.upload).not.toHaveBeenCalled()
        }
      )
      it('returns 404 for a rental outside the selected tenant', async () => {
        mocks.tx.rentals.findFirst.mockImplementation(async ({ where }) =>
          where.tenantId === 'tenant-B' ? rental : null
        )
        expect((await uploadDocument(form(), route)).status).toBe(404)
        expect(mocks.bucket.upload).not.toHaveBeenCalled()
      })
      it('validates metadata before creating a storage object', async () => {
        expect(
          (await uploadDocument(form(undefined, '{invalid'), route)).status
        ).toBe(400)
        expect(mocks.bucket.upload).not.toHaveBeenCalled()
      })
      it('rejects document bytes masquerading as PDF', async () => {
        expect(
          (
            await uploadDocument(
              form(
                new File(['<script>'], 'a.pdf', { type: 'application/pdf' })
              ),
              route
            )
          ).status
        ).toBe(400)
        expect(mocks.bucket.upload).not.toHaveBeenCalled()
      })
      it('writes private document tenant metadata and five minute download URL', async () => {
        mocks.principal.role = 'OPERATOR'
        expect((await uploadDocument(form(), route)).status).toBe(200)
        const data = mocks.tx.clientDocument.create.mock.calls[0][0].data
        expect(data).toMatchObject({
          tenantId: 'tenant-A',
          userId: 'client-A',
          uploadedBy: 'client-A',
        })
        expect(data.filePath).toMatch(/^tenants\/tenant-A\/clients\/client-A\//)
        expect(mocks.bucket.createSignedUrl).toHaveBeenCalledWith(
          data.filePath,
          300,
          { download: 'document.pdf' }
        )
      })
      it('refuses a publicly readable bucket for private documents', async () => {
        mocks.bucket.getBucket.mockResolvedValue({ data: { public: true } })
        expect((await uploadDocument(form(), route)).status).toBe(500)
        expect(mocks.bucket.upload).not.toHaveBeenCalled()
      })
      it('removes its newly uploaded object if database persistence fails', async () => {
        mocks.tx.clientDocument.create.mockRejectedValue(new Error('db'))
        expect((await uploadDocument(form(), route)).status).toBe(500)
        expect(mocks.bucket.remove).toHaveBeenCalledWith([
          mocks.bucket.upload.mock.calls[0][0],
        ])
      })
      it('allows CLIENT to list only its documents and never signs a foreign prefix', async () => {
        mocks.principal.role = 'CLIENT'
        mocks.tx.clientDocument.findMany.mockResolvedValue([
          {
            id: 'doc',
            filePath: 'tenants/tenant-B/clients/client-A/file.pdf',
            fileName: 'a.pdf',
          },
        ])
        const response = await listDocuments(request(), clientRoute)
        expect(response.status).toBe(200)
        expect(mocks.bucket.createSignedUrl).not.toHaveBeenCalled()
        expect(
          (
            await listDocuments(request(), {
              params: Promise.resolve({ id: 'client-B' }),
            })
          ).status
        ).toBe(403)
      })
      it.each([
        'tenants/tenant-A/clients/client-A/../secret.pdf',
        'tenants/tenant-A/clients/client-A/%2e%2e.pdf',
        'legacy/file.pdf',
      ])('never signs unowned key %s', (path) => {
        expect(isOwnedDocumentPath(path, 'tenant-A', 'client-A')).toBe(false)
      })
    })

    describe('contract HTTP boundary', () => {
      it('returns authentication response without reading resources', async () => {
        mocks.anonymous = true
        expect((await generate(json({ rentalId: 'rental-A' }))).status).toBe(
          401
        )
        expect(mocks.tx.contract.findFirst).not.toHaveBeenCalled()
      })
      it.each(['CLIENT', 'FINANCIAL'])('denies %s generation', async (role) => {
        mocks.principal.role = role
        expect((await generate(json({ rentalId: 'rental-A' }))).status).toBe(
          403
        )
      })
      it('rejects cross-tenant generation', async () => {
        mocks.tx.rentals.findFirst.mockResolvedValue(null)
        expect((await generate(json({ rentalId: 'rental-B' }))).status).toBe(
          404
        )
      })
      it.each(['SIGNED', 'SENT', 'CANCELLED', 'EXPIRED'])(
        'never overwrites %s contracts',
        async (status) => {
          mocks.tx.contract.findFirst.mockResolvedValue({ ...contract, status })
          expect((await generate(json({ rentalId: 'rental-A' }))).status).toBe(
            409
          )
          expect(mocks.tx.contract.updateMany).not.toHaveBeenCalled()
        }
      )
      it('freezes content while signature request is queued', async () => {
        mocks.tx.contractSignatureAttempt.findFirst.mockResolvedValue(attempt)
        expect((await generate(json({ rentalId: 'rental-A' }))).status).toBe(
          409
        )
      })
      it('escapes tenant/client/equipment text in HTML', () => {
        const content = generateContractHTML(
          {
            ...rental,
            users: {
              name: '<script>bad</script>',
              email: 'a&b@example.test',
              phone: null,
            },
            rental_items: [
              {
                quantity: 1,
                totaldays: 1,
                totalprice: 1,
                equipments: { name: '<img onerror=x>' },
              },
            ],
          },
          '<script>company</script>'
        )
        expect(content).not.toContain('<script>')
        expect(content).not.toContain('<img')
        expect(content).toContain('&lt;script&gt;')
      })
      it('queues signature atomically and ignores caller chosen signer', async () => {
        mocks.principal.role = 'CLIENT'
        expect(
          (
            await sign(
              json({
                contractId: 'contract-A',
                signerEmail: 'attacker@example.test',
                signerName: 'Attacker',
              })
            )
          ).status
        ).toBe(202)
        expect(
          mocks.tx.contract.findFirst.mock.calls[0][0].where.rental
        ).toMatchObject({ userid: 'client-A', tenantId: 'tenant-A' })
        expect(
          mocks.tx.outboxEvent.upsert.mock.calls[0][0].create.payload
        ).toEqual({ contractId: 'contract-A' })
        expect(mocks.createProvider).not.toHaveBeenCalled()
      })
      it('does not sign a foreign client contract', async () => {
        mocks.principal.role = 'CLIENT'
        mocks.tx.contract.findFirst.mockResolvedValue(null)
        expect((await sign(json({ contractId: 'contract-B' }))).status).toBe(
          404
        )
        expect(mocks.tx.outboxEvent.upsert).not.toHaveBeenCalled()
      })
      it('missing download remains read-only', async () => {
        mocks.tx.contract.findFirst.mockResolvedValue(null)
        expect((await download(request(), downloadRoute)).status).toBe(404)
        expect(mocks.tx.contract.create).not.toHaveBeenCalled()
      })
      it('never redirects to an external pdfUrl stored by legacy code', async () => {
        mocks.tx.contract.findFirst.mockResolvedValue({
          ...contract,
          status: 'SIGNED',
          pdfUrl: 'https://attacker.invalid/file',
        })
        mocks.tx.clientDocument.findFirst.mockResolvedValue(null)
        expect((await download(request(), downloadRoute)).status).toBe(409)
      })
      it('serves unsigned HTML as sandboxed no-store attachment', async () => {
        const response = await download(request(), downloadRoute)
        expect(response.headers.get('content-security-policy')).toContain(
          'sandbox'
        )
        expect(response.headers.get('cache-control')).toBe('private, no-store')
      })
    })

    describe('signature effect safety', () => {
      it('persists provider binding and SENT only after real adapter success', async () => {
        mocks.tx.contractSignatureAttempt.findFirst.mockResolvedValue(attempt)
        mocks.createProvider.mockResolvedValue({
          token: 'provider-document',
          external_id: attempt.id,
          status: 'pending',
        })
        await runContractSignatureEffect({ tenantId: 'tenant-A' }, 'event-A', {
          contractId: 'contract-A',
        })
        expect(mocks.createProvider.mock.calls[0][1].signer).toEqual({
          name: 'Cliente',
          email: 'client@example.test',
        })
        expect(
          mocks.createProvider.mock.calls[0][1].pdf.toString('ascii', 0, 5)
        ).toBe('%PDF-')
        expect(
          mocks.tx.externalResourceTenant.create.mock.calls[0][0].data
        ).toMatchObject({
          tenantId: 'tenant-A',
          integrationId: 'integration-A',
          externalId: 'provider-document',
        })
        expect(mocks.tx.contract.updateMany.mock.calls[0][0].data.status).toBe(
          'SENT'
        )
      })
      it.each(['UNKNOWN', 'PROCESSING', 'FAILED'])(
        'does not repeat a POST after %s',
        async (status) => {
          mocks.tx.contractSignatureAttempt.findFirst.mockResolvedValue({
            ...attempt,
            status,
          })
          await expect(
            runContractSignatureEffect({ tenantId: 'tenant-A' }, 'event-A', {
              contractId: 'contract-A',
            })
          ).rejects.toThrow()
          expect(mocks.createProvider).not.toHaveBeenCalled()
        }
      )
      it('marks ambiguous provider outcome UNKNOWN without changing contract', async () => {
        mocks.tx.contractSignatureAttempt.findFirst.mockResolvedValue(attempt)
        mocks.createProvider.mockRejectedValue(
          new ZapSignRequestError('UNKNOWN')
        )
        await expect(
          runContractSignatureEffect({ tenantId: 'tenant-A' }, 'event-A', {
            contractId: 'contract-A',
          })
        ).rejects.toThrow('SIGNATURE_RECONCILIATION_REQUIRED')
        expect(
          mocks.tx.contractSignatureAttempt.updateMany.mock.calls.at(-1)[0].data
            .status
        ).toBe('UNKNOWN')
        expect(mocks.tx.contract.updateMany).not.toHaveBeenCalled()
      })
      it('does not download a signed PDF from an untrusted host', async () => {
        mocks.tx.contract.findFirst.mockResolvedValue({
          ...contract,
          status: 'SIGNED',
          zapSignId: 'provider-document',
          rental,
        })
        mocks.tx.externalResourceTenant.findFirst.mockResolvedValue({
          integration,
        })
        mocks.getProvider.mockResolvedValue({
          token: 'provider-document',
          status: 'signed',
          signed_file: 'https://127.0.0.1/private',
        })
        await expect(
          runContractSignedArchiveEffect({ tenantId: 'tenant-A' }, 'event-A', {
            contractId: 'contract-A',
          })
        ).rejects.toThrow('UNTRUSTED_SIGNED_FILE_HOST')
        expect(mocks.bucket.upload).not.toHaveBeenCalled()
      })
    })
  }
)
