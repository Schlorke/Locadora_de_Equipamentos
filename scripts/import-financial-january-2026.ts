/**
 * Script de importação: Relatório de Cobrança Janeiro 2026
 *
 * Lê a planilha "relatorio cobrança Janeiro.2026.xlsx" (aba "janeiro-2026")
 * e cria registros de Quote (stub) + Payment no banco de dados para que
 * apareçam no painel financeiro (/admin/financeiro).
 *
 * Execução: npx tsx scripts/import-financial-january-2026.ts
 *
 * Idempotente: se executado novamente, pula registros já importados
 * (verifica legacyExternalCode no Quote).
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { Decimal } from 'decimal.js'
import ExcelJS from 'exceljs'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'

// Carregar variáveis de ambiente ANTES de importar prisma
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const { prisma } = getDatabaseRuntime()

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Converte data do Excel (número serial ou string "dd.mm.yy") para Date */
function parseExcelDate(value: unknown): Date | null {
  if (value == null) return null

  // ExcelJS already converts date-formatted cells to Date objects
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) return value
    return null
  }

  // Número serial do Excel (dias desde 1900-01-01)
  if (typeof value === 'number') {
    const utcDays = Math.floor(value - 25569)
    const date = new Date(utcDays * 86400 * 1000)
    if (!isNaN(date.getTime())) return date
    return null
  }

  // String no formato "dd.mm.yy" ou "dd.mm.yyyy"
  if (typeof value === 'string') {
    const trimmed = value.trim()
    // Tenta "dd.mm.yy", "dd.mm.yyyy" ou "dd.mm.yy - texto"
    const match = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/)
    if (match?.[1] && match[2] && match[3]) {
      const day = parseInt(match[1], 10)
      const month = parseInt(match[2], 10) - 1
      let year = parseInt(match[3], 10)
      if (year < 100) year += 2000
      const date = new Date(year, month, day, 12, 0, 0)
      if (!isNaN(date.getTime())) return date
    }
  }

  return null
}

/** Extrai número de uma célula (pode ser number, string, null) */
function parseNumber(value: unknown): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.,-]/g, '').replace(',', '.')
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
  }
  return 0
}

/** Extrai string de uma célula */
function parseString(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

/** Extrai o valor de uma célula ExcelJS (pode ser { result, ... } para fórmulas) */
function cellValue(cell: ExcelJS.CellValue): unknown {
  if (
    cell != null &&
    typeof cell === 'object' &&
    'result' in (cell as object)
  ) {
    return (cell as { result: unknown }).result
  }
  return cell
}

// ── Tipo para cada linha da planilha ─────────────────────────────────────────

interface ExcelRow {
  obraNumber: string
  clientName: string
  grossAmount: number
  netAmountNF: number
  netAmountRecibo: number
  invoiceNumber: string | null
  issueDate: Date | null
  paymentDate: Date | null
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Importação: Relatório Cobrança Janeiro 2026')
  console.log('═══════════════════════════════════════════════════\n')

  // 1. Ler Excel
  const filePath = 'relatorio cobrança Janeiro.2026.xlsx'
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)

  const ws = workbook.getWorksheet('janeiro-2026')
  if (!ws) {
    console.error('Aba "janeiro-2026" não encontrada no arquivo.')
    process.exit(1)
  }

  console.log(`Linhas brutas encontradas: ${ws.rowCount}\n`)

  // 2. Parsear linhas (pular header na row 1)
  const rows: ExcelRow[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // skip header

    const values = row.values as ExcelJS.CellValue[]
    // ExcelJS rows are 1-indexed, so values[0] is undefined
    const obraNum = parseString(cellValue(values[1]))
    const clientName = parseString(cellValue(values[2]))
    const grossAmount = parseNumber(cellValue(values[5]))

    // Pular linhas sem número de obra ou sem valor bruto
    if (!obraNum && !clientName) return
    if (grossAmount <= 0) return

    rows.push({
      obraNumber: obraNum || `SN-${rowNumber}`,
      clientName: clientName || `Obra ${obraNum}`,
      grossAmount,
      netAmountNF: parseNumber(cellValue(values[6])),
      netAmountRecibo: parseNumber(cellValue(values[7])),
      invoiceNumber:
        values[9] != null ? String(cellValue(values[9])).trim() || null : null,
      issueDate: parseExcelDate(cellValue(values[10])),
      paymentDate: parseExcelDate(cellValue(values[11])),
    })
  })

  console.log(`Linhas válidas para importação: ${rows.length}\n`)

  // 3. Importar cada linha
  let created = 0
  let skipped = 0
  let errors = 0
  const dueDateJan = new Date(2026, 0, 31, 23, 59, 59) // 31/01/2026

  for (const row of rows) {
    const legacyCode = `OBRA-${row.obraNumber}`

    try {
      // Verificar se já existe (idempotência)
      const existingQuote = await prisma.quote.findFirst({
        where: { legacyExternalCode: legacyCode },
        select: { id: true },
      })

      if (existingQuote) {
        skipped++
        continue
      }

      // Calcular valor líquido: preferir NF, senão recibo, senão calcular
      const netAmount =
        row.netAmountNF > 0
          ? row.netAmountNF
          : row.netAmountRecibo > 0
            ? row.netAmountRecibo
            : new Decimal(row.grossAmount)
                .mul(new Decimal(1).minus(new Decimal(0.06)))
                .toDecimalPlaces(2)
                .toNumber()

      // Calcular taxa real aplicada
      const taxRate =
        row.grossAmount > 0
          ? new Decimal(row.grossAmount)
              .minus(new Decimal(netAmount))
              .div(new Decimal(row.grossAmount))
              .mul(100)
              .toDecimalPlaces(2)
              .toNumber()
          : 0

      // Determinar status do pagamento
      const isPaid = row.paymentDate != null
      const billingStatus = isPaid ? 'PAID' : 'AWAITING_PAYMENT'
      const paymentStatus = isPaid ? 'PAID' : 'PENDING'

      // Criar Quote + Payment em transação
      await prisma.$transaction(async (tx) => {
        const quote = await tx.quote.create({
          data: {
            legacyExternalCode: legacyCode,
            name: row.clientName,
            email: 'importado@gbloacoes.com.br',
            phone: '(00) 00000-0000',
            total: new Decimal(row.grossAmount),
            originalTotal: new Decimal(row.grossAmount),
            finalTotal: new Decimal(row.grossAmount),
            status: 'APPROVED',
            startDate: new Date(2026, 0, 1),
            endDate: new Date(2026, 0, 31),
            validUntil: new Date(2026, 1, 28),
          },
        })

        await tx.payment.create({
          data: {
            quoteId: quote.id,
            amount: new Decimal(row.grossAmount),
            grossAmount: new Decimal(row.grossAmount),
            netAmount: new Decimal(netAmount),
            taxRate: new Decimal(taxRate),
            taxDocumentType: 'CNPJ',
            method: 'BOLETO',
            type: 'RENTAL',
            status: paymentStatus,
            billingStatus,
            dueDate: dueDateJan,
            paidAt: row.paymentDate || undefined,
            invoiceNumber: row.invoiceNumber || undefined,
            invoiceIssuedAt: row.issueDate || undefined,
            boletoIssuedAt: new Date(2026, 0, 1),
          },
        })
      })

      created++
      console.log(
        `  ✓ ${legacyCode} | ${row.clientName.padEnd(35)} | R$ ${row.grossAmount.toFixed(2).padStart(10)} | ${billingStatus}`
      )
    } catch (err) {
      errors++
      console.error(`  ✗ ${legacyCode} | ${row.clientName} | ERRO:`, err)
    }
  }

  // 4. Resumo
  console.log('\n═══════════════════════════════════════════════════')
  console.log('  RESUMO DA IMPORTAÇÃO')
  console.log('═══════════════════════════════════════════════════')
  console.log(`  Criados:  ${created}`)
  console.log(`  Pulados:  ${skipped} (já existiam)`)
  console.log(`  Erros:    ${errors}`)
  console.log(`  Total:    ${rows.length}`)
  console.log('═══════════════════════════════════════════════════\n')

  if (errors > 0) {
    process.exit(1)
  }
}

main()
  .catch((err) => {
    console.error('Erro fatal:', err)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
