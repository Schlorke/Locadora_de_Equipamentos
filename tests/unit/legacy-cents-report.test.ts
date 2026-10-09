import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { Pool, PoolClient } from 'pg'
import {
  LEGACY_CENTS_ORIGINS,
  collectLegacyCentsReport,
  formatLegacyCentsReport,
  parseLegacyCentsArgs,
  type LegacyCentsReport,
  type ReportClient,
} from '../../scripts/ops/legacy-cents-report'

describe('legacy cents report arguments', () => {
  const env = { DATABASE_URL: 'postgresql://reader@127.0.0.1:5432/locadora' }
  it('needs an explicit DATABASE_URL and never reads dotenv files', () => {
    expect(() => parseLegacyCentsArgs([], {})).toThrow(
      'DATABASE_URL explícita é obrigatória'
    )
    expect(parseLegacyCentsArgs([], env)).toEqual({
      connectionString: env.DATABASE_URL,
      format: 'text',
    })
  })
  it('accepts one tenant and a format, and refuses anything else (there is no apply mode)', () => {
    expect(
      parseLegacyCentsArgs(['--tenant-id', 'tenant-a', '--format=csv'], env)
    ).toEqual({
      connectionString: env.DATABASE_URL,
      tenantId: 'tenant-a',
      format: 'csv',
    })
    expect(() => parseLegacyCentsArgs(['--apply'], env)).toThrow(
      'Argumento desconhecido'
    )
    expect(() => parseLegacyCentsArgs(['--format=xlsx'], env)).toThrow(
      '--format'
    )
    expect(() =>
      parseLegacyCentsArgs(['--tenant-id', '--format=csv'], env)
    ).toThrow('--tenant-id')
  })
})

describe('legacy cents report formats', () => {
  const report: LegacyCentsReport = {
    generatedAt: '2026-09-29T00:00:00.000Z',
    tenants: [
      {
        tenantId: 't1',
        slug: 'locadora-a',
        name: 'Locadora A',
        rows: [
          {
            origin: 'payments.amount',
            id: 'p1',
            value: '10.005',
            cents: '10.01',
            difference: '0.005',
            status: 'PENDING',
            reference: 'quote:q1',
          },
        ],
      },
    ],
  }
  it('csv has a header and one line per value with its tenant', () => {
    expect(formatLegacyCentsReport(report, 'csv')).toBe(
      'tenantId,slug,origin,id,value,cents,difference,status,reference\n' +
        't1,locadora-a,payments.amount,p1,10.005,10.01,0.005,PENDING,quote:q1\n'
    )
  })
  it('text groups by tenant and states that nothing changed; json round-trips', () => {
    const text = formatLegacyCentsReport(report, 'text')
    expect(text).toContain('Locadora locadora-a (t1) — 1 linha(s)')
    expect(text).toContain(
      'payments.amount  id=p1  valor=10.005  centavos=10.01  diferença=0.005  status=PENDING  obrigação=quote:q1'
    )
    expect(text).toContain('Nada foi alterado.')
    expect(JSON.parse(formatLegacyCentsReport(report, 'json'))).toEqual(report)
  })
})

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'legacy cents report over a disposable PostgreSQL',
  () => {
    const tenantA = 'cents-a-' + randomUUID()
    const tenantB = 'cents-b-' + randomUUID()
    const userId = 'cents-user-' + randomUUID()
    const FRACTIONAL = '128.571428571428580000000000000'
    /** O relatório mostra o valor exato sem os zeros à direita da coluna. */
    const EXACT = '128.57142857142858'
    let pool: Pool
    /** Conexões só do relatório: uma falha dele nunca contamina a limpeza das fixtures. */
    let reportPool: Pool
    let prisma: PrismaClient
    const ids = {} as Record<
      | 'quote'
      | 'pending'
      | 'halfUp'
      | 'cents'
      | 'attempt'
      | 'adjustment'
      | 'rental'
      | 'foreign',
      string
    >

    beforeAll(async () => {
      const { requireTestDatabase } = await import('../helpers/test-database')
      const connectionString = requireTestDatabase(process.env)
      const { Pool: PgPool } = await import('pg')
      const { PrismaPg } = await import('@prisma/adapter-pg')
      const { PrismaClient: Client } = await import('@prisma/client')
      pool = new PgPool({ connectionString, max: 4 })
      reportPool = new PgPool({ connectionString, max: 2 })
      prisma = new Client({ adapter: new PrismaPg(pool) })
      await prisma.organization.createMany({
        data: [
          { id: tenantA, slug: tenantA, name: 'Cents A' },
          { id: tenantB, slug: tenantB, name: 'Cents B' },
        ],
      })
      await prisma.user.create({
        data: {
          id: userId,
          email: userId + '@example.test',
          name: 'Cents fixture',
        },
      })
      const quote = await prisma.quote.create({
        data: {
          tenantId: tenantA,
          name: 'Fixture',
          email: 'fixture@example.test',
          phone: '00000000000',
          total: FRACTIONAL,
          finalTotal: '142.86',
          lateFee: '7.7142',
          status: 'APPROVED',
        },
      })
      ids.quote = quote.id
      ids.pending = (
        await prisma.payment.create({
          data: {
            tenantId: tenantA,
            quoteId: quote.id,
            amount: FRACTIONAL,
            method: 'PIX',
            type: 'DEPOSIT',
            status: 'PENDING',
            dueDate: new Date(),
          },
        })
      ).id
      ids.halfUp = (
        await prisma.payment.create({
          data: {
            tenantId: tenantA,
            quoteId: quote.id,
            amount: '10.005',
            method: 'BOLETO',
            type: 'RENTAL',
            status: 'CANCELLED',
            dueDate: new Date(),
          },
        })
      ).id
      // Valor já em centavos, mesmo com zeros à direita: fora do relatório.
      ids.cents = (
        await prisma.payment.create({
          data: {
            tenantId: tenantA,
            quoteId: quote.id,
            amount: '128.570000',
            method: 'PIX',
            type: 'RENTAL',
            status: 'PAID',
            dueDate: new Date(),
          },
        })
      ).id
      ids.attempt = (
        await prisma.paymentAttempt.create({
          data: {
            tenantId: tenantA,
            paymentId: ids.pending,
            provider: 'ASAAS',
            idempotencyKey: 'cents:' + randomUUID(),
            amount: FRACTIONAL,
            dueDate: new Date(),
          },
        })
      ).id
      ids.adjustment = (
        await prisma.quoteAdjustment.create({
          data: {
            tenantId: tenantA,
            quoteId: quote.id,
            category: 'OTHER',
            amount: '21.428571428571427',
            justification: 'Multa legada',
            createdBy: userId,
          },
        })
      ).id
      ids.rental = (
        await prisma.rentals.create({
          data: {
            tenantId: tenantA,
            id: 'cents-rental-' + randomUUID(),
            userid: userId,
            startdate: new Date(),
            enddate: new Date(),
            total: '300.004',
            extensionFee: '28.5714285',
            lateFee: '21.428571428571427',
            status: 'ACTIVE',
          },
        })
      ).id
      ids.foreign = (
        await prisma.payment.create({
          data: {
            tenantId: tenantB,
            amount: '1.999',
            method: 'PIX',
            type: 'DEPOSIT',
            status: 'OVERDUE',
            dueDate: new Date(),
          },
        })
      ).id
    })
    afterAll(async () => {
      if (prisma) {
        await prisma.paymentAttempt.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        })
        await prisma.payment.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        })
        await prisma.quoteAdjustment.deleteMany({
          where: { tenantId: tenantA },
        })
        await prisma.rentals.deleteMany({ where: { tenantId: tenantA } })
        await prisma.quote.deleteMany({ where: { tenantId: tenantA } })
        await prisma.user.deleteMany({ where: { id: userId } })
        await prisma.organization.deleteMany({
          where: { id: { in: [tenantA, tenantB] } },
        })
        await prisma.$disconnect()
      }
      await pool?.end()
      await reportPool?.end()
    })

    async function withClient<T>(
      operation: (_client: PoolClient) => Promise<T>
    ) {
      const client = await reportPool.connect()
      try {
        return await operation(client)
      } finally {
        client.release()
      }
    }

    it('lists every value outside cents for one tenant with its cents value (ROUND_HALF_UP) and origin', async () => {
      const report = await withClient((client) =>
        collectLegacyCentsReport(client, {
          tenantId: tenantA,
          now: () => new Date(0),
        })
      )
      expect(report.generatedAt).toBe('1970-01-01T00:00:00.000Z')
      expect(report.tenants.map((tenant) => tenant.tenantId)).toEqual([tenantA])
      const rows = report.tenants[0]!.rows
      const sorted = [...rows].sort((left, right) =>
        (left.origin + left.id).localeCompare(right.origin + right.id)
      )
      expect(sorted).toEqual([
        {
          origin: 'payment_attempts.amount',
          id: ids.attempt,
          value: EXACT,
          cents: '128.57',
          difference: '-0.00142857142858',
          status: 'QUEUED',
          reference: 'payment:' + ids.pending,
        },
        ...[
          {
            origin: 'payments.amount',
            id: ids.halfUp,
            value: '10.005',
            cents: '10.01',
            difference: '0.005',
            status: 'CANCELLED',
            reference: 'quote:' + ids.quote,
          },
          {
            origin: 'payments.amount',
            id: ids.pending,
            value: EXACT,
            cents: '128.57',
            difference: '-0.00142857142858',
            status: 'PENDING',
            reference: 'quote:' + ids.quote,
          },
        ].sort((left, right) => left.id.localeCompare(right.id)),
        {
          origin: 'quote_adjustments.amount',
          id: ids.adjustment,
          value: '21.428571428571427',
          cents: '21.43',
          difference: '0.001428571428573',
          status: 'OTHER',
          reference: 'quote:' + ids.quote,
        },
        {
          origin: 'quotes.lateFee',
          id: ids.quote,
          value: '7.7142',
          cents: '7.71',
          difference: '-0.0042',
          status: 'APPROVED',
          reference: 'quote:' + ids.quote,
        },
        {
          origin: 'quotes.total',
          id: ids.quote,
          value: EXACT,
          cents: '128.57',
          difference: '-0.00142857142858',
          status: 'APPROVED',
          reference: 'quote:' + ids.quote,
        },
        {
          origin: 'rentals.extensionFee',
          id: ids.rental,
          value: '28.5714285',
          cents: '28.57',
          difference: '-0.0014285',
          status: 'ACTIVE',
          reference: 'rental:' + ids.rental,
        },
        {
          origin: 'rentals.lateFee',
          id: ids.rental,
          value: '21.428571428571427',
          cents: '21.43',
          difference: '0.001428571428573',
          status: 'ACTIVE',
          reference: 'rental:' + ids.rental,
        },
        {
          origin: 'rentals.total',
          id: ids.rental,
          value: '300.004',
          cents: '300.00',
          difference: '-0.004',
          status: 'ACTIVE',
          reference: 'rental:' + ids.rental,
        },
      ])
      expect(LEGACY_CENTS_ORIGINS).toEqual(
        expect.arrayContaining([...new Set(rows.map((row) => row.origin))])
      )
      // O que já está em centavos (128.570000, finalTotal 142.86) e a outra locadora não aparecem.
      expect(rows.map((row) => row.id)).not.toContain(ids.cents)
      expect(rows.map((row) => row.id)).not.toContain(ids.foreign)
      expect(rows.some((row) => row.origin === 'quotes.finalTotal')).toBe(false)
    })

    it('without a tenant, reports each locadora separately', async () => {
      const report = await withClient((client) =>
        collectLegacyCentsReport(client)
      )
      const byTenant = new Map(
        report.tenants.map((tenant) => [tenant.tenantId, tenant])
      )
      expect(byTenant.get(tenantA)?.rows).toHaveLength(9)
      expect(byTenant.get(tenantB)).toMatchObject({
        slug: tenantB,
        rows: [
          {
            origin: 'payments.amount',
            id: ids.foreign,
            value: '1.999',
            cents: '2.00',
            difference: '0.001',
            status: 'OVERDUE',
            reference: null,
          },
        ],
      })
    })

    it('runs in a transaction the database itself keeps read-only, and changes nothing', async () => {
      const before = await prisma.payment.findMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
        orderBy: { id: 'asc' },
      })
      const writes: string[] = []
      await withClient(async (client) => {
        // Dentro da mesma transação do relatório, uma escrita é recusada pelo PostgreSQL.
        const probe: ReportClient = {
          async query(text, values) {
            const result = await client.query(
              text,
              values as unknown[] | undefined
            )
            if (text === 'SHOW transaction_read_only') {
              await client.query('SAVEPOINT write_probe')
              try {
                await client.query(
                  'UPDATE payments SET amount = round(amount, 2) WHERE id = $1',
                  [ids.pending]
                )
                writes.push('accepted')
              } catch (error) {
                writes.push((error as { code?: string }).code ?? 'unknown')
              }
              await client.query('ROLLBACK TO SAVEPOINT write_probe')
            }
            return result
          },
        }
        await collectLegacyCentsReport(probe, { tenantId: tenantA })
        // O relatório desfez a transação: a conexão volta ao modo padrão, fora da transação somente leitura.
        expect(
          (await client.query('SHOW transaction_read_only')).rows[0]
            .transaction_read_only
        ).toBe('off')
      })
      // 25006 = read_only_sql_transaction.
      expect(writes).toEqual(['25006'])
      expect(
        await prisma.payment.findMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
          orderBy: { id: 'asc' },
        })
      ).toEqual(before)
    })

    it('refuses an unknown tenant instead of reporting an empty list', async () => {
      await expect(
        withClient((client) =>
          collectLegacyCentsReport(client, {
            tenantId: 'missing-' + randomUUID(),
          })
        )
      ).rejects.toThrow('Locadora não encontrada')
    })
  }
)
