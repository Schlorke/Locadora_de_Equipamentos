import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
} from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { createHttpClient } from '../../packages/frontend/src/shared/api/http-client'
import { createClientDocumentsApi } from '../../packages/frontend/src/pages/locacoes/api/client-documents'
import { alterSharedAcl } from '../helpers/shared-acl'
import { parityTargets } from './targets'

const context = inject('apiParity'),
  hosts = parityTargets(context)
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const rentals = [randomUUID(), randomUUID()],
  profiles = [randomUUID(), randomUUID()],
  member = randomUUID()
const bytes = Buffer.from('%PDF-1.7\nlocal document fixture\n%%EOF')
const owner = context.identity.users[0]!.id
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[55]!,
}
let admin: string, client: string
const uploadPath = (rentalId = rentals[0]!) =>
  `/api/admin/rentals/${rentalId}/client-documents`
const listPath = (userId = owner) => `/api/admin/clients/${userId}/documents`
function headers(cookie = admin, origin = edge['x-platform-origin']) {
  return {
    ...edge,
    Origin: origin,
    Cookie: cookie,
    'x-tenant-id': context.alfa.id,
  }
}
function form(
  type = 'ID_DOCUMENT',
  file: File | null = new File([bytes], 'comprovação identidade.pdf', {
    type: 'application/pdf',
  }),
  metadata?: string
) {
  const body = new FormData()
  body.set('type', type)
  if (file) body.set('file', file)
  if (metadata !== undefined) body.set('captureMetadata', metadata)
  return body
}
async function storage(mode = 'ready') {
  const response = await fetch(context.storageOrigin + '/__fixture/mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  })
  expect(response.status).toBe(200)
}
async function requests(): Promise<
  Array<{ method: string; path: string; body: unknown }>
> {
  return (await fetch(context.storageOrigin + '/__fixture/requests')).json()
}
async function clean() {
  await prisma.clientDocument.deleteMany({
    where: { rentalId: { in: rentals } },
  })
}
beforeAll(async () => {
  admin = await signInParityUser(context, edge, 1)
  client = await signInParityUser(context, edge, 0)
  await prisma.membership.create({
    data: {
      id: member,
      tenantId: context.alfa.id,
      userId: context.identity.users[1]!.id,
      role: 'ADMIN',
    },
  })
  for (let n = 0; n < 2; n++) {
    const tenant = n ? context.bravo.id : context.alfa.id
    await prisma.clientProfile.create({
      data: {
        id: profiles[n]!,
        tenantId: tenant,
        userId: owner,
        email: 'document-owner@example.test',
        name: 'Local tenant document owner',
      },
    })
    await prisma.rentals.create({
      data: {
        id: rentals[n]!,
        tenantId: tenant,
        userid: owner,
        startdate: new Date('2030-02-01'),
        enddate: new Date('2030-02-03'),
        total: '50',
      },
    })
  }
})
beforeEach(async () => {
  await clean()
  await storage()
  await prisma.membership.update({
    where: { id: member },
    data: { role: 'ADMIN' },
  })
})
afterAll(async () => {
  try {
    await storage()
    await clean()
    await prisma.rentals.deleteMany({ where: { id: { in: rentals } } })
    await prisma.clientProfile.deleteMany({ where: { id: { in: profiles } } })
    await prisma.membership.deleteMany({ where: { id: member } })
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
})

for (const host of hosts)
  describe('private client documents on ' + host, () => {
    it('wave66 consumer uploads multipart bytes and relists private evidence under RLS', async () => {
      const api = createClientDocumentsApi(
        createHttpClient({ baseUrl: host, getHeaders: () => headers() })
      )
      const result = await api.upload(
        rentals[0]!,
        form(
          'SIGNED_CONTRACT',
          undefined,
          JSON.stringify({ source: 'admin-rentals-page' })
        )
      )
      expect(result.document).toMatchObject({
        userId: owner,
        rentalId: rentals[0],
        type: 'SIGNED_CONTRACT',
      })
      expect(result.document).not.toHaveProperty('filePath')
      const list = await api.list(owner)
      expect(list.documents).toHaveLength(1)
      expect(list.documents[0]?.id).toBe(result.document.id)
      expect(list.documents[0]?.signedUrl).toBeTruthy()
      const stored = await prisma.clientDocument.findUniqueOrThrow({
        where: { id: result.document.id },
      })
      expect(stored.tenantId).toBe(context.alfa.id)
      expect(stored.fileHash).toBe(
        createHash('sha256').update(bytes).digest('hex')
      )
      await expect(api.upload(rentals[1]!, form())).rejects.toMatchObject({
        status: 404,
      })
      await prisma.membership.update({
        where: { id: member },
        data: { role: 'FINANCIAL' },
      })
      await expect(api.list(owner)).rejects.toMatchObject({ status: 403 })
      expect(
        await prisma.clientDocument.count({ where: { rentalId: rentals[0] } })
      ).toBe(1)
    })

    it.each(['GET', 'POST'])(
      'refuses anonymous %s before storage',
      async (method) => {
        const response = await fetch(
          host + (method === 'GET' ? listPath() : uploadPath()),
          {
            method,
            headers: { ...edge, 'x-tenant-id': context.alfa.id },
            ...(method === 'POST' ? { body: form() } : {}),
          }
        )
        expect(response.status).toBe(401)
        expect(await requests()).toEqual([])
      }
    )
    it.each(['CLIENT', 'FINANCIAL'] as const)(
      'refuses %s upload before storage',
      async (role) => {
        await prisma.membership.update({
          where: { id: member },
          data: { role },
        })
        expect(
          (
            await fetch(host + uploadPath(), {
              method: 'POST',
              headers: headers(),
              body: form(),
            })
          ).status
        ).toBe(403)
        expect(await requests()).toEqual([])
      }
    )
    it('refuses FINANCIAL listing before storage', async () => {
      await prisma.membership.update({
        where: { id: member },
        data: { role: 'FINANCIAL' },
      })
      expect(
        (await fetch(host + listPath(), { headers: headers() })).status
      ).toBe(403)
      expect(await requests()).toEqual([])
    })
    it('allows the CLIENT owner list and refuses another owner', async () => {
      const own = await fetch(host + listPath(), { headers: headers(client) })
      expect(own.status).toBe(200)
      expect(await own.json()).toEqual({ documents: [] })
      expect(own.headers.get('cache-control')).toBe('private, no-store')
      expect(
        (
          await fetch(host + listPath(context.identity.users[1]!.id), {
            headers: headers(client),
          })
        ).status
      ).toBe(403)
    })
    it('checks rental ownership before parsing malformed upload data', async () => {
      const response = await fetch(host + uploadPath(rentals[1]!), {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: '{invalid',
      })
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'Locação não encontrada' })
      expect(await requests()).toEqual([])
    })
    it('rejects sibling origin before any storage operation', async () => {
      expect(
        (
          await fetch(host + uploadPath(), {
            method: 'POST',
            headers: headers(admin, 'https://bravo.platform.test'),
            body: form(),
          })
        ).status
      ).toBe(403)
      expect(await requests()).toEqual([])
      expect(
        await prisma.clientDocument.count({ where: { rentalId: rentals[0] } })
      ).toBe(0)
    })
    it.each([
      ['missing file', () => form('ID_DOCUMENT', null), 'Arquivo obrigatório'],
      ['invalid type', () => form('OTHER'), 'Documento inválido'],
      [
        'invalid metadata',
        () => form('ID_DOCUMENT', undefined, '{invalid'),
        'captureMetadata deve ser JSON válido',
      ],
      [
        'array metadata',
        () => form('ID_DOCUMENT', undefined, '[]'),
        'Metadados devem ser um objeto JSON',
      ],
      [
        'invalid PDF',
        () =>
          form(
            'ID_DOCUMENT',
            new File(['not pdf'], 'fake.pdf', { type: 'application/pdf' })
          ),
        'PDF inválido',
      ],
      [
        'wrong MIME',
        () =>
          form(
            'ID_DOCUMENT',
            new File([bytes], 'fake.txt', { type: 'text/plain' })
          ),
        'Tipo de documento não permitido',
      ],
    ] as const)(
      'refuses %s before creating an object',
      async (_name, body, error) => {
        const response = await fetch(host + uploadPath(), {
          method: 'POST',
          headers: headers(),
          body: body(),
        })
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error })
        expect(await requests()).toEqual([])
      }
    )
    it.each(['ADMIN', 'OPERATOR'] as const)(
      'persists %s upload with hash, metadata and a short private URL',
      async (role) => {
        await prisma.membership.update({
          where: { id: member },
          data: { role },
        })
        const response = await fetch(host + uploadPath(), {
          method: 'POST',
          headers: headers(),
          body: form('ID_DOCUMENT', undefined, '{"source":"local fixture"}'),
        })
        expect(response.status).toBe(200)
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        const { document } = await response.json()
        expect(document).toMatchObject({
          userId: owner,
          rentalId: rentals[0],
          type: 'ID_DOCUMENT',
          mimeType: 'application/pdf',
          fileSize: bytes.length,
          fileHash: createHash('sha256').update(bytes).digest('hex'),
          fileName: 'comprova__o_identidade.pdf',
        })
        expect(document.signedUrl).toContain(context.storageOrigin)
        expect(document).not.toHaveProperty('filePath')
        const stored = await prisma.clientDocument.findUniqueOrThrow({
          where: { id: document.id },
        })
        expect(stored).toMatchObject({
          tenantId: context.alfa.id,
          userId: owner,
          uploadedBy: context.identity.users[1]!.id,
          captureMetadata: { source: 'local fixture' },
        })
        expect(stored.filePath).toMatch(
          new RegExp(
            `^tenants/${context.alfa.id}/clients/${owner}/[a-f0-9-]+\\.pdf$`
          )
        )
        const calls = await requests()
        expect(
          calls.find(
            (call) =>
              call.method === 'POST' && call.path.includes('/object/sign/')
          )?.body
        ).toEqual({ expiresIn: 300 })
        expect(
          calls.find(
            (call) => call.method === 'POST' && !call.path.includes('/sign/')
          )?.body
        ).toEqual({ bytes: bytes.length })
      }
    )
    it('keeps a manually uploaded SIGNED_CONTRACT separate from a ZapSign signature', async () => {
      expect(
        (
          await fetch(host + uploadPath(), {
            method: 'POST',
            headers: headers(),
            body: form('SIGNED_CONTRACT'),
          })
        ).status
      ).toBe(200)
      expect(
        await prisma.clientDocument.count({
          where: { rentalId: rentals[0], type: 'SIGNED_CONTRACT' },
        })
      ).toBe(1)
      expect(
        await prisma.contract.count({ where: { rentalId: rentals[0] } })
      ).toBe(0)
    })
    it('refuses a public bucket before uploading', async () => {
      await storage('public')
      expect(
        (
          await fetch(host + uploadPath(), {
            method: 'POST',
            headers: headers(),
            body: form(),
          })
        ).status
      ).toBe(500)
      expect(
        (await requests()).filter((call) => call.method === 'POST')
      ).toEqual([])
    })
    it('returns 502 without a database row when object upload fails', async () => {
      await storage('upload-failure')
      const response = await fetch(host + uploadPath(), {
        method: 'POST',
        headers: headers(),
        body: form(),
      })
      expect(response.status).toBe(502)
      expect(await response.json()).toEqual({
        error: 'Erro ao armazenar documento',
      })
      expect(
        await prisma.clientDocument.count({ where: { rentalId: rentals[0] } })
      ).toBe(0)
    })
    it('preserves the stored document with null URL when URL signing fails', async () => {
      await storage('sign-failure')
      const response = await fetch(host + uploadPath(), {
        method: 'POST',
        headers: headers(),
        body: form(),
      })
      expect(response.status).toBe(200)
      expect((await response.json()).document.signedUrl).toBeNull()
      expect(
        await prisma.clientDocument.count({ where: { rentalId: rentals[0] } })
      ).toBe(1)
    })
    it('removes the uploaded object if the tenant database insert fails, and then recovers', async () => {
      const role = new URL(context.runtimeUrl).searchParams
        .get('options')
        ?.match(/role=(api_parity_[a-f0-9]+)/)?.[1]
      expect(role).toBeDefined()
      await alterSharedAcl(
        pool,
        `REVOKE INSERT ON client_documents FROM ${role}`
      )
      try {
        expect(
          (
            await fetch(host + uploadPath(), {
              method: 'POST',
              headers: headers(),
              body: form(),
            })
          ).status
        ).toBe(500)
        const calls = await requests(),
          upload = calls.find(
            (call) => call.method === 'POST' && !call.path.includes('/sign/')
          )!
        expect(calls.find((call) => call.method === 'DELETE')?.body).toEqual({
          prefixes: [upload.path.split('/gb-locacoes-client-documents/')[1]],
        })
        expect(
          await prisma.clientDocument.count({ where: { rentalId: rentals[0] } })
        ).toBe(0)
      } finally {
        await alterSharedAcl(
          pool,
          `GRANT INSERT ON client_documents TO ${role}`
        )
      }
      expect(
        (
          await fetch(host + uploadPath(), {
            method: 'POST',
            headers: headers(),
            body: form(),
          })
        ).status
      ).toBe(200)
    })
    it('lists only tenant/owner records, signing owned paths and suppressing alien keys', async () => {
      for (let n = 0; n < 3; n++)
        await prisma.clientDocument.create({
          data: {
            tenantId: n === 2 ? context.bravo.id : context.alfa.id,
            userId: owner,
            rentalId: rentals[n === 2 ? 1 : 0]!,
            type: 'ID_DOCUMENT',
            filePath: `tenants/${n === 1 || n === 2 ? context.bravo.id : context.alfa.id}/clients/${owner}/file-${n}.pdf`,
            fileName: `fixture-${n}.pdf`,
            mimeType: 'application/pdf',
            fileSize: bytes.length,
            fileHash: 'f'.repeat(64),
            uploadedBy: owner,
            createdAt: new Date(2030, 0, n + 1),
          },
        })
      const response = await fetch(host + listPath(), {
        headers: headers(client),
      })
      expect(response.status).toBe(200)
      const { documents } = await response.json()
      expect(
        documents.map((doc: { fileName: string }) => doc.fileName)
      ).toEqual(['fixture-1.pdf', 'fixture-0.pdf'])
      expect(documents[0].signedUrl).toBeNull()
      expect(documents[1].signedUrl).toContain(context.storageOrigin)
      for (const doc of documents) {
        expect(doc).not.toHaveProperty('filePath')
        expect(doc.uploadedByUser.id).toBe(owner)
      }
      expect(
        (await requests()).filter((call) => call.path.includes('/object/sign/'))
      ).toHaveLength(1)
    })
  })
