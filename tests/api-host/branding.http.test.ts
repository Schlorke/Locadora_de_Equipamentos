import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
} from 'vitest'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient, type Setting } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import sharp from 'sharp'
import { requireTestDatabase } from '../helpers/test-database'
import { settingRowForCreate } from '../helpers/settings-rows'
import { signInParityUser } from './identity'
import { alterSharedAcl } from '../helpers/shared-acl'
import { parityTargets, rotatingTarget } from './targets'

const context = inject('apiParity'),
  hosts = parityTargets(context)
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const user = context.identity.users[1]!.id,
  member = randomUUID(),
  permissionIds = [randomUUID(), randomUUID()]
const tenants = [context.alfa.id, context.bravo.id]
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[56]!,
}
let admin: string,
  client: string,
  png: Buffer,
  originalSettings: Setting[],
  bravoMember: string
const input = {
  seoTitle: 'Local settings fixture',
  seoDescription: 'Configuração local de locadora',
  themeColorPrimary: '#ea580c',
}
const headers = (
  cookie = admin,
  tenant = context.alfa.id,
  origin = edge['x-platform-origin']
) => ({ ...edge, Cookie: cookie, 'x-tenant-id': tenant, Origin: origin })
async function settings(
  host: string,
  method = 'GET',
  body?: unknown,
  extra: Record<string, string> = {}
) {
  const r = await fetch(host + '/api/admin/settings', {
    method,
    headers: {
      ...headers(),
      ...extra,
      ...(method === 'PUT' ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(method === 'PUT'
      ? {
          body: typeof body === 'string' ? body : JSON.stringify(body ?? input),
        }
      : {}),
  })
  return { status: r.status, headers: r.headers, body: await r.json() }
}
function form(
  file: File | null = new File([new Uint8Array(png)], 'malicious.html', {
    type: 'image/png',
  }),
  kind: string | null = null
) {
  const f = new FormData()
  if (file) f.set('file', file)
  if (kind !== null) f.set('type', kind)
  return f
}
async function upload(
  host: string,
  body: NonNullable<Parameters<typeof fetch>[1]>['body'] = form(),
  extra: Record<string, string> = {}
) {
  const r = await fetch(host + '/api/upload', {
    method: 'POST',
    headers: { ...headers(), ...extra },
    body,
  })
  return { status: r.status, body: await r.json() }
}
async function storage(mode = 'ready') {
  const r = await fetch(context.storageOrigin + '/__fixture/mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  })
  expect(r.status).toBe(200)
}
type Call = {
  method: string
  path: string
  body: {
    bytes: number
    encoded: string
    contentType: string
    cacheControl: string
    upsert: string
  }
}
async function requests(): Promise<Call[]> {
  return (await fetch(context.storageOrigin + '/__fixture/requests')).json()
}
async function restoreSettings() {
  await prisma.setting.deleteMany({ where: { tenantId: { in: tenants } } })
  for (const row of originalSettings)
    await prisma.setting.create({ data: settingRowForCreate(row) })
}
async function cleanAudits() {
  await prisma.auditLog.deleteMany({
    where: {
      tenantId: { in: tenants },
      userId: user,
      action: 'UPLOAD_REQUEST',
      entity: 'IMAGE',
    },
  })
}
beforeAll(async () => {
  originalSettings = await prisma.setting.findMany({
    where: { tenantId: { in: tenants } },
  })
  admin = await signInParityUser(context, edge, 1)
  client = await signInParityUser(context, edge, 0)
  png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer()
  await prisma.membership.create({
    data: {
      id: member,
      tenantId: context.alfa.id,
      userId: user,
      role: 'ADMIN',
    },
  })
  bravoMember = (
    await prisma.membership.findUniqueOrThrow({
      where: { tenantId_userId: { tenantId: context.bravo.id, userId: user } },
    })
  ).id
  expect(
    await prisma.auditLog.count({
      where: {
        tenantId: { in: tenants },
        userId: user,
        action: 'UPLOAD_REQUEST',
        entity: 'IMAGE',
      },
    })
  ).toBe(0)
})
beforeEach(async () => {
  await restoreSettings()
  await cleanAudits()
  await storage()
  await prisma.permission.deleteMany({ where: { id: { in: permissionIds } } })
  await prisma.membership.update({
    where: { id: member },
    data: { role: 'ADMIN' },
  })
  await prisma.membership.update({
    where: { id: bravoMember },
    data: { role: 'OPERATOR' },
  })
})
afterAll(async () => {
  try {
    await restoreSettings()
    await cleanAudits()
    await storage()
    await prisma.permission.deleteMany({ where: { id: { in: permissionIds } } })
    await prisma.membership.deleteMany({ where: { id: member } })
    await prisma.membership.update({
      where: { id: bravoMember },
      data: { role: 'OPERATOR' },
    })
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
})
for (const host of hosts)
  describe('branding HTTP on ' + host, () => {
    it.each(['GET', 'PUT'])('refuses anonymous settings %s', async (method) => {
      const r = await settings(host, method, input, { Cookie: '' })
      expect(r.status).toBe(401)
    })
    it('refuses anonymous image upload before storage', async () => {
      expect((await upload(host, form(), { Cookie: '' })).status).toBe(401)
      expect(await requests()).toEqual([])
    })
    it.each(['OPERATOR', 'FINANCIAL', 'CLIENT'] as const)(
      'requires SETTINGS permissions for %s and ADMIN for image upload',
      async (role) => {
        await prisma.membership.update({
          where: { id: member },
          data: { role },
        })
        expect((await settings(host)).status).toBe(403)
        expect((await settings(host, 'PUT')).status).toBe(403)
        expect((await upload(host)).status).toBe(403)
        expect(await requests()).toEqual([])
      }
    )
    it('allows granular read/write but never turns it into image ADMIN access', async () => {
      await prisma.membership.update({
        where: { id: member },
        data: { role: 'OPERATOR' },
      })
      await prisma.permission.create({
        data: {
          id: permissionIds[0]!,
          tenantId: context.alfa.id,
          role: 'OPERATOR',
          module: 'SETTINGS',
          action: 'READ',
        },
      })
      expect((await settings(host)).status).toBe(200)
      expect((await settings(host, 'PUT')).status).toBe(403)
      await prisma.permission.create({
        data: {
          id: permissionIds[1]!,
          tenantId: context.alfa.id,
          role: 'OPERATOR',
          module: 'SETTINGS',
          action: 'WRITE',
        },
      })
      expect((await settings(host, 'PUT')).status).toBe(200)
      expect((await upload(host)).status).toBe(403)
    })
    it('refuses CLIENT settings even when a CLIENT permission exists', async () => {
      await prisma.permission.create({
        data: {
          id: permissionIds[0]!,
          tenantId: context.alfa.id,
          role: 'CLIENT',
          module: 'SETTINGS',
          action: 'READ',
        },
      })
      expect(
        (await settings(host, 'GET', undefined, { Cookie: client })).status
      ).toBe(403)
    })
    it('does not use a sister tenant permission for the current membership', async () => {
      await prisma.membership.update({
        where: { id: member },
        data: { role: 'OPERATOR' },
      })
      await prisma.permission.create({
        data: {
          id: permissionIds[0]!,
          tenantId: context.bravo.id,
          role: 'OPERATOR',
          module: 'SETTINGS',
          action: 'READ',
        },
      })
      expect((await settings(host)).status).toBe(403)
    })
    it('rejects sibling-origin writes before mutation or storage', async () => {
      expect(
        (
          await settings(host, 'PUT', input, {
            Origin: 'https://bravo.platform.test',
          })
        ).status
      ).toBe(403)
      expect(
        (await upload(host, form(), { Origin: 'https://bravo.platform.test' }))
          .status
      ).toBe(403)
      expect(await requests()).toEqual([])
      expect(
        await prisma.auditLog.count({
          where: { tenantId: context.alfa.id, action: 'UPLOAD_REQUEST' },
        })
      ).toBe(0)
    })
    it('reads defaults without creating a row and then creates exactly one on edit', async () => {
      await prisma.setting.deleteMany({ where: { tenantId: context.alfa.id } })
      const r = await settings(host)
      expect(r.status).toBe(200)
      expect(r.headers.get('cache-control')).toBe('no-store')
      expect(r.body.data).toMatchObject({
        tenantId: context.alfa.id,
        themeColorPrimary: '#ea580c',
        waveAnimation: 'animated',
        supportChat: true,
        contactEmail: '',
      })
      expect(r.body.data.seoTitle).toBe(
        (
          await prisma.organization.findUniqueOrThrow({
            where: { id: context.alfa.id },
          })
        ).name
      )
      expect(
        await prisma.setting.count({ where: { tenantId: context.alfa.id } })
      ).toBe(0)
      expect((await settings(host, 'PUT')).status).toBe(200)
      expect(
        await prisma.setting.count({ where: { tenantId: context.alfa.id } })
      ).toBe(1)
    })
    it('hides stored secrets, preserves them during edit and writes only the selected tenant', async () => {
      await prisma.setting.updateMany({
        where: { tenantId: context.alfa.id },
        data: {
          smtpConfig: {
            password: 'fixture-private-password',
            username: 'fixture-private-user',
            host: 'old.example.test',
          },
          securityConfig: {
            recaptchaSecretKey: 'fixture-private-secret',
            recaptchaSiteKey: 'public-key',
          },
        },
      })
      const foreign = await prisma.setting.findFirstOrThrow({
        where: { tenantId: context.bravo.id },
      })
      const read = await settings(host)
      expect(read.status).toBe(200)
      expect(JSON.stringify(read.body)).not.toContain('fixture-private-')
      expect(read.body.data.smtpConfig).toEqual({ host: 'old.example.test' })
      expect(read.body.data.securityConfig).toEqual({
        recaptchaSiteKey: 'public-key',
      })
      const r = await settings(host, 'PUT', {
        ...input,
        tenantId: context.bravo.id,
        smtpConfig: { host: 'new.example.test' },
        securityConfig: { enable2FA: true },
        unknown: 'discard',
      })
      expect(r.status).toBe(200)
      expect(r.body.message).toBe('Configurações atualizadas com sucesso!')
      expect(r.headers.get('cache-control')).toBe('no-store')
      expect(JSON.stringify(r.body)).not.toContain('fixture-private-')
      expect(r.body.data).not.toHaveProperty('unknown')
      expect(
        await prisma.setting.findFirstOrThrow({
          where: { tenantId: context.alfa.id },
        })
      ).toMatchObject({
        smtpConfig: {
          password: 'fixture-private-password',
          username: 'fixture-private-user',
          host: 'new.example.test',
        },
        securityConfig: {
          recaptchaSecretKey: 'fixture-private-secret',
          recaptchaSiteKey: 'public-key',
          enable2FA: true,
        },
      })
      expect(
        await prisma.setting.findFirstOrThrow({
          where: { tenantId: context.bravo.id },
        })
      ).toEqual(foreign)
    })
    it.each([
      { smtpConfig: { password: 'attempted-placeholder' } },
      { smtpConfig: { username: 'attempted-user' } },
      { securityConfig: { recaptchaSecretKey: 'attempted-secret' } },
    ])('refuses plaintext credential edits %j', async (privateInput) => {
      const previous = await prisma.setting.findFirstOrThrow({
        where: { tenantId: context.alfa.id },
      })
      const r = await settings(host, 'PUT', { ...input, ...privateInput })
      expect(r.status).toBe(400)
      expect(r.body).toEqual({
        success: false,
        error:
          'Credenciais devem ser configuradas pela integração segura da locadora.',
      })
      expect(
        await prisma.setting.findFirstOrThrow({
          where: { tenantId: context.alfa.id },
        })
      ).toEqual(previous)
    })
    it.each([
      '{invalid',
      { ...input, seoTitle: '' },
      { ...input, themeColorPrimary: 'red' },
    ])('preserves 400 for invalid settings %j', async (body) => {
      const r = await settings(host, 'PUT', body)
      expect(r.status).toBe(400)
      expect(r.body).toEqual({
        success: false,
        error: 'Configurações inválidas.',
      })
    })
    // Onda 134: o conteúdo institucional vai no PUT do formulário (objeto inteiro); sem ele no corpo, o gravado fica.
    it('round-trips siteContent through the settings form and keeps it when the body omits it', async () => {
      const siteContent = {
        experienceYears: 9,
        timeline: [
          { year: 2017, title: 'Fundação', description: 'Primeira loja.' },
        ],
        commitments: { certifiedEquipment: true },
        storeLocation: {
          latitude: -25.43,
          longitude: -49.27,
          addressLine1: 'Rua Exemplo, 100',
        },
      }
      const saved = await settings(host, 'PUT', { ...input, siteContent })
      expect(saved.status).toBe(200)
      expect(saved.body.data.siteContent).toEqual(siteContent)
      expect((await settings(host)).body.data.siteContent).toEqual(siteContent)
      expect((await settings(host, 'PUT', input)).status).toBe(200)
      expect(
        (
          await prisma.setting.findFirstOrThrow({
            where: { tenantId: context.alfa.id },
          })
        ).siteContent
      ).toEqual(siteContent)
      expect(
        (
          await prisma.setting.findFirstOrThrow({
            where: { tenantId: context.bravo.id },
          })
        ).siteContent
      ).toEqual({})
      for (const invalid of [
        { experienceYears: 0 },
        { unknownKey: true },
        { history: 'linha\u0000oculta' },
        [],
      ]) {
        const r = await settings(host, 'PUT', {
          ...input,
          siteContent: invalid,
        })
        expect(r.status, JSON.stringify(invalid)).toBe(400)
      }
      expect(
        (
          await prisma.setting.findFirstOrThrow({
            where: { tenantId: context.alfa.id },
          })
        ).siteContent
      ).toEqual(siteContent)
    })
    it('the database refuses duplicate settings and preserves the original row', async () => {
      const original = await prisma.setting.findFirstOrThrow({
        where: { tenantId: context.alfa.id },
      })
      await expect(
        prisma.setting.create({ data: { tenantId: context.alfa.id } })
      ).rejects.toMatchObject({ code: 'P2002' })
      const result = await settings(host)
      expect(result.status).toBe(200)
      expect(result.body.data.id).toBe(original.id)
      expect(result.body.data.seoTitle).toBe(original.seoTitle)
      expect(
        await prisma.setting.count({ where: { tenantId: context.alfa.id } })
      ).toBe(1)
    })
    it('serializes concurrent create requests across the hosts', async () => {
      await prisma.setting.deleteMany({ where: { tenantId: context.alfa.id } })
      // Duas requisições reais e simultâneas: raiz e API, ou a API duas vezes sem a raiz (onda 135, B2).
      const results = await Promise.all(
        [0, 1].map((index) => settings(rotatingTarget(context, index), 'PUT'))
      )
      expect(results.map((r) => r.status)).toEqual([200, 200])
      expect(
        await prisma.setting.count({ where: { tenantId: context.alfa.id } })
      ).toBe(1)
    })
    it.each([
      { label: 'missing-file-and-kind', file: null, kind: null },
      {
        label: 'invalid-kind',
        file: new File(['x'], 'x.png', { type: 'image/png' }),
        kind: 'wrong',
      },
    ])(
      'rejects $label multipart shape before consuming quota',
      async ({ file, kind }) => {
        expect((await upload(host, form(file, kind))).status).toBe(400)
        expect(await requests()).toEqual([])
        expect(
          await prisma.auditLog.count({
            where: { tenantId: context.alfa.id, action: 'UPLOAD_REQUEST' },
          })
        ).toBe(0)
      }
    )
    it('charges one audit slot for accepted multipart even when image bytes are invalid', async () => {
      expect(
        (
          await upload(
            host,
            form(new File(['<script>'], 'fake.png', { type: 'image/png' }))
          )
        ).status
      ).toBe(400)
      expect(await requests()).toEqual([])
      expect(
        await prisma.auditLog.count({
          where: { tenantId: context.alfa.id, action: 'UPLOAD_REQUEST' },
        })
      ).toBe(1)
    })
    it.each(['equipment', 'logo'])(
      'optimizes PNG and namespaces %s without trusting the filename',
      async (kind) => {
        const r = await upload(host, form(undefined, kind))
        expect(r.status).toBe(200)
        expect(r.body).toMatchObject({
          success: true,
          originalSize: png.length,
          format: 'webp',
          optimized: true,
        })
        expect(r.body.filename).toMatch(
          new RegExp('^' + kind + '-[a-f0-9-]+\\.webp$')
        )
        const calls = await requests()
        expect(calls).toHaveLength(1)
        expect(calls[0]!.path).toBe(
          '/storage/v1/object/gb-locacoes-images/tenants/' +
            context.alfa.id +
            '/' +
            (kind === 'logo' ? 'logos/' : 'equipments/') +
            r.body.filename
        )
        expect(r.body.url).toBe(
          context.storageOrigin +
            '/storage/v1/object/public/gb-locacoes-images/tenants/' +
            context.alfa.id +
            '/' +
            (kind === 'logo' ? 'logos/' : 'equipments/') +
            r.body.filename
        )
        expect(calls[0]!.body).toMatchObject({
          contentType: 'image/webp',
          cacheControl: 'max-age=31536000',
          upsert: 'false',
          bytes: r.body.size,
        })
        expect(
          (
            await sharp(
              Buffer.from(calls[0]!.body.encoded, 'base64')
            ).metadata()
          ).format
        ).toBe('webp')
      }
    )
    it('sanitizes SVG active/external content and preserves a vector response', async () => {
      const source =
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script><image href="https://external.invalid/tracker"/><rect width="10" height="10" fill="red" onload="alert(1)"/></svg>'
      const r = await upload(
        host,
        form(new File([source], 'icon.svg', { type: 'image/svg+xml' }), 'logo')
      )
      expect(r.status).toBe(200)
      expect(r.body).toMatchObject({
        format: 'svg',
        optimized: false,
        success: true,
      })
      expect(
        Buffer.from((await requests())[0]!.body.encoded, 'base64').toString()
      ).not.toMatch(/script|onload|https:|href/)
    })
    it('preserves 502 on storage failure and keeps the quota audit', async () => {
      await storage('upload-failure')
      expect((await upload(host)).status).toBe(502)
      expect(
        await prisma.auditLog.count({
          where: { tenantId: context.alfa.id, action: 'UPLOAD_REQUEST' },
        })
      ).toBe(1)
    })
    it('serializes the last quota slot between hosts and keeps tenants independent', async () => {
      await prisma.auditLog.createMany({
        data: Array.from({ length: 29 }, () => ({
          tenantId: context.alfa.id,
          userId: user,
          action: 'UPLOAD_REQUEST',
          entity: 'IMAGE',
          entityId: randomUUID(),
        })),
      })
      // Duas requisições reais e simultâneas: raiz e API, ou a API duas vezes sem a raiz (onda 135, B2).
      const results = await Promise.all(
        [0, 1].map((index) => upload(rotatingTarget(context, index)))
      )
      expect(results.map((r) => r.status).sort()).toEqual([200, 429])
      expect(await requests()).toHaveLength(1)
      expect(
        await prisma.auditLog.count({
          where: { tenantId: context.alfa.id, action: 'UPLOAD_REQUEST' },
        })
      ).toBe(30)
      await prisma.membership.update({
        where: { id: bravoMember },
        data: { role: 'ADMIN' },
      })
      expect(
        (await upload(host, form(), { 'x-tenant-id': context.bravo.id })).status
      ).toBe(200)
      expect((await requests())[1]!.path).toContain(
        '/tenants/' + context.bravo.id + '/'
      )
    })
    it('rolls back failed settings writes and recovers after permissions are restored', async () => {
      const role = /role=(api_parity_[a-f0-9]+)/.exec(
        new URL(context.runtimeUrl).searchParams.get('options') ?? ''
      )?.[1]
      if (!role) throw Error('Missing own runtime role')
      const previous = await prisma.setting.findFirstOrThrow({
        where: { tenantId: context.alfa.id },
      })
      await alterSharedAcl(pool, 'REVOKE UPDATE ON settings FROM ' + role)
      try {
        const r = await settings(host, 'PUT')
        expect(r.status).toBe(400)
        expect(r.body.error).toBe(
          'Não foi possível atualizar as configurações desta locadora.'
        )
        expect(
          await prisma.setting.findFirstOrThrow({
            where: { tenantId: context.alfa.id },
          })
        ).toEqual(previous)
      } finally {
        await alterSharedAcl(pool, 'GRANT UPDATE ON settings TO ' + role)
      }
      expect((await settings(host, 'PUT')).status).toBe(200)
    })
  })
