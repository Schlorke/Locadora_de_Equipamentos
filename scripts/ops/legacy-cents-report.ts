/**
 * Relatório SOMENTE LEITURA de valores cobrados gravados fora de centavos, por locadora.
 *
 * Valores legados (antes da onda 4) podem ter frações de centavo: total de orçamento de 9 dias
 * com semana direta (128.5714…), multas (21.428571…) e prorrogações antigas, cobranças PENDING
 * criadas com esse total. O sistema já cobra e quita em centavos (`roundToCents`, regra única de
 * `packages/domain/src/locacao/saldo.ts`); este relatório só mostra as linhas que um operador
 * precisa conciliar à mão. Nada é corrigido automaticamente: o runbook está em
 * `docs/guides/legacy-cents-reconciliation.md`.
 *
 * Garantias:
 * - uma transação `READ ONLY` (conferida por `SHOW transaction_read_only`) e `ROLLBACK` no fim;
 * - uma locadora por vez, com `app.tenant_id` local (RLS) e filtro explícito por `tenantId`;
 * - `DATABASE_URL` explícita no ambiente: nenhum arquivo dotenv é carregado.
 *
 * Uso:
 *   DATABASE_URL=<url> pnpm exec tsx scripts/ops/legacy-cents-report.ts [--tenant-id=<id>] [--format=text|csv|json]
 */
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import Decimal from 'decimal.js'
import { roundToCents } from '@gb-locacoes/domain/locacao'

/** Cliente mínimo (um `pg.PoolClient` ou `pg.Client` satisfaz). */
export interface ReportClient {
  query(
    _text: string,
    _values?: readonly unknown[]
  ): Promise<{ rows: Record<string, unknown>[] }>
}

export type LegacyCentsFormat = 'text' | 'csv' | 'json'

export type LegacyCentsRow = {
  /** Tabela e coluna de onde o valor saiu, como `payments.amount`. */
  origin: string
  id: string
  /** Valor gravado, com todas as casas significativas (sem os zeros à direita da coluna). */
  value: string
  /** O mesmo valor em centavos, pela regra única do sistema (ROUND_HALF_UP). */
  cents: string
  /** `cents - value`: o que muda se a linha for conciliada pelo valor em centavos. */
  difference: string
  status: string | null
  /** Obrigação a que a linha pertence (`quote:<id>`, `rental:<id>` ou `payment:<id>`). */
  reference: string | null
}

export type LegacyCentsTenant = {
  tenantId: string
  slug: string
  name: string
  rows: LegacyCentsRow[]
}

export type LegacyCentsReport = {
  generatedAt: string
  tenants: LegacyCentsTenant[]
}

type Source = { origin: string; sql: string }

/**
 * Valores cobrados (obrigações, cobranças, tentativas, multas e prorrogações). Cada consulta
 * devolve `id`, `value` (texto, sem perda), `status` e `reference`, só onde o valor tem mais de
 * duas casas decimais significativas.
 */
const SOURCES: readonly Source[] = Object.freeze([
  {
    origin: 'payments.amount',
    sql: `SELECT id, amount::text AS value, status::text AS status,
      CASE WHEN "rentalId" IS NOT NULL THEN 'rental:' || "rentalId" WHEN "quoteId" IS NOT NULL THEN 'quote:' || "quoteId" END AS reference
    FROM payments WHERE "tenantId" = $1 AND amount <> round(amount, 2)`,
  },
  {
    origin: 'payment_attempts.amount',
    sql: `SELECT id, amount::text AS value, status::text AS status, 'payment:' || "paymentId" AS reference
    FROM payment_attempts WHERE "tenantId" = $1 AND amount <> round(amount, 2)`,
  },
  {
    origin: 'quotes.total',
    sql: `SELECT id, total::text AS value, status::text AS status, 'quote:' || id AS reference
    FROM quotes WHERE "tenantId" = $1 AND total <> round(total, 2)`,
  },
  {
    origin: 'quotes.finalTotal',
    sql: `SELECT id, "finalTotal"::text AS value, status::text AS status, 'quote:' || id AS reference
    FROM quotes WHERE "tenantId" = $1 AND "finalTotal" IS NOT NULL AND "finalTotal" <> round("finalTotal", 2)`,
  },
  {
    origin: 'quotes.lateFee',
    sql: `SELECT id, "lateFee"::text AS value, status::text AS status, 'quote:' || id AS reference
    FROM quotes WHERE "tenantId" = $1 AND "lateFee" IS NOT NULL AND "lateFee" <> round("lateFee", 2)`,
  },
  {
    origin: 'quote_adjustments.amount',
    sql: `SELECT id, amount::text AS value, category::text AS status, 'quote:' || "quoteId" AS reference
    FROM quote_adjustments WHERE "tenantId" = $1 AND amount <> round(amount, 2)`,
  },
  {
    origin: 'rentals.total',
    sql: `SELECT id, total::text AS value, status::text AS status, 'rental:' || id AS reference
    FROM rentals WHERE "tenantId" = $1 AND total <> round(total, 2)`,
  },
  {
    origin: 'rentals.extensionFee',
    sql: `SELECT id, "extensionFee"::text AS value, status::text AS status, 'rental:' || id AS reference
    FROM rentals WHERE "tenantId" = $1 AND "extensionFee" IS NOT NULL AND "extensionFee" <> round("extensionFee", 2)`,
  },
  {
    origin: 'rentals.lateFee',
    sql: `SELECT id, "lateFee"::text AS value, status::text AS status, 'rental:' || id AS reference
    FROM rentals WHERE "tenantId" = $1 AND "lateFee" IS NOT NULL AND "lateFee" <> round("lateFee", 2)`,
  },
])

/** Origens cobertas pelo relatório, na ordem em que aparecem. */
export const LEGACY_CENTS_ORIGINS: readonly string[] = Object.freeze(
  SOURCES.map((source) => source.origin)
)

const text = (value: unknown) =>
  value === null || value === undefined ? null : String(value)

function toRow(origin: string, row: Record<string, unknown>): LegacyCentsRow {
  const value = new Decimal(String(row.value)).toFixed()
  const cents = roundToCents(value)
  return {
    origin,
    id: String(row.id),
    value,
    cents: cents.toFixed(2),
    difference: cents.minus(value).toFixed(),
    status: text(row.status),
    reference: text(row.reference),
  }
}

/**
 * Coleta o relatório numa única transação somente leitura (foto consistente) e desfaz a
 * transação no fim. Sem `tenantId`, percorre todas as locadoras por slug.
 */
export async function collectLegacyCentsReport(
  client: ReportClient,
  options: { tenantId?: string; now?: () => Date } = {}
): Promise<LegacyCentsReport> {
  await client.query(
    'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'
  )
  try {
    const mode = await client.query('SHOW transaction_read_only')
    if (mode.rows[0]?.transaction_read_only !== 'on')
      throw new Error(
        'A transação do relatório não está em modo somente leitura'
      )
    await client.query("SET LOCAL statement_timeout = '60s'")
    const organizations = options.tenantId
      ? await client.query(
          'SELECT id, slug, name FROM organizations WHERE id = $1',
          [options.tenantId]
        )
      : await client.query(
          'SELECT id, slug, name FROM organizations ORDER BY slug, id'
        )
    if (options.tenantId && organizations.rows.length !== 1)
      throw new Error('Locadora não encontrada: ' + options.tenantId)
    const tenants: LegacyCentsTenant[] = []
    for (const organization of organizations.rows) {
      const tenantId = String(organization.id)
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantId,
      ])
      const rows: LegacyCentsRow[] = []
      for (const source of SOURCES) {
        const result = await client.query(source.sql + ' ORDER BY id', [
          tenantId,
        ])
        rows.push(...result.rows.map((row) => toRow(source.origin, row)))
      }
      tenants.push({
        tenantId,
        slug: String(organization.slug),
        name: String(organization.name),
        rows,
      })
    }
    return {
      generatedAt: (options.now?.() ?? new Date()).toISOString(),
      tenants,
    }
  } finally {
    await client.query('ROLLBACK')
  }
}

const CSV_COLUMNS = [
  'tenantId',
  'slug',
  'origin',
  'id',
  'value',
  'cents',
  'difference',
  'status',
  'reference',
] as const

function csvCell(value: string | null): string {
  const cell = value ?? ''
  return /[",\n\r]/.test(cell) ? '"' + cell.replaceAll('"', '""') + '"' : cell
}

export function formatLegacyCentsReport(
  report: LegacyCentsReport,
  format: LegacyCentsFormat
): string {
  if (format === 'json') return JSON.stringify(report, null, 2) + '\n'
  if (format === 'csv') {
    const lines: string[] = [CSV_COLUMNS.join(',')]
    for (const tenant of report.tenants) {
      for (const row of tenant.rows) {
        const cells: Record<(typeof CSV_COLUMNS)[number], string | null> = {
          tenantId: tenant.tenantId,
          slug: tenant.slug,
          ...row,
        }
        lines.push(
          CSV_COLUMNS.map((column) => csvCell(cells[column])).join(',')
        )
      }
    }
    return lines.join('\n') + '\n'
  }
  const lines = [
    `Valores fora de centavos (somente leitura) — ${report.generatedAt}`,
  ]
  let total = 0
  for (const tenant of report.tenants) {
    total += tenant.rows.length
    lines.push(
      '',
      `Locadora ${tenant.slug} (${tenant.tenantId}) — ${tenant.rows.length} linha(s)`
    )
    for (const row of tenant.rows) {
      lines.push(
        `  ${row.origin}  id=${row.id}  valor=${row.value}  centavos=${row.cents}  diferença=${row.difference}` +
          `  status=${row.status ?? '-'}  obrigação=${row.reference ?? '-'}`
      )
    }
  }
  lines.push(
    '',
    `Total: ${total} linha(s) em ${report.tenants.length} locadora(s). Nada foi alterado.`
  )
  return lines.join('\n') + '\n'
}

export type LegacyCentsPlan = {
  connectionString: string
  tenantId?: string
  format: LegacyCentsFormat
}

export function parseLegacyCentsArgs(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>>
): LegacyCentsPlan {
  let tenantId: string | undefined
  let format: LegacyCentsFormat = 'text'
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!
    if (arg === '--tenant-id') tenantId = args[++index]
    else if (arg.startsWith('--tenant-id='))
      tenantId = arg.slice('--tenant-id='.length)
    else if (arg === '--format') format = args[++index] as LegacyCentsFormat
    else if (arg.startsWith('--format='))
      format = arg.slice('--format='.length) as LegacyCentsFormat
    else throw new Error('Argumento desconhecido: ' + arg)
  }
  if (tenantId !== undefined && (!tenantId.trim() || tenantId.startsWith('--')))
    throw new Error('--tenant-id exige um valor')
  if (!['text', 'csv', 'json'].includes(format))
    throw new Error('--format deve ser text, csv ou json')
  const connectionString = env.DATABASE_URL
  if (!connectionString)
    throw new Error(
      'DATABASE_URL explícita é obrigatória; arquivos dotenv não são carregados'
    )
  return {
    connectionString,
    format,
    ...(tenantId ? { tenantId: tenantId.trim() } : {}),
  }
}

async function main() {
  const plan = parseLegacyCentsArgs(process.argv.slice(2), process.env)
  const { Client } = await import('pg')
  const client = new Client({
    connectionString: plan.connectionString,
    application_name: 'legacy-cents-report',
  })
  await client.connect()
  try {
    const report = await collectLegacyCentsReport(
      client,
      plan.tenantId ? { tenantId: plan.tenantId } : {}
    )
    process.stdout.write(formatLegacyCentsReport(report, plan.format))
  } finally {
    await client.end()
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    process.stderr.write(
      (error instanceof Error ? error.message : 'Falha no relatório') + '\n'
    )
    process.exitCode = 1
  })
}
