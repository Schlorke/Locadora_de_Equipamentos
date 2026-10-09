// Onda 134 (lote vitrine-conteúdo): textos legais da vitrine por locadora nos dois hosts de API, com a mesma composição
// de packages/backend, sobre o PostgreSQL com o papel de negócio restrito (RLS FORCE, sem BYPASSRLS).
// - Painel: GET/PUT/DELETE /api/admin/settings/legal-documents/{kind}, SETTINGS READ/WRITE, mesma origem, auditoria.
// - Vitrine: GET /api/settings/public/legal-documents/{kind}, superfície identity; desligada = o 404 do D10.
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
import { PrismaClient, type Setting } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireTestDatabase } from '../helpers/test-database'
import { settingRowForCreate } from '../helpers/settings-rows'
import { signInParityUser } from './identity'
import { parityTargets } from './targets'

const context = inject('apiParity'),
  hosts = parityTargets(context)
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const user = context.identity.users[1]!.id,
  member = randomUUID(),
  permissionIds = [randomUUID(), randomUUID(), randomUUID()]
const tenants = [context.alfa.id, context.bravo.id]
const appEdge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[56]!,
}
const tenantEdge = (slug: string) => ({
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'tenant',
  'x-platform-tenant-slug': slug,
  'x-platform-origin': `https://${slug}.platform.test`,
})
const offSlug = 'w134-legal-off-' + randomUUID().slice(0, 8)
let offTenant: string
let admin: string, client: string, bravoMember: string
let originalSettings: Setting[]

const documento = {
  version: 1,
  lastUpdated: '19 de janeiro de 2026',
  intro: 'Bem-vindo aos Termos da Locadora Alfa.',
  sections: [
    {
      id: 'objeto',
      title: 'Objeto e Aceitação',
      blocks: [
        { type: 'paragraph', text: 'Estes Termos regulam o uso do site.' },
        {
          type: 'list',
          items: [
            'Manter seus dados atualizados.',
            { lead: 'Locação diária:', text: 'devolução no dia seguinte' },
          ],
        },
      ],
    },
    {
      id: 'contato',
      title: 'Contato',
      blocks: [{ type: 'paragraph', text: '<script>alert(1)</script>' }],
      contactCard: true,
      contactCardNote: 'Estamos à disposição.',
    },
  ],
}

async function adminLegal(
  host: string,
  kind: string,
  method = 'GET',
  body?: unknown,
  extra: Record<string, string> = {}
) {
  const response = await fetch(
    host + '/api/admin/settings/legal-documents/' + kind,
    {
      method,
      headers: {
        ...appEdge,
        Cookie: admin,
        'x-tenant-id': context.alfa.id,
        Origin: appEdge['x-platform-origin'],
        ...(method === 'PUT' ? { 'Content-Type': 'application/json' } : {}),
        ...extra,
      },
      ...(body === undefined
        ? {}
        : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    }
  )
  const text = await response.text()
  return {
    status: response.status,
    headers: response.headers,
    text,
    body: text ? JSON.parse(text) : null,
  }
}

async function publicLegal(
  host: string,
  kind: string,
  query = '',
  headers: Record<string, string> = {}
) {
  const response = await fetch(
    host + '/api/settings/public/legal-documents/' + kind + query,
    { headers }
  )
  return {
    status: response.status,
    body: await response.text(),
    headers: Object.fromEntries(
      ['content-type', 'cache-control', 'vary', 'set-cookie'].map((key) => [
        key,
        response.headers.get(key),
      ])
    ),
  }
}

const audits = () =>
  prisma.auditLog.findMany({
    where: {
      tenantId: { in: tenants },
      action: {
        in: ['STOREFRONT_LEGAL_PUBLISHED', 'STOREFRONT_LEGAL_UNPUBLISHED'],
      },
    },
    orderBy: { createdAt: 'asc' },
  })

async function restoreSettings() {
  await prisma.setting.deleteMany({ where: { tenantId: { in: tenants } } })
  for (const row of originalSettings)
    await prisma.setting.create({ data: settingRowForCreate(row) })
}

beforeAll(async () => {
  originalSettings = await prisma.setting.findMany({
    where: { tenantId: { in: tenants } },
  })
  // A fixture começa sem textos legais: a prova parte do estado do corte.
  for (const row of originalSettings) {
    expect(row.termsDocument).toBeNull()
    expect(row.privacyDocument).toBeNull()
    expect(row.returnPolicyDocument).toBeNull()
  }
  admin = await signInParityUser(context, appEdge, 1)
  client = await signInParityUser(context, appEdge, 0)
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
  // Locadora ativa sem publicação do site (OFF, D10): criada fora do contexto de plataforma, nasce desligada.
  offTenant = (
    await prisma.organization.create({
      data: { name: 'Locadora Desligada', slug: offSlug },
    })
  ).id
  await prisma.setting.create({ data: { tenantId: offTenant } })
})

beforeEach(async () => {
  await restoreSettings()
  await prisma.auditLog.deleteMany({
    where: {
      tenantId: { in: [...tenants, offTenant] },
      action: {
        in: ['STOREFRONT_LEGAL_PUBLISHED', 'STOREFRONT_LEGAL_UNPUBLISHED'],
      },
    },
  })
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
    await prisma.auditLog.deleteMany({
      where: {
        tenantId: { in: [...tenants, offTenant] },
        action: {
          in: ['STOREFRONT_LEGAL_PUBLISHED', 'STOREFRONT_LEGAL_UNPUBLISHED'],
        },
      },
    })
    await prisma.permission.deleteMany({ where: { id: { in: permissionIds } } })
    await prisma.membership.deleteMany({ where: { id: member } })
    await prisma.membership.update({
      where: { id: bravoMember },
      data: { role: 'OPERATOR' },
    })
    if (offTenant) {
      await prisma.setting.deleteMany({ where: { tenantId: offTenant } })
      await prisma.organization.deleteMany({ where: { id: offTenant } })
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
})

for (const host of hosts)
  describe('textos legais da vitrine em ' + host, () => {
    it('alfa publica e lê os três documentos; bravo não vê nada da alfa', async () => {
      for (const [kind, slug] of [
        ['terms', 'terms'],
        ['privacy', 'privacy'],
        ['returnPolicy', 'return-policy'],
      ] as const) {
        const published = await adminLegal(host, slug, 'PUT', {
          document: documento,
        })
        expect(published.status).toBe(200)
        expect(published.headers.get('cache-control')).toBe('no-store')
        expect(published.body).toMatchObject({ kind, document: documento })
        const read = await adminLegal(host, slug)
        expect(read.status).toBe(200)
        expect(read.body).toEqual(published.body)
        const vitrine = await publicLegal(
          host,
          slug,
          `?tenantSlug=${context.alfa.slug}`
        )
        expect(vitrine.status).toBe(200)
        expect(vitrine.headers['cache-control']).toBe('no-store')
        expect(JSON.parse(vitrine.body)).toEqual({
          kind,
          document: documento,
          publishedAt: published.body.publishedAt,
        })
        // O texto vai como texto: o script do parágrafo sai igual, como dado JSON.
        expect(
          JSON.parse(vitrine.body).document.sections[1].blocks[0].text
        ).toBe('<script>alert(1)</script>')
        const bravo = await publicLegal(
          host,
          slug,
          `?tenantSlug=${context.bravo.slug}`
        )
        expect(bravo.status).toBe(404)
        expect(JSON.parse(bravo.body)).toEqual({
          error: 'Documento não publicado nesta locadora',
          code: 'LEGAL_DOCUMENT_NOT_PUBLISHED',
        })
        expect(bravo.body).not.toContain('Locadora Alfa')
      }
      // A leitura geral da vitrine passa a dizer quais documentos existem, sem o texto.
      const settings = await fetch(
        host + `/api/settings/public?tenantSlug=${context.alfa.slug}`
      )
      const body = await settings.json()
      expect(body.legalDocuments).toEqual({
        terms: true,
        privacy: true,
        returnPolicy: true,
      })
      expect(JSON.stringify(body)).not.toContain('Bem-vindo aos Termos')
      const bravo = await (
        await fetch(
          host + `/api/settings/public?tenantSlug=${context.bravo.slug}`
        )
      ).json()
      expect(bravo.legalDocuments).toEqual({
        terms: false,
        privacy: false,
        returnPolicy: false,
      })
    })

    it('publicar e despublicar gravam em audit_logs o hash e o tamanho, nunca o texto', async () => {
      expect(
        (await adminLegal(host, 'privacy', 'PUT', { document: documento }))
          .status
      ).toBe(200)
      const removed = await adminLegal(host, 'privacy', 'DELETE')
      expect(removed.status).toBe(200)
      expect(removed.body).toEqual({
        kind: 'privacy',
        document: null,
        publishedAt: null,
      })
      const rows = await audits()
      expect(rows.map((row) => row.action)).toEqual([
        'STOREFRONT_LEGAL_PUBLISHED',
        'STOREFRONT_LEGAL_UNPUBLISHED',
      ])
      for (const row of rows) {
        expect(row).toMatchObject({
          tenantId: context.alfa.id,
          userId: user,
          entity: 'Setting',
        })
        const changes = row.changes as Record<string, unknown>
        expect(changes.kind).toBe('privacy')
        expect(changes.sha256).toMatch(/^[0-9a-f]{64}$/)
        expect(changes.bytes).toBeGreaterThan(100)
        expect(JSON.stringify(row)).not.toMatch(/Bem-vindo|Objeto e Aceitação/)
      }
      expect((rows[0]!.changes as Record<string, unknown>).sha256).toBe(
        (rows[1]!.changes as Record<string, unknown>).sha256
      )
      // Documento e data zerados juntos; a vitrine volta ao 404 próprio.
      const row = await prisma.setting.findFirstOrThrow({
        where: { tenantId: context.alfa.id },
      })
      expect(row.privacyDocument).toBeNull()
      expect(row.privacyPublishedAt).toBeNull()
      expect(
        (await publicLegal(host, 'privacy', `?tenantSlug=${context.alfa.slug}`))
          .status
      ).toBe(404)
      // Despublicar o que não existe: 404, sem linha nova de auditoria.
      expect((await adminLegal(host, 'privacy', 'DELETE')).status).toBe(404)
      expect(await audits()).toHaveLength(2)
    })

    it.each(['GET', 'PUT', 'DELETE'])(
      'recusa %s anônimo (401)',
      async (method) => {
        const r = await adminLegal(
          host,
          'terms',
          method,
          method === 'PUT' ? { document: documento } : undefined,
          { Cookie: '' }
        )
        expect(r.status).toBe(401)
      }
    )

    it.each(['OPERATOR', 'FINANCIAL', 'CLIENT'] as const)(
      'sem a permissão SETTINGS, %s recebe 403 em tudo',
      async (role) => {
        await prisma.membership.update({
          where: { id: member },
          data: { role },
        })
        expect((await adminLegal(host, 'terms')).status).toBe(403)
        expect(
          (await adminLegal(host, 'terms', 'PUT', { document: documento }))
            .status
        ).toBe(403)
        expect((await adminLegal(host, 'terms', 'DELETE')).status).toBe(403)
        expect(await audits()).toEqual([])
      }
    )

    it('SETTINGS READ lê e não publica nem despublica; WRITE publica', async () => {
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
      expect((await adminLegal(host, 'terms')).status).toBe(200)
      expect(
        (await adminLegal(host, 'terms', 'PUT', { document: documento })).status
      ).toBe(403)
      expect((await adminLegal(host, 'terms', 'DELETE')).status).toBe(403)
      expect(await audits()).toEqual([])
      await prisma.permission.create({
        data: {
          id: permissionIds[1]!,
          tenantId: context.alfa.id,
          role: 'OPERATOR',
          module: 'SETTINGS',
          action: 'WRITE',
        },
      })
      expect(
        (await adminLegal(host, 'terms', 'PUT', { document: documento })).status
      ).toBe(200)
      expect((await adminLegal(host, 'terms', 'DELETE')).status).toBe(200)
    })

    it('CLIENT é recusado mesmo com uma permissão de CLIENT', async () => {
      await prisma.permission.create({
        data: {
          id: permissionIds[2]!,
          tenantId: context.alfa.id,
          role: 'CLIENT',
          module: 'SETTINGS',
          action: 'WRITE',
        },
      })
      expect(
        (
          await adminLegal(
            host,
            'terms',
            'PUT',
            { document: documento },
            { Cookie: client }
          )
        ).status
      ).toBe(403)
    })

    it('Origin de locadora irmã: 403 antes de gravar', async () => {
      for (const method of ['PUT', 'DELETE'])
        expect(
          (
            await adminLegal(
              host,
              'terms',
              method,
              method === 'PUT' ? { document: documento } : undefined,
              { Origin: 'https://bravo.platform.test' }
            )
          ).status,
          method
        ).toBe(403)
      const row = await prisma.setting.findFirstOrThrow({
        where: { tenantId: context.alfa.id },
      })
      expect(row.termsDocument).toBeNull()
      expect(await audits()).toEqual([])
    })

    it('sem a linha de configurações: 409 e nenhuma linha criada', async () => {
      await prisma.setting.deleteMany({ where: { tenantId: context.alfa.id } })
      const r = await adminLegal(host, 'terms', 'PUT', { document: documento })
      expect(r.status).toBe(409)
      expect(r.body).toMatchObject({ code: 'SETTINGS_NOT_CONFIGURED' })
      expect(
        await prisma.setting.count({ where: { tenantId: context.alfa.id } })
      ).toBe(0)
    })

    it.each([
      ['corpo inválido', '{', 400],
      [
        'HTML como bloco',
        {
          document: {
            ...documento,
            sections: [
              {
                id: 'a',
                title: 'A',
                blocks: [{ type: 'html', text: '<b>x</b>' }],
              },
            ],
          },
        },
        400,
      ],
      ['versão desconhecida', { document: { ...documento, version: 2 } }, 400],
      [
        'acima de 256 kB',
        { document: { ...documento, intro: 'x'.repeat(270_000) } },
        413,
      ],
    ] as const)('%s: %s', async (_caso, body, status) => {
      expect((await adminLegal(host, 'terms', 'PUT', body)).status).toBe(status)
      const row = await prisma.setting.findFirstOrThrow({
        where: { tenantId: context.alfa.id },
      })
      expect(row.termsDocument).toBeNull()
    })

    it('tipo inválido: 404 no painel e na vitrine', async () => {
      expect((await adminLegal(host, 'cookies')).status).toBe(404)
      expect(
        (
          await publicLegal(
            host,
            'returnPolicy',
            `?tenantSlug=${context.alfa.slug}`
          )
        ).status
      ).toBe(404)
    })
  })

/** Respostas esperadas da leitura pública e do painel do documento publicado acima (onda 135, B2). */
const expectedLegal = {
  public(name: string): unknown {
    let status = 200
    let body: unknown = {
      kind: 'returnPolicy',
      document: documento,
      publishedAt: '2030-01-02T12:00:00.000Z',
    }
    if (name === 'bravo') {
      status = 404
      body = {
        error: 'Documento não publicado nesta locadora',
        code: 'LEGAL_DOCUMENT_NOT_PUBLISHED',
      }
    } else if (name === 'sem seleção') {
      status = 409
      body = { error: 'Selecione uma locadora', code: 'TENANT_REQUIRED' }
    } else if (name === 'conflito') {
      status = 400
      body = {
        error: 'Seleção de locadora conflitante',
        code: 'TENANT_CONFLICT',
      }
    }
    return {
      status,
      body: JSON.stringify(body),
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        vary: 'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch',
        'set-cookie': null,
      },
    }
  },
  admin(): string {
    return JSON.stringify({
      kind: 'returnPolicy',
      document: documento,
      publishedAt: '2030-01-02T12:00:00.000Z',
    })
  },
}
describe('vitrine: paridade e locadora desligada (D10)', () => {
  it('locadora desligada (OFF) e desconhecida: o mesmo 404 neutro, byte a byte, nos dois hosts', async () => {
    for (const host of hosts) {
      const off = await publicLegal(host, 'terms', `?tenantSlug=${offSlug}`)
      const unknown = await publicLegal(
        host,
        'terms',
        `?tenantSlug=nao-existe-${randomUUID().slice(0, 8)}`
      )
      expect(off.status).toBe(404)
      expect(off).toEqual(unknown)
      expect(JSON.parse(off.body)).toEqual({ error: 'Locadora não encontrada' })
    }
  })

  it('cada host devolve o corpo e os cabeçalhos explícitos do documento publicado', async () => {
    const published = await adminLegal(hosts[0]!, 'return-policy', 'PUT', {
      document: documento,
    })
    expect(published.status).toBe(200)
    // The read fixture owns its timestamp; the publication cases above verify the live write clock.
    await prisma.setting.updateMany({
      where: { tenantId: context.alfa.id },
      data: { returnPolicyPublishedAt: new Date('2030-01-02T12:00:00.000Z') },
    })
    for (const [name, query, headers] of [
      ['alfa', `?tenantSlug=${context.alfa.slug}`, {}],
      ['host alfa', '', tenantEdge(context.alfa.slug)],
      ['bravo', `?tenantSlug=${context.bravo.slug}`, {}],
      ['sem seleção', '', {}],
      [
        'conflito',
        `?tenantSlug=${context.bravo.slug}`,
        tenantEdge(context.alfa.slug),
      ],
    ] as const)
      for (const host of hosts)
        expect(
          await publicLegal(host, 'return-policy', query, headers),
          name
        ).toEqual(expectedLegal.public(name))
    for (const host of hosts)
      expect((await adminLegal(host, 'return-policy')).text).toBe(
        expectedLegal.admin()
      )
    // O hash da auditoria é o do JSON canônico do documento validado.
    const [row] = await audits()
    const canonical = (value: unknown): string =>
      Array.isArray(value)
        ? '[' + value.map(canonical).join(',') + ']'
        : value !== null && typeof value === 'object'
          ? '{' +
            Object.keys(value)
              .sort()
              .map(
                (key) =>
                  JSON.stringify(key) +
                  ':' +
                  canonical((value as Record<string, unknown>)[key])
              )
              .join(',') +
            '}'
          : JSON.stringify(value)
    expect((row!.changes as Record<string, unknown>).sha256).toBe(
      createHash('sha256').update(canonical(documento)).digest('hex')
    )
  })
})
