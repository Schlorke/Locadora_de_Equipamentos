import { createHttpClient } from '../../packages/frontend/src/shared/api/http-client'
import { createFinancialApi } from '../../packages/frontend/src/pages/financeiro/api/financial'
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
import ExcelJS from 'exceljs'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { alterSharedAcl } from '../helpers/shared-acl'
import { parityTargets } from './targets'

const context = inject('apiParity'),
  hosts = parityTargets(context)
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const member = randomUUID(),
  permission = randomUUID(),
  rental = randomUUID(),
  setting = randomUUID()
const quotes = Array.from({ length: 7 }, () => randomUUID()),
  payments = Array.from({ length: 8 }, () => randomUUID())
const marker = 'FIN' + randomUUID().replaceAll('-', ''),
  profileName = 'Cliente Alfa ' + marker
const names = ['aging', 'calendar', 'entries', 'revenue', 'settings', 'export']
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[52]!,
}
let jar: string
const dueDates: Date[] = []
let profile: {
  id: string
  name: string
  email: string | null
  document: string | null
  company: string | null
}
const path = (name: string, query = '') =>
  '/api/admin/financial/' +
  name +
  (name === 'export' && !query ? '?format=csv' : query)
async function request(
  host: string,
  name: string,
  query = '',
  cookie = jar,
  tenant = context.alfa.id
) {
  const r = await fetch(host + path(name, query), {
    headers: { ...edge, Cookie: cookie, 'x-tenant-id': tenant },
  })
  const bytes = Buffer.from(await r.arrayBuffer())
  return {
    status: r.status,
    bytes,
    body: r.headers.get('content-type')?.includes('application/json')
      ? JSON.parse(bytes.toString())
      : undefined,
    type: r.headers.get('content-type'),
    cache: r.headers.get('cache-control'),
    disposition: r.headers.get('content-disposition'),
  }
}
async function cleanup() {
  await prisma.payment.deleteMany({ where: { id: { in: payments } } })
  await prisma.rentals.deleteMany({ where: { id: rental } })
  await prisma.quote.deleteMany({ where: { id: { in: quotes } } })
  await prisma.financialSetting.deleteMany({ where: { id: setting } })
}
beforeAll(async () => {
  jar = await signInParityUser(context, edge, 1)
  profile = await prisma.clientProfile.create({
    data: {
      tenantId: context.alfa.id,
      userId: context.identity.users[0]!.id,
      name: profileName,
      document: '12345678000100',
      company: 'Empresa ' + marker,
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
})
beforeEach(async () => {
  await cleanup()
  await prisma.permission.deleteMany({ where: { id: permission } })
  await prisma.membership.update({
    where: { id: member },
    data: { role: 'ADMIN', status: 'ACTIVE' },
  })
  const amounts = [
    '100.50',
    '25.10',
    '30.25',
    '10.00',
    '999.00',
    '888.00',
    '777.00',
    '900.00',
  ]
  for (let i = 0; i < 7; i++)
    await prisma.quote.create({
      data: {
        id: quotes[i]!,
        tenantId: i === 6 ? context.bravo.id : context.alfa.id,
        userId: context.identity.users[0]!.id,
        quoteCode: marker + '-' + i,
        name: 'Snapshot ' + marker,
        email: 'snapshot@example.test',
        phone: '',
        total: amounts[i]!,
      },
    })
  await prisma.rentals.create({
    data: {
      id: rental,
      tenantId: context.alfa.id,
      userid: context.identity.users[0]!.id,
      quoteId: quotes[1],
      total: '25.10',
      status: 'ACTIVE',
      startdate: new Date('2030-01-01'),
      enddate: new Date('2030-01-10'),
    },
  })
  const fixtureClock = Date.now()
  for (let i = 0; i < 8; i++) {
    // Meio dia de folga evita que Math.ceil mude o número de dias no instante da gravação.
    const due = new Date(
      fixtureClock +
        86400000 * (i === 2 ? 30.5 : i === 1 ? -34.5 : -9.5) +
        i * 1000
    )
    dueDates[i] = due
    await prisma.payment.create({
      data: {
        id: payments[i]!,
        tenantId: i === 7 ? context.bravo.id : context.alfa.id,
        quoteId: i === 1 || i === 6 ? null : quotes[i === 7 ? 6 : i],
        rentalId: i === 1 ? rental : null,
        amount: amounts[i]!,
        grossAmount: i === 1 ? null : amounts[i]!,
        netAmount: i === 0 ? '94.47' : null,
        method: i === 4 ? 'PIX' : 'BOLETO',
        type: i === 5 ? 'FINE' : 'DEPOSIT',
        billingStatus:
          i === 0
            ? 'PAID'
            : i === 1
              ? 'UNPAID'
              : i === 3
                ? 'SETTLED'
                : 'AWAITING_PAYMENT',
        status: i === 0 ? 'PAID' : 'PENDING',
        paidAt: i === 0 ? new Date('2030-01-15T12:00:00Z') : null,
        dueDate: due,
        taxRate: i === 0 ? '6' : null,
        taxDocumentType: i === 0 ? 'CPF' : null,
        invoiceNumber: i === 0 ? 'NF-' + marker : null,
      },
    })
  }
  await prisma.financialSetting.create({
    data: {
      id: setting,
      tenantId: context.alfa.id,
      cpfRate: '7',
      cnpjRate: '2.5',
      cniRate: '9',
      issRate: '3',
      updatedBy: context.identity.users[1]!.id,
      updatedAt: new Date('2035-01-01'),
    },
  })
})
afterAll(async () => {
  try {
    await cleanup()
    await prisma.permission.deleteMany({ where: { id: permission } })
    await prisma.membership.deleteMany({ where: { id: member } })
    if (profile)
      await prisma.clientProfile.deleteMany({ where: { id: profile.id } })
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
})
for (const host of hosts)
  describe(host, () => {
    it('consumidor financeiro preserva leituras, filtros e bytes da exportação em cada host', async () => {
      const api = createFinancialApi(
        createHttpClient({
          baseUrl: host,
          getHeaders: () => ({
            ...edge,
            Cookie: jar,
            'x-tenant-id': context.alfa.id,
          }),
        })
      )
      const query = new URLSearchParams({
        search: profileName,
        status: 'UNPAID',
        limit: '10000',
      }).toString()
      const listed = await api.entries(query)
      expect(listed.status).toBe(200)
      expect(listed.data.entries?.map((entry) => entry.id)).toEqual([
        payments[1],
      ])
      expect((await api.calendar('')).ok).toBe(true)
      expect((await api.revenue('')).ok).toBe(true)
      expect((await api.aging('')).ok).toBe(true)
      expect((await api.settings()).ok).toBe(true)
      const file = await api.exportFile(
        new URLSearchParams({
          format: 'csv',
          ids: payments[1]! + ',' + payments[7]!,
        }).toString()
      )
      expect(file.status).toBe(200)
      const csv = await file.blob.text()
      expect(csv).toContain(profileName)
      expect(csv).not.toContain('900')
    })
    it.each(names)('requires a real session on %s', async (name) =>
      expect((await request(host, name, '', '')).status).toBe(401)
    )
    it.each(names)('revalidates revoked membership on %s', async (name) => {
      await prisma.membership.update({
        where: { id: member },
        data: { status: 'REVOKED' },
      })
      expect((await request(host, name)).status).toBe(403)
    })
    it.each(names)(
      'requires the exact financial READ permission on %s',
      async (name) => {
        await prisma.membership.update({
          where: { id: member },
          data: { role: 'OPERATOR' },
        })
        expect((await request(host, name)).status).toBe(403)
        await prisma.permission.create({
          data: {
            id: permission,
            tenantId: context.alfa.id,
            role: 'OPERATOR',
            module: 'FINANCIAL',
            action: 'WRITE',
          },
        })
        expect((await request(host, name)).status).toBe(403)
        await prisma.permission.update({
          where: { id: permission },
          data: { action: 'READ' },
        })
        expect((await request(host, name)).status).toBe(200)
      }
    )
    it.each(names)(
      'requires explicit company selection on %s',
      async (name) => {
        const r = await fetch(host + path(name), {
          headers: { ...edge, Cookie: jar },
        })
        expect(r.status).toBe(409)
      }
    )
    it('keeps profile, rental fallback, tax snapshots, scope and pagination', async () => {
      const r = await request(host, 'entries')
      expect(r.status).toBe(200)
      expect(r.body.entries.map((e: { id: string }) => e.id).sort()).toEqual(
        payments.slice(0, 4).sort()
      )
      expect(
        r.body.entries.find((e: { id: string }) => e.id === payments[1])
      ).toMatchObject({
        quoteId: quotes[1],
        rentalId: rental,
        customerName: profileName,
        customerCompany: 'Empresa ' + marker,
        grossAmount: 25.1,
        netAmount: 24.47,
        taxRate: 2.5,
      })
      expect(
        r.body.entries.find((e: { id: string }) => e.id === payments[0])
      ).toMatchObject({
        taxRate: 6,
        taxDocumentType: 'CPF',
        grossAmount: 100.5,
        netAmount: 94.47,
        invoiceNumber: 'NF-' + marker,
      })
      // Existing aggregate chooses sum(grossAmount) if non-null, even when one row lacks it.
      expect(r.body.totals).toMatchObject({
        count: 4,
        gross: 140.75,
        net: 94.47,
        paid: 100.5,
        unpaid: 25.1,
        awaiting: 30.25,
      })
      expect(r.body.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 4,
        totalPages: 1,
      })
      const limited = await request(host, 'entries', '?limit=1&page=2')
      expect(limited.body.entries).toHaveLength(1)
      expect(limited.body.pagination).toEqual({
        page: 2,
        limit: 1,
        total: 4,
        totalPages: 4,
      })
      expect(limited.body.totals).toEqual(r.body.totals)
    })
    it('preserves search and invalid status/date behavior and excludes foreign IDs', async () => {
      const filtered = await request(
        host,
        'entries',
        '?search=' + encodeURIComponent(profileName) + '&status=%20unpaid%20'
      )
      expect(filtered.body.entries.map((e: { id: string }) => e.id)).toEqual([
        payments[1],
      ])
      const invalid = await request(
        host,
        'entries',
        '?status=invalid&startDate=invalid'
      )
      expect(invalid.body.pagination.total).toBe(4)
      const csv = await request(
        host,
        'export',
        '?format=csv&ids=' + payments[7]
      )
      expect(csv.status).toBe(200)
      expect(csv.bytes.toString()).not.toContain(profileName)
      const bounds = await request(
        host,
        'entries',
        '?startDate=2000-01-01&endDate=2000-02-01'
      )
      expect(bounds.body.entries).toEqual([])
    })
    it('keeps calendar colors, paidAt fallback and distinct start/end date aliases', async () => {
      const r = await request(host, 'calendar')
      expect(r.body.events).toHaveLength(4)
      expect(
        r.body.events
          .map((e: { status: string; color: string }) => [e.status, e.color])
          .sort()
      ).toEqual(
        [
          ['PAID', '#16a34a'],
          ['UNPAID', '#dc2626'],
          ['SETTLED', '#475569'],
          ['AWAITING_PAYMENT', '#f59e0b'],
        ].sort()
      )
      expect(
        r.body.events.find((e: { id: string }) => e.id === payments[0]).start
      ).toBe('2030-01-15T12:00:00.000Z')
      expect(
        (await request(host, 'calendar', '?start=2000-01-01&end=2000-02-01'))
          .body.events
      ).toEqual([])
    })
    it('keeps overdue bucket boundaries, received revenue and current settings', async () => {
      const a = await request(host, 'aging')
      expect(a.body.agingData.map((b: { count: number }) => b.count)).toEqual([
        1, 0, 1, 0, 0,
      ])
      expect(a.body.topDebtors[0]).toMatchObject({
        clientName: profileName,
        overdueAmount: 25.1,
      })
      expect(a.body.delinquencyRate).toBe(45.3)
      expect(
        (await request(host, 'aging', '?status=PAID')).body.topDebtors
      ).toEqual([])
      const r = await request(
        host,
        'revenue',
        '?startDate=2030-01-01&endDate=2030-02-01'
      )
      expect(r.body.revenueHistory).toEqual([
        {
          month: new Intl.DateTimeFormat('pt-BR', {
            month: 'short',
            year: 'numeric',
          }).format(new Date('2030-01-15T12:00:00Z')),
          revenue: 100.5,
        },
      ])
      expect(r.body.revenueByCategory).toEqual([
        { categoryName: 'Sem categoria', revenue: 100.5 },
      ])
      const st = await request(host, 'settings')
      expect(st.body.settings).toMatchObject({
        id: setting,
        cpfRate: 7,
        cnpjRate: 2.5,
        cniRate: 9,
        issRate: 3,
        updatedBy: context.identity.users[1]!.id,
      })
    })
    it('returns actual Excel worksheets, styles, numbers and tenant identity', async () => {
      const r = await request(host, 'export', '?format=xlsx&ids=' + payments[0])
      expect(r.status).toBe(200)
      expect(r.type).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      expect(r.cache).toBe('no-store')
      const book = new ExcelJS.Workbook()
      await book.xlsx.load(new Uint8Array(r.bytes).buffer)
      expect(book.creator).toBe('alfa')
      expect(book.worksheets.map((s) => s.name)).toEqual([
        'Resumo Executivo',
        'Lançamentos Detalhados',
        'Contas a Receber',
        'Análise Tributária',
      ])
      expect(book.worksheets[0]!.getCell('A1').value).toBe(
        'alfa — Relatório Financeiro'
      )
      expect(book.worksheets[0]!.getCell('A4').value).toBe(100.5)
      expect(book.worksheets[0]!.getCell('B4').value).toBe(94.47)
      expect(book.worksheets[0]!.getCell('A1').font.size).toBe(18)
      expect(book.worksheets[0]!.getCell('A1').fill).toMatchObject({
        fgColor: { argb: 'FFF97316' },
      })
      for (const sheet of book.worksheets) {
        expect(sheet.pageSetup.orientation).toBe('landscape')
        expect(sheet.views[0]!.showGridLines).toBe(false)
      }
      const text = JSON.stringify(book.model)
      expect(text).toContain(profileName)
      expect(text).not.toContain('Snapshot ' + marker)
      expect(text).not.toContain(quotes[6])
    })
    it.each(names)(
      'preserves automatic HEAD and supported OPTIONS on %s',
      async (name) => {
        const headers = { ...edge, Cookie: jar, 'x-tenant-id': context.alfa.id }
        const head = await fetch(host + path(name), { method: 'HEAD', headers })
        expect(head.status).toBe(200)
        expect((await head.arrayBuffer()).byteLength).toBe(0)
        const options = await fetch(host + path(name), {
          method: 'OPTIONS',
          headers,
        })
        expect(options.status).toBe(204)
        const methods = options.headers.get('allow')!.split(', ').sort()
        expect(methods).toEqual(
          name === 'settings'
            ? ['GET', 'HEAD', 'OPTIONS', 'PATCH']
            : ['GET', 'HEAD', 'OPTIONS']
        )
      }
    )
  })
function pdfStreams(bytes: Buffer) {
  return [
    ...bytes
      .toString('latin1')
      .matchAll(/\bstream\r?\n([\s\S]*?)\r?\nendstream/g),
  ].map((m) => inflateSync(Buffer.from(m[1]!, 'latin1')).toString('latin1'))
}
/** Contrato completo esperado de cada leitura financeira, montado da fixture deste arquivo (onda 135, B2). */
const expectedFinancial = {
  reply(name: string): unknown {
    const order = [1, 0, 3, 2]
    const entries = order.map((index) => ({
      id: payments[index],
      paymentId: payments[index],
      rentalId: index === 1 ? rental : null,
      quoteId: quotes[index],
      quoteCode: marker + '-' + index,
      legacyExternalCode: null,
      customerName: profileName,
      customerEmail: 'snapshot@example.test',
      customerDocument: '12345678000100',
      customerCompany: 'Empresa ' + marker,
      grossAmount: [100.5, 25.1, 30.25, 10][index],
      netAmount: [94.47, 24.47, 29.49, 9.75][index],
      taxRate: index === 0 ? 6 : 2.5,
      taxDocumentType: index === 0 ? 'CPF' : 'CNPJ',
      invoiceNumber: index === 0 ? 'NF-' + marker : null,
      boletoIssuedAt: null,
      invoiceIssuedAt: null,
      dueDate: dueDates[index]!.toISOString(),
      paidAt: index === 0 ? '2030-01-15T12:00:00.000Z' : null,
      settledAt: null,
      billingStatus: ['PAID', 'UNPAID', 'AWAITING_PAYMENT', 'SETTLED'][index],
      gatewayStatus: index === 0 ? 'PAID' : 'PENDING',
      transactionId: null,
      metadata: null,
      operationType: null,
      rentalAmount: null,
      serviceAmount: null,
      taxRegimeSnapshot: null,
      issAmount: null,
      irpjAmount: null,
      csllAmount: null,
      pisCofinsAmount: null,
      simplesAmount: null,
      taxBreakdown: null,
    }))
    const bodies: Record<string, unknown> = {
      aging: {
        agingData: [
          { range: 'A vencer', amount: 30.25, count: 1, status: 'current' },
          { range: '1-30', amount: 0, count: 0, status: 'slight' },
          { range: '31-60', amount: 25.1, count: 1, status: 'moderate' },
          { range: '61-90', amount: 0, count: 0, status: 'severe' },
          { range: '+90', amount: 0, count: 0, status: 'critical' },
        ],
        topDebtors: [
          {
            clientName: profileName,
            overdueAmount: 25.1,
            daysOverdue: 35,
            status: 'overdue',
          },
        ],
        delinquencyRate: 45.3,
        severeCount: 0,
      },
      calendar: {
        events: order.map((index) => ({
          id: payments[index],
          title: marker + '-' + index + ' - ' + profileName,
          start:
            index === 0
              ? '2030-01-15T12:00:00.000Z'
              : dueDates[index]!.toISOString(),
          end:
            index === 0
              ? '2030-01-15T12:00:00.000Z'
              : dueDates[index]!.toISOString(),
          status: ['PAID', 'UNPAID', 'AWAITING_PAYMENT', 'SETTLED'][index],
          amount: [100.5, 25.1, 30.25, 10][index],
          rentalId: index === 1 ? rental : null,
          quoteId: quotes[index],
          quoteCode: marker + '-' + index,
          legacyExternalCode: null,
          customerName: profileName,
          color: ['#16a34a', '#dc2626', '#f59e0b', '#475569'][index],
        })),
      },
      entries: {
        entries,
        pagination: { page: 1, limit: 50, total: 4, totalPages: 1 },
        // Compatibilidade atual: a soma de grossAmount não inclui o fallback da linha 1.
        totals: {
          gross: 140.75,
          net: 94.47,
          paid: 100.5,
          paidNet: 94.47,
          paidCount: 1,
          unpaid: 25.1,
          unpaidCount: 1,
          awaiting: 30.25,
          awaitingCount: 1,
          count: 4,
        },
      },
      revenue: {
        revenueHistory: [
          {
            month: new Intl.DateTimeFormat('pt-BR', {
              month: 'short',
              year: 'numeric',
            }).format(new Date('2030-01-15T12:00:00Z')),
            revenue: 100.5,
          },
        ],
        revenueByCategory: [{ categoryName: 'Sem categoria', revenue: 100.5 }],
      },
      settings: {
        settings: {
          id: setting,
          cpfRate: 7,
          cnpjRate: 2.5,
          cniRate: 9,
          taxRegime: 'SIMPLES_NACIONAL',
          issRate: 3,
          issExemptRental: true,
          irpjPresumidoRate: null,
          csllPresumidoRate: null,
          pisCofinsRate: null,
          simplesAnexo: 'III',
          simplesAliquota: null,
          ibsCbsRate: null,
          ibsCbsActive: false,
          updatedAt: '2035-01-01T00:00:00.000Z',
          updatedBy: context.identity.users[1]!.id,
        },
      },
    }
    if (name !== 'export' && !(name in bodies))
      throw new Error('Leitura financeira não especificada: ' + name)
    return {
      status: 200,
      type: name === 'export' ? 'text/csv; charset=utf-8' : 'application/json',
      cache: name === 'export' ? 'no-store' : null,
      disposition:
        name === 'export'
          ? 'attachment; filename="relatorio-financeiro.csv"'
          : null,
      body: bodies[name],
    }
  },
  csv(): string {
    const row = (
      index: number,
      gross: string,
      net: string,
      rate: string,
      status: string
    ) =>
      [
        marker + '-' + index,
        '-',
        profileName,
        'Empresa ' + marker,
        '12345678000100',
        gross,
        net,
        rate,
        index === 0 ? 'NF-' + marker : '-',
        '-',
        '-',
        dueDates[index]!.toLocaleDateString('pt-BR'),
        index === 0
          ? new Date('2030-01-15T12:00:00Z').toLocaleDateString('pt-BR')
          : '-',
        status,
      ].join(';')
    return (
      '\ufeff' +
      [
        'Código;Cód. Legado;Cliente;Empresa;CNPJ/CPF;Valor Bruto;Valor Líquido;Alíquota %;Nº Nota;Data Boleto;Data NF;Vencimento;Pagamento;Status',
        row(1, '25,10', '24,47', '2,50', 'Não Pago'),
        row(0, '100,50', '94,47', '6,00', 'Pago'),
        row(3, '10,00', '9,75', '2,50', 'Liquidado'),
        row(2, '30,25', '29,49', '2,50', 'Aguardando'),
      ].join('\r\n')
    )
  },
}
describe('both production HTTP hosts', () => {
  it.each(names)(
    'preserves the full explicit JSON/CSV contract on every host for %s',
    async (name) => {
      for (const host of hosts) {
        const r = await request(host, name)
        expect({
          status: r.status,
          type: r.type,
          cache: r.cache,
          disposition: r.disposition,
          body: r.body,
        }).toEqual(expectedFinancial.reply(name))
        if (name === 'export') {
          expect(r.bytes.toString()).toBe(expectedFinancial.csv())
          expect(r.bytes.toString()).toContain(profileName)
          expect(r.bytes.toString()).not.toContain('Snapshot ' + marker)
        }
      }
    }
  )
  it('returns real PDF content and exact attachment contract from each host', async () => {
    for (const host of hosts) {
      const r = await request(host, 'export', '?format=pdf&ids=' + payments[0])
      expect(r.status).toBe(200)
      expect(r.type).toBe('application/pdf')
      expect(r.cache).toBe('no-store')
      expect(r.disposition).toBe(
        'attachment; filename="relatorio-financeiro-oficio.pdf"'
      )
      expect(r.bytes.subarray(0, 5).toString()).toBe('%PDF-')
      const streams = pdfStreams(r.bytes).join('\n')
      const text = [...streams.matchAll(/<([a-f0-9]+)>/gi)]
        .map((m) => Buffer.from(m[1]!, 'hex').toString('latin1'))
        .join('')
      expect(text).toContain('alfa')
      expect(text).toContain(marker.slice(0, 18))
      expect(text).not.toContain('bravo')
      expect(streams).toContain('/F')
      expect(streams).toContain(
        '0.10196078431372549 0.33725490196078434 0.8588235294117647'
      )
    }
  })
  it('keeps all reads free of payment, quote, outbox and configuration writes', async () => {
    const snapshot = async () => ({
      payments: await prisma.payment.findMany({
        where: { id: { in: payments } },
        orderBy: { id: 'asc' },
      }),
      quotes: await prisma.quote.findMany({
        where: { id: { in: quotes } },
        orderBy: { id: 'asc' },
      }),
      settings: await prisma.financialSetting.findMany({
        where: { id: setting },
      }),
      events: await prisma.outboxEvent.findMany({
        where: { aggregateId: { in: [...payments, ...quotes] } },
      }),
    })
    const before = await snapshot()
    for (const host of hosts)
      for (const name of names)
        expect((await request(host, name)).status).toBe(200)
    expect(await snapshot()).toEqual(before)
  })
  it('keeps SQL failures generic and restores the temporary grant', async () => {
    const role = new URL(context.runtimeUrl).searchParams
      .get('options')!
      .slice('-c role='.length)
    if (!/^api_parity_[a-f0-9]{12}$/.test(role))
      throw Error('Unexpected parity role')
    await alterSharedAcl(
      pool,
      'REVOKE SELECT ON payments, financial_settings FROM ' + role
    )
    try {
      for (const host of hosts)
        for (const name of names) {
          const r = await request(host, name)
          expect(r.status).toBe(500)
          expect(r.body.error).toBeTruthy()
          expect(JSON.stringify(r.body)).not.toMatch(
            /SELECT|permission denied|api_parity|password/
          )
        }
    } finally {
      await alterSharedAcl(
        pool,
        'GRANT SELECT ON payments, financial_settings TO ' + role
      )
    }
    expect((await request(context.api, 'entries')).status).toBe(200)
  })
})
