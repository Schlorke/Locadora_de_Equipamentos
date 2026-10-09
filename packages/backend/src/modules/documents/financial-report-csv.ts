import type { ExportRow } from '../billing/financial-report-types'
export function buildCsv(rows: ExportRow[]): Buffer {
  const sep = ';'
  const headers = [
    'Código',
    'Cód. Legado',
    'Cliente',
    'Empresa',
    'CNPJ/CPF',
    'Valor Bruto',
    'Valor Líquido',
    'Alíquota %',
    'Nº Nota',
    'Data Boleto',
    'Data NF',
    'Vencimento',
    'Pagamento',
    'Status',
  ]

  const csvLines = [headers.join(sep)]

  for (const row of rows) {
    const values = [
      row.quoteCode,
      row.legacyCode,
      row.customerName,
      row.customerCompany,
      row.customerDocument,
      row.grossAmount.toFixed(2).replace('.', ','),
      row.netAmount.toFixed(2).replace('.', ','),
      row.taxRate.toFixed(2).replace('.', ','),
      row.invoiceNumber,
      row.boletoIssuedAt,
      row.invoiceIssuedAt,
      row.dueDate,
      row.paidAt,
      row.billingStatusLabel,
    ]
    // Escape fields containing separator or quotes
    const escaped = values.map((v) => {
      const s = String(v)
      if (s.includes(sep) || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    })
    csvLines.push(escaped.join(sep))
  }

  const content = csvLines.join('\r\n')
  // UTF-8 BOM for correct Excel encoding
  const bom = Buffer.from([0xef, 0xbb, 0xbf])
  return Buffer.concat([bom, Buffer.from(content, 'utf-8')])
}
