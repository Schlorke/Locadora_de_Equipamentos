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
import { inflateSync } from 'node:zlib'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { createHttpClient } from '../../packages/frontend/src/shared/api/http-client'
import { createAdminQuoteDocumentsApi } from '../../packages/frontend/src/pages/orcamentos-admin/api/admin-documents'
import { createFinancialDocumentsApi } from '../../packages/frontend/src/pages/financeiro/api/documents'
import { alterSharedAcl } from '../helpers/shared-acl'
import { parityTargets } from './targets'

const context = inject('apiParity')
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const hosts = parityTargets(context)
const member = randomUUID()
const permissions = [randomUUID(), randomUUID()]
const quoteIds = [randomUUID(), randomUUID(), randomUUID()]
const paymentIds = [randomUUID(), randomUUID(), randomUUID()]
const rentalId = randomUUID()
const marker = 'PDF' + randomUUID().replaceAll('-', '')
const longText = Array.from(
  { length: 160 },
  (_, i) => 'justificativa' + i
).join(' ')
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[51]!,
}
let adminJar: string
let clientJar: string
let organizations: Array<{
  id: string
  document: string | null
  city: string | null
  state: string | null
}>
let settings: Array<{ id: string; publicBaseUrl: string | null }>
let clientMembership: { id: string; role: string; status: string }
const paths = (quoteId = quoteIds[0]!, paymentId = paymentIds[0]!) => [
  `/api/admin/quotes/${quoteId}/download`,
  `/api/quotes/${quoteId}/download`,
  `/api/admin/quotes/${quoteId}/adjustments/download`,
  `/api/admin/quotes/${quoteId}/pdf-oficio`,
  `/api/admin/financial/entries/${paymentId}/pdf-oficio`,
]
async function request(
  host: string,
  path: string,
  jar = adminJar,
  headers: Record<string, string> = {}
) {
  const response = await fetch(host + path, {
    headers: {
      ...edge,
      Cookie: jar,
      'x-tenant-id': context.alfa.id,
      ...headers,
    },
  })
  const bytes = Buffer.from(await response.arrayBuffer())
  return {
    status: response.status,
    bytes,
    body: response.headers.get('content-type')?.includes('application/json')
      ? JSON.parse(bytes.toString())
      : undefined,
    type: response.headers.get('content-type'),
    disposition: response.headers.get('content-disposition'),
    cache: response.headers.get('cache-control'),
    nosniff: response.headers.get('x-content-type-options'),
  }
}
// Decode only PDFKit's base-font text commands from its real compressed streams.
// This is not a general PDF parser or a visual/accessibility certification.
function textCommands(bytes: Buffer) {
  return [
    ...bytes
      .toString('latin1')
      .matchAll(/\bstream\r?\n([\s\S]*?)\r?\nendstream/g),
  ]
    .map((match) => {
      const content = inflateSync(Buffer.from(match[1]!, 'latin1')).toString(
        'latin1'
      )
      return [...content.matchAll(/<([a-f0-9]+)>/gi)]
        .map((word) => Buffer.from(word[1]!, 'hex').toString('latin1'))
        .join('')
    })
    .join('\n')
}
async function cleanup() {
  await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } })
  await prisma.rentals.deleteMany({ where: { id: rentalId } })
  await prisma.quoteAdjustment.deleteMany({
    where: { quoteId: { in: quoteIds } },
  })
  await prisma.quote.deleteMany({ where: { id: { in: quoteIds } } })
}
beforeAll(async () => {
  adminJar = await signInParityUser(context, edge, 1)
  clientJar = await signInParityUser(context, edge, 0)
  clientMembership = await prisma.membership.findUniqueOrThrow({
    where: {
      tenantId_userId: {
        tenantId: context.alfa.id,
        userId: context.identity.users[0]!.id,
      },
    },
  })
  organizations = await prisma.organization.findMany({
    where: { id: { in: [context.alfa.id, context.bravo.id] } },
    select: { id: true, document: true, city: true, state: true },
  })
  settings = await prisma.setting.findMany({
    where: { tenantId: { in: [context.alfa.id, context.bravo.id] } },
    select: { id: true, publicBaseUrl: true },
  })
  await prisma.membership.create({
    data: {
      id: member,
      tenantId: context.alfa.id,
      userId: context.identity.users[1]!.id,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })
})
beforeEach(async () => {
  await cleanup()
  await prisma.permission.deleteMany({ where: { id: { in: permissions } } })
  await prisma.membership.update({
    where: { id: member },
    data: { role: 'ADMIN', status: 'ACTIVE' },
  })
  await prisma.membership.update({
    where: { id: clientMembership.id },
    data: { role: 'CLIENT', status: 'ACTIVE' },
  })
  for (const tenant of [context.alfa, context.bravo]) {
    await prisma.organization.update({
      where: { id: tenant.id },
      data: {
        document: '12345678000100',
        city: 'Cidade-' + tenant.slug,
        state: 'SP',
      },
    })
    await prisma.setting.updateMany({
      where: { tenantId: tenant.id },
      data: { publicBaseUrl: `https://${tenant.slug}.platform.test` },
    })
  }
  for (let i = 0; i < 3; i++) {
    const tenant = i === 2 ? context.bravo : context.alfa
    await prisma.quote.create({
      data: {
        id: quoteIds[i]!,
        tenantId: tenant.id,
        userId: context.identity.users[i === 1 ? 1 : 0]!.id,
        quoteCode: marker + '-' + i,
        name: marker,
        email: 'pdf-fixture@example.test',
        phone: '',
        createdAt: new Date('2030-01-01'),
        startDate: new Date('2030-01-02'),
        endDate: new Date('2030-01-05'),
        status: 'APPROVED',
        total: '100.50',
        finalTotal: '110.50',
        originalTotal: '100.50',
        items: {
          create: {
            tenantId: tenant.id,
            equipmentId: tenant.equipmentIds[0]!,
            quantity: 1,
            days: 3,
            pricePerDay: '33.50',
            total: '100.50',
            startDate: new Date('2030-01-02'),
            endDate: new Date('2030-01-05'),
          },
        },
        adjustments: {
          create: {
            tenantId: tenant.id,
            createdBy: context.identity.users[1]!.id,
            category: 'OTHER',
            amount: '10',
            justification: longText,
            createdAt: new Date('2030-01-01'),
          },
        },
      },
    })
    await prisma.payment.create({
      data: {
        id: paymentIds[i]!,
        tenantId: tenant.id,
        quoteId: quoteIds[i],
        amount: '110.50',
        grossAmount: '110.50',
        status: 'PENDING',
        method: 'PIX',
        type: 'DEPOSIT',
        dueDate: new Date('2030-01-10'),
      },
    })
  }
})
afterAll(async () => {
  try {
    await cleanup()
    await prisma.permission.deleteMany({ where: { id: { in: permissions } } })
    await prisma.membership.deleteMany({ where: { id: member } })
    if (clientMembership)
      await prisma.membership.update({
        where: { id: clientMembership.id },
        data: {
          role: clientMembership.role as 'CLIENT',
          status: clientMembership.status as 'ACTIVE',
        },
      })
    for (const organization of organizations ?? [])
      await prisma.organization.update({
        where: { id: organization.id },
        data: {
          document: organization.document,
          city: organization.city,
          state: organization.state,
        },
      })
    for (const setting of settings ?? [])
      await prisma.setting.update({
        where: { id: setting.id },
        data: { publicBaseUrl: setting.publicBaseUrl },
      })
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
})
for (const host of hosts)
  describe(host, () => {
    it('wave66 consumer receives PDF bytes and refuses foreign tenant documents', async () => {
      const client = createHttpClient({
        baseUrl: host,
        getHeaders: () => ({
          ...edge,
          Cookie: adminJar,
          'x-tenant-id': context.alfa.id,
        }),
      })
      const quotes = createAdminQuoteDocumentsApi(client),
        finance = createFinancialDocumentsApi(client)
      for (const result of [
        await quotes.adjustments(quoteIds[0]!),
        await finance.oficio(paymentIds[0]!),
      ]) {
        expect(result.ok).toBe(true)
        expect(await result.blob.text()).toMatch(/^%PDF-/)
      }
      for (const result of [
        await quotes.adjustments(quoteIds[2]!),
        await finance.oficio(paymentIds[2]!),
      ]) {
        expect(result).toMatchObject({ ok: false, status: 404 })
        expect(await result.blob.text()).not.toContain('%PDF-')
      }
    })

    it.each([0, 1, 2, 3, 4])(
      'requires actual session on PDF endpoint %i',
      async (index) => {
        const result = await request(host, paths()[index]!, '')
        expect(result.status).toBe(401)
        expect(result.type).toContain('application/json')
        expect(result.disposition).toBeNull()
      }
    )
    it.each([0, 1, 2, 3, 4])(
      'hides foreign tenant IDs on PDF endpoint %i under RLS',
      async (index) => {
        const result = await request(
          host,
          paths(quoteIds[2], paymentIds[2])[index]!,
          index === 1 ? clientJar : adminJar
        )
        expect(result.status).toBe(404)
        expect(result.disposition).toBeNull()
      }
    )
    it.each([0, 1, 2, 3, 4])(
      'revalidates revoked membership on PDF endpoint %i',
      async (index) => {
        await prisma.membership.update({
          where: { id: index === 1 ? clientMembership.id : member },
          data: { status: 'REVOKED' },
        })
        expect(
          (
            await request(
              host,
              paths()[index]!,
              index === 1 ? clientJar : adminJar
            )
          ).status
        ).toBe(403)
      }
    )
    it.each([0, 2, 3, 4])(
      'requires exact current permission on administrative PDF %i',
      async (index) => {
        await prisma.membership.update({
          where: { id: member },
          data: { role: 'OPERATOR' },
        })
        expect((await request(host, paths()[index]!)).status).toBe(403)
        const module = index < 3 ? 'QUOTES' : 'FINANCIAL'
        await prisma.permission.create({
          data: {
            id: permissions[0]!,
            tenantId: context.bravo.id,
            role: 'OPERATOR',
            module,
            action: 'READ',
          },
        })
        expect((await request(host, paths()[index]!)).status).toBe(403)
        await prisma.permission.create({
          data: {
            id: permissions[1]!,
            tenantId: context.alfa.id,
            role: 'OPERATOR',
            module,
            action: 'WRITE',
          },
        })
        expect((await request(host, paths()[index]!)).status).toBe(403)
        await prisma.permission.update({
          where: { id: permissions[1] },
          data: { action: 'READ' },
        })
        expect((await request(host, paths()[index]!)).status).toBe(200)
        await prisma.permission.delete({ where: { id: permissions[1] } })
        expect((await request(host, paths()[index]!)).status).toBe(403)
      }
    )
    it('uses owner and soft deletion for client while admin keeps authorized history', async () => {
      expect(
        (await request(host, paths(quoteIds[1])[1]!, clientJar)).status
      ).toBe(404)
      await prisma.quote.update({
        where: { id: quoteIds[0] },
        data: { clientDeletedAt: new Date() },
      })
      expect((await request(host, paths()[1]!, clientJar)).status).toBe(404)
      expect((await request(host, paths()[0]!)).status).toBe(200)
    })
    it('returns neutral 404s for missing quote/history and 422 for an incomplete oficio', async () => {
      await prisma.quoteAdjustment.deleteMany({
        where: { quoteId: quoteIds[0] },
      })
      expect((await request(host, paths()[2]!)).body).toEqual({
        error: 'Nenhum reajuste encontrado para este orçamento',
      })
      const unknown = await request(host, paths(randomUUID())[0]!)
      expect(unknown.status).toBe(404)
      expect(unknown.body).toEqual({ error: 'Orçamento não encontrado' })
      await prisma.quote.update({
        where: { id: quoteIds[0] },
        data: {
          quoteCode: null,
          legacyExternalCode: null,
          finalTotal: 0,
          total: 0,
        },
      })
      const invalid = await request(host, paths()[3]!)
      expect(invalid.status).toBe(422)
      expect(invalid.body.details).toEqual([
        'Código do orçamento é obrigatório',
        'Valor bruto deve ser maior que zero',
      ])
    })
    it('requires organization and branding rather than falling back to legacy company', async () => {
      await prisma.organization.update({
        where: { id: context.alfa.id },
        data: { document: null },
      })
      const profile = await request(host, paths()[3]!)
      expect(profile.status).toBe(409)
      expect(profile.body.code).toBe('COMPANY_PROFILE_REQUIRED')
      await prisma.organization.update({
        where: { id: context.alfa.id },
        data: { document: '12345678000100' },
      })
      await prisma.setting.updateMany({
        where: { tenantId: context.alfa.id },
        data: { publicBaseUrl: null },
      })
      const brand = await request(host, paths()[4]!)
      expect(brand.status).toBe(409)
      expect(brand.body.code).toBe('EMAIL_BRANDING_NOT_CONFIGURED')
    })
    it('keeps the payment-linked rental fallback and refuses detached payment oficio', async () => {
      await prisma.rentals.create({
        data: {
          id: rentalId,
          tenantId: context.alfa.id,
          userid: context.identity.users[0]!.id,
          quoteId: quoteIds[0],
          status: 'PENDING',
          startdate: new Date('2030-01-02'),
          enddate: new Date('2030-01-05'),
          total: '110.50',
        },
      })
      await prisma.payment.update({
        where: { id: paymentIds[0] },
        data: { quoteId: null, rentalId },
      })
      expect((await request(host, paths()[4]!)).status).toBe(200)
      await prisma.payment.update({
        where: { id: paymentIds[0] },
        data: { rentalId: null },
      })
      const detached = await request(host, paths()[4]!)
      expect(detached.status).toBe(422)
      expect(detached.body.details).toContain(
        'Nome ou razão social do cliente é obrigatório'
      )
    })
    it('keeps attachment identifiers inert and clips them to the existing limit', async () => {
      await prisma.quote.update({
        where: { id: quoteIds[0] },
        data: { quoteCode: 'A/"\r\n' + 'x'.repeat(150) },
      })
      const pdf = await request(host, paths()[0]!)
      expect(pdf.status).toBe(200)
      expect(pdf.disposition).toBe(
        'attachment; filename="Orcamento-' +
          ('A____' + 'x'.repeat(150)).slice(0, 120) +
          '.pdf"'
      )
    })
  })
/** Nome do anexo e comandos de texto esperados de cada PDF, montados da fixture (onda 135, B2). */
const expectedPdf = {
  disposition(index: number): string {
    if (index < 2) return `attachment; filename="Orcamento-${marker}-0.pdf"`
    if (index === 2) return `attachment; filename="Reajuste-${marker}-0.pdf"`
    if (index === 3 || index === 4)
      return `inline; filename="oficio-${marker}-0-janeiro-2030.pdf"`
    throw new Error('Documento não especificado: ' + index)
  },
  commands(index: number): string[] {
    // Conteúdo de negócio esperado, independente de kerning, paginação e instante de emissão do PDFKit.
    if (index < 2)
      return [
        'alfa',
        '12345678000100',
        'ORÇAMENTO ' + marker + '-0',
        'Cliente: ' + marker,
        'E-mail: pdf-fixture@example.test',
        'Telefone:',
        'Emissão: 31/12/2029',
        'Período: 01/01/2030 a 04/01/2030',
        'EQUIPAMENTOS',
        'Betoneira alfa 00',
        '1 unidade(s)',
        '3 dia(s)',
        'diária R$ 33,50',
        'Total do item: R$ 100,50',
        'Valor original: R$ 100,50',
        'Valor total: R$ 110,50',
      ]
    if (index === 2)
      return [
        'alfa',
        '12345678000100',
        'OFÍCIO DE REAJUSTE DE ORÇAMENTO',
        'DADOS DO ORÇAMENTO',
        'Código do Orçamento: ' + marker + '-0',
        'Cliente: ' + marker,
        'E-mail: pdf-fixture@example.test',
        'VALORES',
        'Valor Original: R$ 100,50',
        'Valor Reajustado: R$ 110,50',
        'Diferença Total: R$ 10,00',
        'DETALHAMENTO DOS REAJUSTES',
        'Categoria',
        'Valor',
        'Justificativa',
        'Data',
        'Outro',
        'R$ 10,00',
        new Date('2030-01-01').toLocaleDateString('pt-BR'),
        'Documento gerado em',
      ]
    if (index === 3 || index === 4)
      return [
        'RELATÓRIO DE FATURAMENTO',
        'alfa',
        'CNPJ: 12.345.678/0001-00',
        'DADOS DO CLIENTE',
        marker + '-0',
        marker,
        'DOC:',
        '(CPF)',
        'janeiro / 2030',
        'pdf-fixture@example.test',
        'Pagamento Antecipado',
        'Fixture private street, 1, Fixture neighborhood, Fixture city/SP, CEP 01001000',
        'LOCAÇÃO',
        'Betoneira alfa 00',
        'Qt.',
        'Dias',
        'R$ 100,50',
        'Aprovado',
        'SERVIÇOS',
        'Outros',
        'R$ 10,00',
        'RESUMO FINANCEIRO',
        'Bruto',
        'R$ 110,50',
        'Locação',
        'Serviços',
        'LÍQUIDO',
        'R$ 103,87',
        'Cidade-' + context.alfa.slug + '/SP',
        'Gerado em:',
        'Página 1/1',
      ]
    throw new Error('Documento não especificado: ' + index)
  },
}
describe('production PDF contracts on both HTTP hosts', () => {
  it.each([0, 1, 2, 3, 4])(
    'serves PDF %i with explicit document values and exact attachment headers',
    async (index) => {
      const results = []
      for (const host of hosts)
        results.push(
          await request(
            host,
            paths()[index]!,
            index === 1 ? clientJar : adminJar
          )
        )
      for (const result of results) {
        expect(result.status).toBe(200)
        expect(result.type).toBe('application/pdf')
        expect(result.cache).toBe('no-store')
        expect(result.bytes.subarray(0, 5).toString()).toBe('%PDF-')
        expect(result.bytes.toString('latin1')).toContain('(alfa)')
        expect(result.bytes.toString('latin1')).not.toContain('GB Loca')
        const commands = textCommands(result.bytes)
        expect(commands).toContain(marker)
        expect(commands).not.toContain('Cidade-' + context.bravo.slug)
        if (index >= 2) expect(commands).toContain('justificativa0')
        if (index === 2) expect(commands).toContain('justificativa159')
        if (index < 3) expect(result.nosniff).toBe('nosniff')
        // Contrato explícito de cada PDF (onda 135, B2): o nome do anexo e o texto da página montados da fixture.
        expect(result.disposition).toBe(expectedPdf.disposition(index))
        const compact = (text: string) => text.replace(/\s/g, '')
        for (const text of expectedPdf.commands(index))
          expect(compact(commands)).toContain(compact(text))
        if (index === 2)
          expect(commands.match(/justificativa\d+/g)).toEqual(
            Array.from({ length: 160 }, (_, word) => 'justificativa' + word)
          )
      }
    }
  )
  it('does not mutate money, status, payments, adjustments or outbox while generating all PDFs', async () => {
    const snapshot = async () => ({
      quotes: await prisma.quote.findMany({
        where: { id: { in: quoteIds } },
        orderBy: { id: 'asc' },
      }),
      payments: await prisma.payment.findMany({
        where: { id: { in: paymentIds } },
        orderBy: { id: 'asc' },
      }),
      adjustments: await prisma.quoteAdjustment.findMany({
        where: { quoteId: { in: quoteIds } },
        orderBy: { id: 'asc' },
      }),
      events: await prisma.outboxEvent.findMany({
        where: { aggregateId: { in: [...quoteIds, ...paymentIds] } },
      }),
    })
    const before = await snapshot()
    for (const host of hosts)
      for (const [index, path] of paths().entries())
        expect(
          (await request(host, path, index === 1 ? clientJar : adminJar)).status
        ).toBe(200)
    expect(await snapshot()).toEqual(before)
  })
  it('keeps unexpected database failures generic across all five routes and restores the temporary grant', async () => {
    const role = new URL(context.runtimeUrl).searchParams
      .get('options')!
      .slice('-c role='.length)
    if (!/^api_parity_[a-f0-9]{12}$/.test(role))
      throw new Error('Unexpected temporary role')
    await alterSharedAcl(pool, `REVOKE SELECT ON quotes FROM ${role}`)
    try {
      for (const host of hosts)
        for (const [index, path] of paths().entries()) {
          const response = await request(
            host,
            path,
            index === 1 ? clientJar : adminJar
          )
          expect(response.status).toBe(500)
          expect(response.body).toEqual({
            error:
              index < 3
                ? 'Não foi possível gerar o documento do orçamento'
                : 'Erro ao gerar PDF do ofício',
          })
        }
    } finally {
      await alterSharedAcl(pool, `GRANT SELECT ON quotes TO ${role}`)
    }
    expect((await request(context.api, paths()[0]!)).status).toBe(200)
  })
  it.each([0, 1, 2, 3, 4])(
    'preserves automatic HEAD and OPTIONS on endpoint %i',
    async (index) => {
      for (const host of hosts) {
        const headers = {
          ...edge,
          Cookie: index === 1 ? clientJar : adminJar,
          'x-tenant-id': context.alfa.id,
        }
        const head = await fetch(host + paths()[index]!, {
          method: 'HEAD',
          headers,
        })
        expect(head.status).toBe(200)
        expect(head.headers.get('content-type')).toBe('application/pdf')
        expect((await head.arrayBuffer()).byteLength).toBe(0)
        const options = await fetch(host + paths()[index]!, {
          method: 'OPTIONS',
          headers,
        })
        expect(options.status).toBe(204)
        expect(options.headers.get('allow')?.split(', ').sort()).toEqual([
          'GET',
          'HEAD',
          'OPTIONS',
        ])
      }
    }
  )
})
