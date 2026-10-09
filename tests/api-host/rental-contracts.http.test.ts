import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
} from 'vitest'
import { createHmac, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient, type ContractStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { createHttpClient } from '../../packages/frontend/src/shared/api/http-client'
import { createClientRentalApi } from '../../packages/frontend/src/entities/locacao/api/client-rentals'
import { alterSharedAcl } from '../helpers/shared-acl'
import { parityTargets, rotatingTarget } from './targets'

const context = inject('apiParity'),
  hosts = parityTargets(context)
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const rentals = [randomUUID(), randomUUID(), randomUUID()]
const contracts = [randomUUID(), randomUUID(), randomUUID()]
const integrations = [randomUUID(), randomUUID()]
const profileId = randomUUID()
const member = randomUUID(),
  secret = 'local-webhook-parity-secret'
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[54]!,
}
let admin: string, client: string
async function clean() {
  const receipts = await prisma.webhookInbox.findMany({
    where: { integrationId: { in: integrations } },
    select: { id: true },
  })
  await prisma.outboxEvent.deleteMany({
    where: {
      aggregateId: { in: [...contracts, ...receipts.map((r) => r.id)] },
    },
  })
  await prisma.webhookInbox.deleteMany({
    where: { integrationId: { in: integrations } },
  })
  await prisma.externalResourceTenant.deleteMany({
    where: { integrationId: { in: integrations } },
  })
  await prisma.contractSignatureAttempt.deleteMany({
    where: { contractId: { in: contracts } },
  })
  await prisma.clientDocument.deleteMany({
    where: { rentalId: { in: rentals } },
  })
  // A signed agreement cannot be deleted in normal operation. Fixture teardown
  // alone uses the disposable database owner and a connection-local setting;
  // the live API role and its triggers/RLS are never disabled or changed.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica')
    await tx.contract.deleteMany({ where: { id: { in: contracts } } })
  })
  await prisma.rental_items.deleteMany({ where: { rentalid: { in: rentals } } })
  await prisma.rentals.deleteMany({ where: { id: { in: rentals } } })
}
beforeAll(async () => {
  admin = await signInParityUser(context, edge, 1)
  client = await signInParityUser(context, edge, 0)
  await prisma.clientProfile.create({
    data: {
      id: profileId,
      tenantId: context.alfa.id,
      userId: context.identity.users[0]!.id,
      email: 'tenant-contract-profile@example.test',
      name: 'Tenant-specific contract profile',
    },
  })
  await prisma.membership.create({
    data: {
      id: member,
      tenantId: context.alfa.id,
      userId: context.identity.users[1]!.id,
      role: 'ADMIN',
    },
  })
  for (let n = 0; n < 2; n++)
    await prisma.tenantIntegration.create({
      data: {
        id: integrations[n]!,
        tenantId: n ? context.bravo.id : context.alfa.id,
        provider: 'ZAPSIGN',
        credentialsRef: 'env:LOCADORA_INTEGRATION_WEBHOOK_PARITY',
      },
    })
})
beforeEach(async () => {
  await clean()
  await prisma.membership.update({
    where: { id: member },
    data: { role: 'ADMIN', status: 'ACTIVE' },
  })
  await prisma.tenantIntegration.updateMany({
    where: { id: { in: integrations } },
    data: {
      status: 'ACTIVE',
      credentialsRef: 'env:LOCADORA_INTEGRATION_WEBHOOK_PARITY',
    },
  })
  for (let n = 0; n < 3; n++) {
    const tenant = n === 2 ? context.bravo : context.alfa
    await prisma.rentals.create({
      data: {
        id: rentals[n]!,
        tenantId: tenant.id,
        userid: context.identity.users[n === 1 ? 1 : 0]!.id,
        startdate: new Date('2030-01-02'),
        enddate: new Date('2030-01-04'),
        total: '100.50',
        rental_items: {
          create: {
            id: randomUUID(),
            tenantId: tenant.id,
            equipmentid: tenant.equipmentIds[0]!,
            quantity: 2,
            totaldays: 2,
            priceperday: '25.125',
            totalprice: '100.50',
          },
        },
      },
    })
    await prisma.contract.create({
      data: {
        id: contracts[n]!,
        tenantId: tenant.id,
        rentalId: rentals[n]!,
        content: '<h1>Immutable fixture ' + n + '</h1>',
        template: 'default',
        zapSignId: 'document-' + contracts[n],
      },
    })
    await prisma.externalResourceTenant.create({
      data: {
        tenantId: tenant.id,
        integrationId: integrations[n === 2 ? 1 : 0]!,
        provider: 'ZAPSIGN',
        resourceType: 'CONTRACT',
        resourceId: contracts[n]!,
        externalId: 'document-' + contracts[n],
      },
    })
  }
})
afterAll(async () => {
  try {
    await clean()
    await prisma.clientProfile.deleteMany({ where: { id: profileId } })
    await prisma.membership.deleteMany({ where: { id: member } })
    await prisma.tenantIntegration.deleteMany({
      where: { id: { in: integrations } },
    })
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
})
async function request(
  host: string,
  path: string,
  options: {
    method?: string
    data?: unknown
    raw?: string
    cookie?: string
    tenant?: string
    origin?: string
  } = {}
) {
  const method = options.method ?? 'GET'
  const r = await fetch(host + path, {
    method,
    redirect: 'manual',
    headers: {
      ...edge,
      Cookie: options.cookie ?? admin,
      'x-tenant-id': options.tenant ?? context.alfa.id,
      ...(method === 'POST'
        ? {
            Origin: options.origin ?? edge['x-platform-origin'],
            'Content-Type': 'application/json',
          }
        : {}),
    },
    ...(method === 'POST'
      ? { body: options.raw ?? JSON.stringify(options.data ?? {}) }
      : {}),
  })
  const text = await r.text()
  return {
    status: r.status,
    headers: r.headers,
    text,
    body: r.headers.get('content-type')?.includes('application/json')
      ? JSON.parse(text)
      : null,
  }
}
async function webhook(
  host: string,
  data: unknown,
  options: {
    raw?: string
    signature?: string
    integration?: string
    global?: boolean
  } = {}
) {
  const raw = options.raw ?? JSON.stringify(data)
  const r = await fetch(
    host +
      '/api/contracts/zapsign-webhook' +
      (options.global ? '' : '/' + (options.integration ?? integrations[0])),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-zapsign-signature':
          options.signature ??
          createHmac('sha256', secret).update(raw).digest('hex'),
      },
      body: raw,
    }
  )
  return { status: r.status, body: await r.json() }
}
const event = (status = 'SIGNED', id = randomUUID()) => ({
  id,
  doc_token: 'document-' + contracts[0],
  status,
  signed_at: '2030-01-03T00:00:00Z',
  signers: [{ name: 'Fixture signer' }],
  tenantId: context.bravo.id,
})

for (const host of hosts)
  describe('contract parity ' + host, () => {
    it('configured contract consumer receives exact private bytes and denies other owners/tenants', async () => {
      const api = createClientRentalApi(
        createHttpClient({
          baseUrl: host,
          getHeaders: () => ({
            ...edge,
            Cookie: client,
            'x-tenant-id': context.alfa.id,
          }),
        })
      )
      const before = await prisma.contract.findUniqueOrThrow({
        where: { id: contracts[0]! },
      })
      const download = await api.downloadContract(rentals[0]!)
      expect(download).toMatchObject({
        ok: true,
        status: 200,
        redirected: false,
      })
      expect(await download.blob.text()).toBe(before.content)
      for (const id of [rentals[1]!, rentals[2]!, 'unknown-rental']) {
        const denied = await api.downloadContract(id)
        expect(denied).toMatchObject({ ok: false, status: 404 })
        expect(await denied.blob.text()).not.toBe(before.content)
      }
      expect(
        await prisma.contract.findUniqueOrThrow({
          where: { id: contracts[0]! },
        })
      ).toEqual(before)
    })
    it('configured contract consumer follows the private signed PDF and consumes its bytes', async () => {
      const userId = context.identity.users[0]!.id
      const filePath =
        'tenants/' + context.alfa.id + '/clients/' + userId + '/contract.pdf'
      await prisma.contract.update({
        where: { id: contracts[0]! },
        data: { status: 'SIGNED', pdfUrl: 'private:' + filePath },
      })
      await prisma.clientDocument.create({
        data: {
          tenantId: context.alfa.id,
          rentalId: rentals[0]!,
          userId,
          uploadedBy: userId,
          filePath,
          fileName: 'contract.pdf',
          mimeType: 'application/pdf',
          fileSize: 100,
          type: 'SIGNED_CONTRACT',
        },
      })
      const api = createClientRentalApi(
        createHttpClient({
          baseUrl: host,
          getHeaders: () => ({
            ...edge,
            Cookie: client,
            'x-tenant-id': context.alfa.id,
          }),
        })
      )
      const result = await api.downloadContract(rentals[0]!)
      expect(result).toMatchObject({ ok: true, status: 200, redirected: true })
      expect(result.url).toContain(
        context.storageOrigin + '/storage/v1/object/sign/'
      )
      expect(result.blob.type).toBe('application/pdf')
      expect(await result.blob.text()).toBe('%PDF-1.4\n%private fixture\n%%EOF')
    })
    it('denies anonymous access for every authenticated method', async () => {
      for (const [path, method] of [
        ['/api/contracts/generate', 'POST'],
        ['/api/contracts/sign', 'POST'],
        [`/api/contracts/${rentals[0]}/download`, 'GET'],
        [`/api/admin/rentals/${rentals[0]}/contract`, 'GET'],
        [`/api/admin/rentals/${rentals[0]}/contract`, 'POST'],
      ])
        expect(
          (await request(host, path!, { method, cookie: '' })).status
        ).toBe(401)
    })
    it.each(['CLIENT', 'FINANCIAL'])(
      'denies %s generation and admin reads',
      async (role) => {
        await prisma.membership.update({
          where: { id: member },
          data: { role: role as 'CLIENT' | 'FINANCIAL' },
        })
        expect(
          (
            await request(host, '/api/contracts/generate', {
              method: 'POST',
              data: { rentalId: rentals[0] },
            })
          ).status
        ).toBe(403)
        for (const method of ['GET', 'POST'])
          expect(
            (
              await request(host, `/api/admin/rentals/${rentals[0]}/contract`, {
                method,
              })
            ).status
          ).toBe(403)
      }
    )
    it('allows OPERATOR without inventing an extra permission requirement', async () => {
      await prisma.membership.update({
        where: { id: member },
        data: { role: 'OPERATOR' },
      })
      expect(
        (
          await request(host, `/api/admin/rentals/${rentals[0]}/contract`, {
            method: 'POST',
          })
        ).status
      ).toBe(200)
    })
    it.each(['generate', 'sign'])(
      'preserves invalid JSON and schema errors for %s',
      async (route) => {
        for (const raw of [
          '{',
          '{}',
          JSON.stringify({ rentalId: '', contractId: '' }),
          JSON.stringify({
            rentalId: 'x'.repeat(129),
            contractId: 'x'.repeat(129),
          }),
        ]) {
          const r = await request(host, '/api/contracts/' + route, {
            method: 'POST',
            raw,
          })
          expect(r.status).toBe(400)
          expect(r.body).toEqual({ error: 'Dados inválidos' })
        }
      }
    )
    it('isolates tenant and owner on read, generation and signature', async () => {
      expect(
        (
          await request(host, '/api/contracts/generate', {
            method: 'POST',
            data: { rentalId: rentals[2] },
          })
        ).status
      ).toBe(404)
      expect(
        (await request(host, `/api/contracts/${rentals[2]}/download`)).status
      ).toBe(404)
      expect(
        (
          await request(host, '/api/contracts/sign', {
            method: 'POST',
            data: { contractId: contracts[2] },
          })
        ).status
      ).toBe(404)
      expect(
        (
          await request(host, `/api/contracts/${rentals[1]}/download`, {
            cookie: client,
          })
        ).status
      ).toBe(404)
      expect(
        (
          await request(host, '/api/contracts/sign', {
            method: 'POST',
            cookie: client,
            data: { contractId: contracts[1] },
          })
        ).status
      ).toBe(404)
      expect(
        (
          await request(host, `/api/contracts/${rentals[0]}/download`, {
            cookie: client,
          })
        ).status
      ).toBe(200)
    })
    it('rejects cross-origin mutation before changing content or outbox', async () => {
      for (const path of [
        '/api/contracts/generate',
        '/api/contracts/sign',
        `/api/admin/rentals/${rentals[0]}/contract`,
      ]) {
        expect(
          (
            await request(host, path, {
              method: 'POST',
              origin: 'https://bravo.platform.test',
              data: { rentalId: rentals[0], contractId: contracts[0] },
            })
          ).status
        ).toBe(403)
      }
      expect(
        await prisma.contractSignatureAttempt.count({
          where: { contractId: contracts[0] },
        })
      ).toBe(0)
    })
    it('renders the tenant profile and organization and serves byte-identical sandboxed HTML', async () => {
      const a = await request(host, '/api/contracts/generate', {
        method: 'POST',
        data: { rentalId: rentals[0], template: 'default', ignored: true },
      })
      expect(a.status).toBe(200)
      expect(a.body.contract.status).toBe('DRAFT')
      expect(a.body.contract.template).toBe('default')
      const profile = await prisma.clientProfile.findUniqueOrThrow({
        where: {
          tenantId_userId: {
            tenantId: context.alfa.id,
            userId: context.identity.users[0]!.id,
          },
        },
      })
      expect(a.body.contract.content).toContain(profile.email)
      const b = await request(host, `/api/contracts/${rentals[0]}/download`, {
        cookie: client,
      })
      expect(b.status).toBe(200)
      expect(b.text).toBe(a.body.contract.content)
      expect(b.headers.get('content-disposition')).toBe(
        `attachment; filename="contrato-${rentals[0]}.html"`
      )
      expect(b.headers.get('content-security-policy')).toBe(
        "sandbox; default-src 'none'; style-src 'unsafe-inline'"
      )
      expect(b.headers.get('x-content-type-options')).toBe('nosniff')
      expect(b.headers.get('cache-control')).toBe('private, no-store')
      const adminRead = await request(
        host,
        `/api/admin/rentals/${rentals[0]}/contract`
      )
      expect(adminRead.status).toBe(200)
      expect(adminRead.body.contract.content).toBe(b.text)
      expect(adminRead.headers.get('cache-control')).toBe('private, no-store')
    })
    it.each(['SENT', 'SIGNED', 'CANCELLED', 'EXPIRED'])(
      'does not overwrite %s agreements',
      async (status) => {
        await prisma.contract.update({
          where: { id: contracts[0] },
          data: { status: status as ContractStatus },
        })
        for (const path of [
          '/api/contracts/generate',
          `/api/admin/rentals/${rentals[0]}/contract`,
        ])
          expect(
            (
              await request(host, path, {
                method: 'POST',
                data: { rentalId: rentals[0] },
              })
            ).status
          ).toBe(409)
        expect(
          (
            await prisma.contract.findUniqueOrThrow({
              where: { id: contracts[0] },
            })
          ).content
        ).toBe('<h1>Immutable fixture 0</h1>')
      }
    )
    it('queues one signature request, ignores caller signer and freezes content', async () => {
      const a = await request(host, '/api/contracts/sign', {
        method: 'POST',
        cookie: client,
        data: {
          contractId: contracts[0],
          signerEmail: 'untrusted@example.test',
        },
      })
      const b = await request(host, '/api/contracts/sign', {
        method: 'POST',
        cookie: client,
        data: { contractId: contracts[0] },
      })
      expect(a.status).toBe(202)
      expect(b.status).toBe(202)
      expect(b.body).toEqual(a.body)
      expect(
        await prisma.contractSignatureAttempt.count({
          where: { contractId: contracts[0] },
        })
      ).toBe(1)
      const events = await prisma.outboxEvent.findMany({
        where: {
          aggregateId: contracts[0],
          topic: 'contract.signature.request',
        },
      })
      expect(events).toHaveLength(1)
      expect(events[0]!.payload).toEqual({ contractId: contracts[0] })
      expect(
        (
          await request(host, '/api/contracts/generate', {
            method: 'POST',
            data: { rentalId: rentals[0] },
          })
        ).status
      ).toBe(409)
      expect(
        (
          await prisma.contract.findUniqueOrThrow({
            where: { id: contracts[0] },
          })
        ).status
      ).toBe('DRAFT')
    })
    it.each(['missing', 'inactive', 'ambiguous'])(
      'preserves unavailable signature integration: %s',
      async (mode) => {
        if (mode === 'missing')
          await prisma.tenantIntegration.update({
            where: { id: integrations[0] },
            data: { credentialsRef: 'env:LOCADORA_INTEGRATION_MISSING' },
          })
        if (mode === 'inactive')
          await prisma.tenantIntegration.update({
            where: { id: integrations[0] },
            data: { status: 'DISABLED' },
          })
        const extra = randomUUID()
        if (mode === 'ambiguous')
          await prisma.tenantIntegration.create({
            data: {
              id: extra,
              tenantId: context.alfa.id,
              provider: 'ZAPSIGN',
              credentialsRef: 'env:LOCADORA_INTEGRATION_WEBHOOK_PARITY',
            },
          })
        try {
          expect(
            (
              await request(host, '/api/contracts/sign', {
                method: 'POST',
                data: { contractId: contracts[0] },
              })
            ).status
          ).toBe(503)
        } finally {
          if (mode === 'ambiguous')
            await prisma.tenantIntegration.delete({ where: { id: extra } })
        }
        expect(
          await prisma.contractSignatureAttempt.count({
            where: { contractId: contracts[0] },
          })
        ).toBe(0)
      }
    )
    it('rolls back the outbox if the signature attempt cannot be persisted', async () => {
      const role = new URL(context.runtimeUrl).searchParams
        .get('options')
        ?.match(/role=(api_parity_[a-f0-9]+)/)?.[1]
      if (!role) throw new Error('No owned API role')
      await alterSharedAcl(
        pool,
        'REVOKE INSERT ON contract_signature_attempts FROM ' + role
      )
      try {
        expect(
          (
            await request(host, '/api/contracts/sign', {
              method: 'POST',
              data: { contractId: contracts[0] },
            })
          ).status
        ).toBe(500)
        expect(
          await prisma.outboxEvent.count({
            where: { aggregateId: contracts[0] },
          })
        ).toBe(0)
        expect(
          await prisma.contractSignatureAttempt.count({
            where: { contractId: contracts[0] },
          })
        ).toBe(0)
      } finally {
        await alterSharedAcl(
          pool,
          'GRANT INSERT ON contract_signature_attempts TO ' + role
        )
      }
      expect(
        (
          await request(host, '/api/contracts/sign', {
            method: 'POST',
            data: { contractId: contracts[0] },
          })
        ).status
      ).toBe(202)
    })
    it('never exposes a provider URL or unowned stored path', async () => {
      await prisma.contract.update({
        where: { id: contracts[0] },
        data: { status: 'SIGNED', pdfUrl: 'https://untrusted.invalid/file' },
      })
      const r = await request(host, `/api/contracts/${rentals[0]}/download`)
      expect(r.status).toBe(409)
      expect(r.headers.has('location')).toBe(false)
    })
    it.each(['contract.pdf', 'unavailable.pdf'])(
      'uses only private storage with five-minute signing: %s',
      async (fileName) => {
        const userId = context.identity.users[0]!.id,
          filePath = `tenants/${context.alfa.id}/clients/${userId}/${fileName}`
        await prisma.contract.update({
          where: { id: contracts[0] },
          data: { status: 'SIGNED', pdfUrl: 'private:' + filePath },
        })
        await prisma.clientDocument.create({
          data: {
            tenantId: context.alfa.id,
            rentalId: rentals[0],
            userId,
            uploadedBy: userId,
            filePath,
            fileName,
            mimeType: 'application/pdf',
            fileSize: 100,
            type: 'SIGNED_CONTRACT',
          },
        })
        const r = await request(host, `/api/contracts/${rentals[0]}/download`, {
          cookie: client,
        })
        expect(r.status).toBe(fileName === 'unavailable.pdf' ? 502 : 303)
        if (r.status === 303) {
          expect(r.headers.get('location')).toContain(
            context.storageOrigin + '/storage/v1/object/sign/'
          )
          expect(r.headers.get('cache-control')).toBe('private, no-store')
        }
        const calls = await (
          await fetch(context.storageOrigin + '/__fixture/requests')
        ).json()
        expect(calls).toContainEqual({
          method: 'POST',
          path:
            '/storage/v1/object/sign/gb-locacoes-client-documents/' + filePath,
          body: { expiresIn: 300 },
        })
      }
    )
    it('requires a scoped authenticated webhook before persistence', async () => {
      expect((await webhook(host, event(), { global: true })).status).toBe(410)
      expect(
        (await webhook(host, event(), { signature: 'invalid' })).status
      ).toBe(401)
      expect(
        (await webhook(host, event(), { integration: 'missing' })).status
      ).toBe(503)
      expect((await webhook(host, {}, { raw: '{' })).status).toBe(400)
      expect(
        await prisma.webhookInbox.count({
          where: { integrationId: integrations[0] },
        })
      ).toBe(0)
    })
    it('signs only the integration-bound agreement and deduplicates archive effects', async () => {
      const data = event(),
        a = await webhook(host, data),
        b = await webhook(host, data)
      expect(a.status).toBe(200)
      expect(b).toEqual({
        status: 200,
        body: { success: true, duplicate: true },
      })
      const contract = await prisma.contract.findUniqueOrThrow({
        where: { id: contracts[0] },
      })
      expect(contract.status).toBe('SIGNED')
      expect(contract.signedBy).toBe('Fixture signer')
      expect(contract.signedAt?.toISOString()).toBe('2030-01-03T00:00:00.000Z')
      expect(
        await prisma.outboxEvent.count({
          where: {
            aggregateId: contracts[0],
            topic: 'contract.signed.archive',
          },
        })
      ).toBe(1)
      const receipt = await prisma.webhookInbox.findFirstOrThrow({
        where: { integrationId: integrations[0] },
      })
      expect(receipt.processedAt).not.toBeNull()
      expect(receipt.tenantId).toBe(context.alfa.id)
      expect(
        (
          await prisma.contract.findUniqueOrThrow({
            where: { id: contracts[2] },
          })
        ).status
      ).toBe('DRAFT')
      expect(
        (await webhook(host, { ...data, status: 'CANCELLED' })).status
      ).toBe(409)
    })
    it('refuses a contract callback through another tenant integration', async () => {
      expect(
        (await webhook(host, event(), { integration: integrations[1] })).status
      ).toBe(404)
      expect(
        (
          await prisma.contract.findUniqueOrThrow({
            where: { id: contracts[0] },
          })
        ).status
      ).toBe('DRAFT')
    })
    it.each([
      { signed_at: 'bad' },
      { pdf_url: 'http://untrusted.invalid/file' },
    ])('preserves malformed callback rejection %j', async (extra) => {
      expect((await webhook(host, { ...event(), ...extra })).status).toBe(400)
      expect(
        await prisma.outboxEvent.count({
          where: {
            aggregateId: contracts[0],
            topic: 'contract.signed.archive',
          },
        })
      ).toBe(0)
    })
  })
it('serializes simultaneous signature requests across both hosts into one attempt', async () => {
  const result = await Promise.all(
    Array.from({ length: 8 }, (_, n) =>
      request(rotatingTarget(context, n), '/api/contracts/sign', {
        method: 'POST',
        cookie: client,
        data: { contractId: contracts[0] },
      })
    )
  )
  expect(result.map((r) => r.status)).toEqual(Array(8).fill(202))
  // parity-scan: oito pedidos reais simultâneos (alternando os hosts no ar) resultam numa só tentativa.
  expect(new Set(result.map((r) => r.body.requestId)).size).toBe(1)
  expect(
    await prisma.contractSignatureAttempt.count({
      where: { contractId: contracts[0] },
    })
  ).toBe(1)
  expect(
    await prisma.outboxEvent.count({
      where: { aggregateId: contracts[0], topic: 'contract.signature.request' },
    })
  ).toBe(1)
})
