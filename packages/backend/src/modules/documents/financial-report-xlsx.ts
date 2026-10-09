import { financialReportTokens } from '@gb-locacoes/design-tokens/documents'
import ExcelJS from 'exceljs'
import type { ExportRow } from '../billing/financial-report-types'
export async function buildXlsx(
  rows: ExportRow[],
  meta: {
    companyName: string
    totalGross: number
    totalNet: number
    totalPaid: number
    totalPending: number
    periodLabel: string
  }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = meta.companyName
  workbook.created = new Date()

  /* ---- Design tokens ---- */
  const C = financialReportTokens.xlsx.colors

  const now = new Date()
  const footerText = `Gerado em ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — ${meta.companyName} © ${now.getFullYear()}`

  const STATUS_ROW_BG: Record<string, string> = {
    PAID: C.greenBg,
    UNPAID: C.redBg,
    AWAITING_PAYMENT: C.yellowBg,
    SETTLED: C.grayBg,
  }

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: C.gray200 } },
    bottom: { style: 'thin', color: { argb: C.gray200 } },
    left: { style: 'thin', color: { argb: C.gray200 } },
    right: { style: 'thin', color: { argb: C.gray200 } },
  }

  /* ---- Helpers ---- */

  /** Banner row spanning full width: orange bg + white bold text */
  function writeBanner(
    sheet: ExcelJS.Worksheet,
    row: number,
    text: string,
    colSpan: number
  ) {
    const lastCol = String.fromCharCode(64 + colSpan)
    sheet.mergeCells(`A${row}:${lastCol}${row}`)
    const cell = sheet.getCell(`A${row}`)
    cell.value = text
    cell.font = {
      bold: true,
      size: financialReportTokens.xlsx.fonts.title,
      color: { argb: C.white },
    }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: C.orange },
    }
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    sheet.getRow(row).height = 44
    for (let c = 1; c <= colSpan; c++) {
      sheet.getRow(row).getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: C.orange },
      }
    }
  }

  /** Subtitle row: dark bg + gray text */
  function writeSubBanner(
    sheet: ExcelJS.Worksheet,
    row: number,
    text: string,
    colSpan: number
  ) {
    const lastCol = String.fromCharCode(64 + colSpan)
    sheet.mergeCells(`A${row}:${lastCol}${row}`)
    const cell = sheet.getCell(`A${row}`)
    cell.value = text
    cell.font = {
      size: financialReportTokens.xlsx.fonts.subtitle,
      color: { argb: C.gray300 },
      italic: true,
    }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.dark } }
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    sheet.getRow(row).height = 26
    for (let c = 1; c <= colSpan; c++) {
      sheet.getRow(row).getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: C.dark },
      }
    }
  }

  /** Section title row: orange text, bold, bottom accent line */
  function writeSectionTitle(
    sheet: ExcelJS.Worksheet,
    row: number,
    text: string,
    colSpan: number
  ) {
    const lastCol = String.fromCharCode(64 + colSpan)
    sheet.mergeCells(`A${row}:${lastCol}${row}`)
    const cell = sheet.getCell(`A${row}`)
    cell.value = text
    cell.font = {
      bold: true,
      size: financialReportTokens.xlsx.fonts.section,
      color: { argb: C.orangeDark },
    }
    cell.alignment = { vertical: 'middle' }
    cell.border = { bottom: { style: 'medium', color: { argb: C.orange } } }
    sheet.getRow(row).height = 30
  }

  /** Table header row: dark slate bg, white bold text */
  function writeTableHeader(
    sheet: ExcelJS.Worksheet,
    row: number,
    headers: string[]
  ) {
    const r = sheet.getRow(row)
    r.values = headers
    r.height = 28
    r.font = {
      bold: true,
      size: financialReportTokens.xlsx.fonts.subtitle,
      color: { argb: C.white },
    }
    r.alignment = { vertical: 'middle', horizontal: 'center' }
    for (let c = 1; c <= headers.length; c++) {
      const cell = r.getCell(c)
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: C.darkMed },
      }
      cell.border = thinBorder
    }
  }

  /** Data row with alternating bg and full borders */
  function styleDataRow(
    row: ExcelJS.Row,
    idx: number,
    colCount: number,
    customBg?: string
  ) {
    row.height = 24
    row.font = {
      size: financialReportTokens.xlsx.fonts.subtitle,
      color: { argb: C.gray900 },
    }
    row.alignment = { vertical: 'middle' }
    const bg = customBg || (idx % 2 === 0 ? C.gray100 : C.white)
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.border = thinBorder
    }
  }

  /** Totals row: orange accent, bold */
  function styleTotalsRow(row: ExcelJS.Row, colCount: number) {
    row.height = 28
    row.font = {
      bold: true,
      size: financialReportTokens.xlsx.fonts.total,
      color: { argb: C.gray900 },
    }
    row.alignment = { vertical: 'middle' }
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c)
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: C.orangeLight },
      }
      cell.border = {
        top: { style: 'medium', color: { argb: C.orange } },
        bottom: { style: 'medium', color: { argb: C.orange } },
        left: { style: 'thin', color: { argb: C.gray200 } },
        right: { style: 'thin', color: { argb: C.gray200 } },
      }
    }
  }

  function addFooter(sheet: ExcelJS.Worksheet) {
    sheet.headerFooter = { oddFooter: `&C&8${footerText}` }
  }

  function applyPrintSetup(sheet: ExcelJS.Worksheet) {
    sheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
    }
  }

  /** Hide gridlines so the sheet looks like a clean document */
  function hideGridLines(sheet: ExcelJS.Worksheet) {
    sheet.views = [{ showGridLines: false }]
  }

  /** Write a footer row in the sheet itself (for when printed/exported) */
  function writeSheetFooter(
    sheet: ExcelJS.Worksheet,
    row: number,
    colSpan: number
  ) {
    const lastCol = String.fromCharCode(64 + Math.min(colSpan, 26))
    sheet.mergeCells(`A${row}:${lastCol}${row}`)
    const cell = sheet.getCell(`A${row}`)
    cell.value = footerText
    cell.font = {
      size: financialReportTokens.xlsx.fonts.footer,
      italic: true,
      color: { argb: C.gray500 },
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    sheet.getRow(row).height = 22
  }

  /** Fill all cells in a range with white background to hide gridlines for empty area */
  function _fillWhite(
    sheet: ExcelJS.Worksheet,
    fromRow: number,
    toRow: number,
    cols: number
  ) {
    const whiteFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: C.white },
    }
    for (let r = fromRow; r <= toRow; r++) {
      for (let c = 1; c <= cols; c++) {
        const cell = sheet.getRow(r).getCell(c)
        if (!cell.value && !cell.fill) cell.fill = whiteFill
      }
    }
  }

  // Pre-compute status groups
  const paidRows = rows.filter((r) => r.billingStatus === 'PAID')
  const unpaidRows = rows.filter((r) => r.billingStatus === 'UNPAID')
  const awaitingRows = rows.filter(
    (r) => r.billingStatus === 'AWAITING_PAYMENT'
  )
  const settledRows = rows.filter((r) => r.billingStatus === 'SETTLED')

  const paidTotal = paidRows.reduce((s, r) => s + r.grossAmount, 0)
  const unpaidTotal = unpaidRows.reduce((s, r) => s + r.grossAmount, 0)
  const awaitingTotal = awaitingRows.reduce((s, r) => s + r.grossAmount, 0)
  const settledTotal = settledRows.reduce((s, r) => s + r.grossAmount, 0)

  const pct = (v: number) =>
    meta.totalGross > 0 ? Number(((v / meta.totalGross) * 100).toFixed(1)) : 0

  /* ================================================================ */
  /*  Sheet 1: Resumo Executivo                                       */
  /* ================================================================ */
  const s1 = workbook.addWorksheet('Resumo Executivo', {
    properties: { tabColor: { argb: C.orange } },
  })
  const s1Cols = 5
  s1.columns = [
    { width: 22 }, // A
    { width: 20 }, // B
    { width: 20 }, // C
    { width: 20 }, // D
    { width: 20 }, // E
  ]

  // Row 1-2: Banner + Sub
  writeBanner(s1, 1, `${meta.companyName} — Relatório Financeiro`, s1Cols)
  writeSubBanner(
    s1,
    2,
    `Período: ${meta.periodLabel}  |  Gerado em: ${now.toLocaleString('pt-BR')}`,
    s1Cols
  )

  // Row 3-4: KPI cards (horizontal layout A-E)
  const kpiLabels = [
    'Total Bruto',
    'Total Líquido',
    'Total Pago',
    'Total Pendente',
    'Lançamentos',
  ]
  const kpiValues = [
    meta.totalGross,
    meta.totalNet,
    meta.totalPaid,
    meta.totalPending,
    rows.length,
  ]
  const kpiColors = [C.green, C.accent, C.green, C.orangeDark, C.gray700]

  const kpiLabelRow = s1.getRow(3)
  kpiLabelRow.height = 22
  for (let i = 0; i < 5; i++) {
    const cell = kpiLabelRow.getCell(i + 1)
    cell.value = kpiLabels[i]
    cell.font = {
      size: financialReportTokens.xlsx.fonts.label,
      bold: true,
      color: { argb: C.gray500 },
    }
    cell.alignment = { vertical: 'bottom', horizontal: 'center' }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: C.white },
    }
    cell.border = {
      top: { style: 'medium', color: { argb: C.orange } },
      left: { style: 'thin', color: { argb: C.gray200 } },
      right: { style: 'thin', color: { argb: C.gray200 } },
    }
  }

  const kpiValRow = s1.getRow(4)
  kpiValRow.height = 40
  for (let i = 0; i < 5; i++) {
    const cell = kpiValRow.getCell(i + 1)
    cell.value = kpiValues[i]!
    cell.font = {
      size: financialReportTokens.xlsx.fonts.value,
      bold: true,
      color: { argb: kpiColors[i]! },
    }
    cell.alignment = { vertical: 'top', horizontal: 'center' }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: C.white },
    }
    cell.border = {
      bottom: { style: 'medium', color: { argb: C.orange } },
      left: { style: 'thin', color: { argb: C.gray200 } },
      right: { style: 'thin', color: { argb: C.gray200 } },
    }
    if (i < 4) cell.numFmt = '#,##0.00'
  }

  // Row 5: Section title
  writeSectionTitle(s1, 5, 'Composição por Status', s1Cols)

  // Row 6: Table header — D+E merged for "% do Total" to fill full width
  {
    const hdr = s1.getRow(6)
    hdr.height = 26
    const hdrStyle = {
      font: {
        bold: true,
        size: financialReportTokens.xlsx.fonts.subtitle,
        color: { argb: C.white },
      } as Partial<ExcelJS.Font>,
      fill: {
        type: 'pattern' as const,
        pattern: 'solid' as const,
        fgColor: { argb: C.darkMed },
      },
    }
    const headers = ['Status', 'Quantidade', 'Valor (R$)']
    for (let c = 1; c <= 3; c++) {
      const cell = hdr.getCell(c)
      cell.value = headers[c - 1]
      cell.font = hdrStyle.font
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.fill = hdrStyle.fill
      cell.border = thinBorder
    }
    s1.mergeCells('D6:E6')
    const dCell = hdr.getCell(4)
    dCell.value = '% do Total'
    dCell.font = hdrStyle.font
    dCell.alignment = { vertical: 'middle', horizontal: 'center' }
    dCell.fill = hdrStyle.fill
    dCell.border = thinBorder
    hdr.getCell(5).fill = hdrStyle.fill
    hdr.getCell(5).border = thinBorder
  }

  const composition = [
    ['Pagos', paidRows.length, paidTotal, pct(paidTotal), C.greenBg],
    ['Não Pagos', unpaidRows.length, unpaidTotal, pct(unpaidTotal), C.redBg],
    [
      'Aguardando Pgto',
      awaitingRows.length,
      awaitingTotal,
      pct(awaitingTotal),
      C.yellowBg,
    ],
    ['Baixados', settledRows.length, settledTotal, pct(settledTotal), C.grayBg],
  ] as const

  composition.forEach(([label, count, value, percent, bg], idx) => {
    const rowNum = 7 + idx
    const r = s1.getRow(rowNum)
    r.getCell(1).value = label
    r.getCell(2).value = count
    r.getCell(3).value = value
    r.getCell(3).numFmt = '#,##0.00'
    s1.mergeCells(`D${rowNum}:E${rowNum}`)
    r.getCell(4).value = percent
    r.getCell(4).numFmt = '0.0"%"'
    r.font = {
      size: financialReportTokens.xlsx.fonts.subtitle,
      color: { argb: C.gray900 },
    }
    r.alignment = { vertical: 'middle' }
    r.height = 26
    for (let c = 1; c <= s1Cols; c++) {
      r.getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bg },
      }
      r.getCell(c).border = thinBorder
    }
  })

  // Row 11: Totals — D+E merged
  const s1TotRow = s1.getRow(11)
  s1TotRow.getCell(1).value = 'TOTAL'
  s1TotRow.getCell(2).value = rows.length
  s1TotRow.getCell(3).value = meta.totalGross
  s1.mergeCells('D11:E11')
  s1TotRow.getCell(4).value = 100.0
  styleTotalsRow(s1TotRow, s1Cols)
  s1TotRow.getCell(3).numFmt = '#,##0.00'
  s1TotRow.getCell(4).numFmt = '0.0"%"'

  // Row 12: Footer (no blank row between)
  writeSheetFooter(s1, 12, s1Cols)
  hideGridLines(s1)
  addFooter(s1)
  applyPrintSetup(s1)

  /* ================================================================ */
  /*  Sheet 2: Lançamentos Detalhados                                 */
  /* ================================================================ */
  const s2 = workbook.addWorksheet('Lançamentos Detalhados', {
    properties: { tabColor: { argb: C.accent } },
  })

  const detailHeaders = [
    'Código',
    'Cód. Legado',
    'Cliente',
    'Empresa',
    'CNPJ/CPF',
    'Valor Bruto',
    'Valor Líquido',
    'Alíquota %',
    'ISS',
    'Tipo Operação',
    'Regime Tributário',
    'Nº Nota',
    'Data Boleto',
    'Data NF',
    'Vencimento',
    'Pagamento',
    'Status',
  ]
  const detailColCount = detailHeaders.length

  writeBanner(s2, 1, 'Lançamentos Detalhados', detailColCount)
  writeSubBanner(
    s2,
    2,
    `${rows.length} registros  |  ${meta.periodLabel}`,
    detailColCount
  )
  writeTableHeader(s2, 3, detailHeaders)

  s2.columns = [
    { width: 14 },
    { width: 14 },
    { width: 26 },
    { width: 20 },
    { width: 18 },
    { width: 14 },
    { width: 14 },
    { width: 10 },
    { width: 12 },
    { width: 17 },
    { width: 18 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
  ]

  rows.forEach((row, idx) => {
    const r = s2.getRow(4 + idx)
    r.values = [
      row.quoteCode,
      row.legacyCode,
      row.customerName,
      row.customerCompany,
      row.customerDocument,
      row.grossAmount,
      row.netAmount,
      row.taxRate,
      row.issAmount,
      row.operationType,
      row.taxRegime,
      row.invoiceNumber,
      row.boletoIssuedAt,
      row.invoiceIssuedAt,
      row.dueDate,
      row.paidAt,
      row.billingStatusLabel,
    ]
    r.getCell(6).numFmt = '#,##0.00'
    r.getCell(7).numFmt = '#,##0.00'
    r.getCell(8).numFmt = '0.00'
    r.getCell(9).numFmt = '#,##0.00'

    const statusBg = STATUS_ROW_BG[row.billingStatus]
    styleDataRow(r, idx, detailColCount, statusBg)
  })

  // Totals
  const s2TotRowNum = 4 + rows.length
  const s2TotRow = s2.getRow(s2TotRowNum)
  s2TotRow.values = [
    'TOTAIS',
    '',
    `${rows.length} reg.`,
    '',
    '',
    meta.totalGross,
    meta.totalNet,
    '',
    rows.reduce((s, r) => s + r.issAmount, 0),
  ]
  s2TotRow.getCell(6).numFmt = '#,##0.00'
  s2TotRow.getCell(7).numFmt = '#,##0.00'
  s2TotRow.getCell(9).numFmt = '#,##0.00'
  styleTotalsRow(s2TotRow, detailColCount)

  s2.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3 + rows.length, column: detailColCount },
  }

  writeSheetFooter(s2, s2TotRowNum + 1, detailColCount)
  hideGridLines(s2)
  addFooter(s2)
  applyPrintSetup(s2)

  /* ================================================================ */
  /*  Sheet 3: Contas a Receber                                       */
  /* ================================================================ */
  const s3 = workbook.addWorksheet('Contas a Receber', {
    properties: { tabColor: { argb: C.red } },
  })
  const s3Cols = 4
  s3.columns = [{ width: 24 }, { width: 16 }, { width: 20 }, { width: 16 }]

  writeBanner(s3, 1, 'Aging — Contas a Receber', s3Cols)
  writeSubBanner(s3, 2, `Contas pendentes: ${meta.periodLabel}`, s3Cols)

  // Build aging buckets
  const pendingRows = rows.filter((r) =>
    ['UNPAID', 'AWAITING_PAYMENT'].includes(r.billingStatus)
  )

  const agingBuckets = [
    { range: 'A vencer', count: 0, amount: 0, color: C.greenBg },
    { range: '1-30 dias', count: 0, amount: 0, color: C.yellowBg },
    { range: '31-60 dias', count: 0, amount: 0, color: C.orangeLight },
    { range: '61-90 dias', count: 0, amount: 0, color: C.redBg },
    { range: '+90 dias', count: 0, amount: 0, color: 'FFFCA5A5' },
  ]

  let totalReceivable = 0
  const debtorsMap: Record<
    string,
    { name: string; amount: number; days: number }
  > = {}

  for (const row of pendingRows) {
    const daysOverdue = row.dueDateRaw
      ? Math.ceil(
          (now.getTime() - row.dueDateRaw.getTime()) / (1000 * 60 * 60 * 24)
        )
      : 0
    totalReceivable += row.grossAmount

    let bucketIdx: number
    if (daysOverdue <= 0) bucketIdx = 0
    else if (daysOverdue <= 30) bucketIdx = 1
    else if (daysOverdue <= 60) bucketIdx = 2
    else if (daysOverdue <= 90) bucketIdx = 3
    else bucketIdx = 4

    agingBuckets[bucketIdx]!.count += 1
    agingBuckets[bucketIdx]!.amount += row.grossAmount

    if (daysOverdue > 0) {
      const key = row.customerName
      if (!debtorsMap[key]) debtorsMap[key] = { name: key, amount: 0, days: 0 }
      debtorsMap[key].amount += row.grossAmount
      debtorsMap[key].days = Math.max(debtorsMap[key].days, daysOverdue)
    }
  }

  // Aging table
  writeSectionTitle(s3, 3, 'Classificação por Vencimento', s3Cols)
  writeTableHeader(s3, 4, ['Faixa', 'Qtd', 'Valor (R$)', '% do Total'])

  agingBuckets.forEach((bucket, idx) => {
    const r = s3.getRow(5 + idx)
    r.values = [
      bucket.range,
      bucket.count,
      bucket.amount,
      totalReceivable > 0
        ? Number(((bucket.amount / totalReceivable) * 100).toFixed(1))
        : 0,
    ]
    r.getCell(3).numFmt = '#,##0.00'
    r.getCell(4).numFmt = '0.0"%"'
    styleDataRow(r, idx, s3Cols)
    for (let c = 1; c <= s3Cols; c++) {
      r.getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bucket.color },
      }
    }
  })

  // Aging totals
  const s3AgingTot = s3.getRow(10)
  s3AgingTot.values = ['TOTAL', pendingRows.length, totalReceivable, 100.0]
  s3AgingTot.getCell(3).numFmt = '#,##0.00'
  s3AgingTot.getCell(4).numFmt = '0.0"%"'
  styleTotalsRow(s3AgingTot, s3Cols)

  // Top 10 debtors — A+B merged for "Cliente" to fill full sheet width
  const topDebtors = Object.values(debtorsMap)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)

  const debtorStart = 11
  writeSectionTitle(s3, debtorStart, 'Top 10 — Maiores Devedores', s3Cols)

  // Header row with A+B merged
  {
    const hdrRow = debtorStart + 1
    const hdr = s3.getRow(hdrRow)
    hdr.height = 26
    const hdrFont: Partial<ExcelJS.Font> = {
      bold: true,
      size: financialReportTokens.xlsx.fonts.subtitle,
      color: { argb: C.white },
    }
    const hdrFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: C.darkMed },
    }
    s3.mergeCells(`A${hdrRow}:B${hdrRow}`)
    hdr.getCell(1).value = 'Cliente'
    hdr.getCell(1).font = hdrFont
    hdr.getCell(1).fill = hdrFill
    hdr.getCell(1).border = thinBorder
    hdr.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
    hdr.getCell(2).fill = hdrFill
    hdr.getCell(2).border = thinBorder
    hdr.getCell(3).value = 'Valor em Atraso (R$)'
    hdr.getCell(3).font = hdrFont
    hdr.getCell(3).fill = hdrFill
    hdr.getCell(3).border = thinBorder
    hdr.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' }
    hdr.getCell(4).value = 'Dias Atraso'
    hdr.getCell(4).font = hdrFont
    hdr.getCell(4).fill = hdrFill
    hdr.getCell(4).border = thinBorder
    hdr.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' }
  }

  topDebtors.forEach((debtor, idx) => {
    const rowNum = debtorStart + 2 + idx
    const r = s3.getRow(rowNum)
    s3.mergeCells(`A${rowNum}:B${rowNum}`)
    r.getCell(1).value = debtor.name
    r.getCell(3).value = debtor.amount
    r.getCell(3).numFmt = '#,##0.00'
    r.getCell(4).value = debtor.days
    styleDataRow(r, idx, s3Cols)
    if (debtor.days > 90) {
      for (let c = 1; c <= s3Cols; c++) {
        r.getCell(c).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: C.redBg },
        }
        r.getCell(c).font = {
          size: financialReportTokens.xlsx.fonts.subtitle,
          bold: true,
          color: { argb: C.red },
        }
      }
    } else if (debtor.days > 60) {
      for (let c = 1; c <= s3Cols; c++) {
        r.getCell(c).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: C.yellowBg },
        }
      }
    }
  })

  const s3LastRow = debtorStart + 2 + Math.max(topDebtors.length, 1)
  writeSheetFooter(s3, s3LastRow, s3Cols)
  hideGridLines(s3)
  addFooter(s3)
  applyPrintSetup(s3)

  /* ================================================================ */
  /*  Sheet 4: Análise Tributária                                     */
  /* ================================================================ */
  const s4 = workbook.addWorksheet('Análise Tributária', {
    properties: { tabColor: { argb: C.green } },
  })
  const s4Cols = 6
  s4.columns = [
    { width: 30 },
    { width: 16 },
    { width: 20 },
    { width: 20 },
    { width: 18 },
    { width: 20 },
  ]

  writeBanner(s4, 1, 'Análise Tributária', s4Cols)
  writeSubBanner(
    s4,
    2,
    `${rows.length} lançamentos  |  ${meta.periodLabel}`,
    s4Cols
  )

  // By document type
  const DOC_TYPE_LABELS: Record<string, string> = {
    CNPJ: 'Pessoa Jurídica (CNPJ)',
    CPF: 'Pessoa Física (CPF)',
    CNI: 'Não Identificado',
  }

  const docTypeGroups: Record<
    string,
    { count: number; gross: number; net: number; totalTax: number }
  > = {}
  for (const row of rows) {
    const dt = row.taxDocumentType || 'CNI'
    if (!docTypeGroups[dt])
      docTypeGroups[dt] = { count: 0, gross: 0, net: 0, totalTax: 0 }
    docTypeGroups[dt].count += 1
    docTypeGroups[dt].gross += row.grossAmount
    docTypeGroups[dt].net += row.netAmount
    docTypeGroups[dt].totalTax += row.grossAmount - row.netAmount
  }

  writeSectionTitle(s4, 3, 'Por Tipo de Documento', s4Cols)
  writeTableHeader(s4, 4, [
    'Tipo',
    'Qtd',
    'Total Bruto',
    'Total Líquido',
    'Alíquota Média',
    'Total Retenção',
  ])

  const docTypeEntries = Object.entries(docTypeGroups)
  docTypeEntries.forEach(([dt, data], idx) => {
    const r = s4.getRow(5 + idx)
    const avgRate = data.gross > 0 ? (data.totalTax / data.gross) * 100 : 0
    r.values = [
      DOC_TYPE_LABELS[dt] || dt,
      data.count,
      data.gross,
      data.net,
      Number(avgRate.toFixed(2)),
      data.totalTax,
    ]
    r.getCell(3).numFmt = '#,##0.00'
    r.getCell(4).numFmt = '#,##0.00'
    r.getCell(5).numFmt = '0.00"%"'
    r.getCell(6).numFmt = '#,##0.00'
    styleDataRow(r, idx, s4Cols)
  })

  // By tax regime
  const regimeGroups: Record<
    string,
    { count: number; gross: number; net: number }
  > = {}
  for (const row of rows) {
    const regime = row.taxRegime || 'Não definido'
    if (!regimeGroups[regime])
      regimeGroups[regime] = { count: 0, gross: 0, net: 0 }
    regimeGroups[regime].count += 1
    regimeGroups[regime].gross += row.grossAmount
    regimeGroups[regime].net += row.netAmount
  }

  const regimeStart = 5 + docTypeEntries.length + 1
  // Fill the gap row between sections with white
  {
    const gapRow = regimeStart - 1
    const whiteFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: C.white },
    }
    for (let c = 1; c <= s4Cols; c++)
      s4.getRow(gapRow).getCell(c).fill = whiteFill
    s4.getRow(gapRow).height = 10
  }
  writeSectionTitle(s4, regimeStart, 'Por Regime Tributário', s4Cols)

  // Regime header: A+B merged for "Regime", C="Qtd", D="Total Bruto", E+F merged for "Total Líquido"
  {
    const hdrRow = regimeStart + 1
    const hdr = s4.getRow(hdrRow)
    hdr.height = 26
    const hFont: Partial<ExcelJS.Font> = {
      bold: true,
      size: financialReportTokens.xlsx.fonts.subtitle,
      color: { argb: C.white },
    }
    const hFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: C.darkMed },
    }
    const hAlign: Partial<ExcelJS.Alignment> = {
      vertical: 'middle',
      horizontal: 'center',
    }
    s4.mergeCells(`A${hdrRow}:B${hdrRow}`)
    hdr.getCell(1).value = 'Regime'
    hdr.getCell(1).font = hFont
    hdr.getCell(1).fill = hFill
    hdr.getCell(1).border = thinBorder
    hdr.getCell(1).alignment = hAlign
    hdr.getCell(2).fill = hFill
    hdr.getCell(2).border = thinBorder
    hdr.getCell(3).value = 'Qtd'
    hdr.getCell(3).font = hFont
    hdr.getCell(3).fill = hFill
    hdr.getCell(3).border = thinBorder
    hdr.getCell(3).alignment = hAlign
    hdr.getCell(4).value = 'Total Bruto'
    hdr.getCell(4).font = hFont
    hdr.getCell(4).fill = hFill
    hdr.getCell(4).border = thinBorder
    hdr.getCell(4).alignment = hAlign
    s4.mergeCells(`E${hdrRow}:F${hdrRow}`)
    hdr.getCell(5).value = 'Total Líquido'
    hdr.getCell(5).font = hFont
    hdr.getCell(5).fill = hFill
    hdr.getCell(5).border = thinBorder
    hdr.getCell(5).alignment = hAlign
    hdr.getCell(6).fill = hFill
    hdr.getCell(6).border = thinBorder
  }

  const regimeEntries = Object.entries(regimeGroups)
  regimeEntries.forEach(([regime, data], idx) => {
    const rowNum = regimeStart + 2 + idx
    const r = s4.getRow(rowNum)
    s4.mergeCells(`A${rowNum}:B${rowNum}`)
    r.getCell(1).value = regime
    r.getCell(3).value = data.count
    r.getCell(4).value = data.gross
    r.getCell(4).numFmt = '#,##0.00'
    s4.mergeCells(`E${rowNum}:F${rowNum}`)
    r.getCell(5).value = data.net
    r.getCell(5).numFmt = '#,##0.00'
    styleDataRow(r, idx, s4Cols)
  })

  // ISS + retention totals
  const totalISS = rows.reduce((s, r) => s + r.issAmount, 0)
  const totalTaxRetention = rows.reduce(
    (s, r) => s + (r.grossAmount - r.netAmount),
    0
  )

  const taxStart = regimeStart + 2 + regimeEntries.length + 1
  // Fill the gap row between sections with white
  {
    const gapRow = taxStart - 1
    const whiteFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: C.white },
    }
    for (let c = 1; c <= s4Cols; c++)
      s4.getRow(gapRow).getCell(c).fill = whiteFill
    s4.getRow(gapRow).height = 10
  }
  writeSectionTitle(s4, taxStart, 'Totais de Impostos', s4Cols)

  // Tax header: A-D merged for "Imposto", E+F merged for "Valor (R$)"
  {
    const hdrRow = taxStart + 1
    const hdr = s4.getRow(hdrRow)
    hdr.height = 26
    const hFont: Partial<ExcelJS.Font> = {
      bold: true,
      size: financialReportTokens.xlsx.fonts.subtitle,
      color: { argb: C.white },
    }
    const hFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: C.darkMed },
    }
    const hAlign: Partial<ExcelJS.Alignment> = {
      vertical: 'middle',
      horizontal: 'center',
    }
    s4.mergeCells(`A${hdrRow}:D${hdrRow}`)
    hdr.getCell(1).value = 'Imposto'
    hdr.getCell(1).font = hFont
    hdr.getCell(1).fill = hFill
    hdr.getCell(1).border = thinBorder
    hdr.getCell(1).alignment = hAlign
    for (let c = 2; c <= 4; c++) {
      hdr.getCell(c).fill = hFill
      hdr.getCell(c).border = thinBorder
    }
    s4.mergeCells(`E${hdrRow}:F${hdrRow}`)
    hdr.getCell(5).value = 'Valor (R$)'
    hdr.getCell(5).font = hFont
    hdr.getCell(5).fill = hFill
    hdr.getCell(5).border = thinBorder
    hdr.getCell(5).alignment = hAlign
    hdr.getCell(6).fill = hFill
    hdr.getCell(6).border = thinBorder
  }

  const taxItems = [
    ['ISS Total', totalISS],
    ['Total Retenções (IR + CSLL + PIS/COFINS)', totalTaxRetention],
    ['Valor Bruto Total', meta.totalGross],
    ['Valor Líquido Total', meta.totalNet],
  ] as const

  taxItems.forEach(([label, value], idx) => {
    const rowNum = taxStart + 2 + idx
    const r = s4.getRow(rowNum)
    s4.mergeCells(`A${rowNum}:D${rowNum}`)
    r.getCell(1).value = label
    s4.mergeCells(`E${rowNum}:F${rowNum}`)
    r.getCell(5).value = value
    r.getCell(5).numFmt = '#,##0.00'
    styleDataRow(r, idx, s4Cols)
    if (idx >= 2) {
      for (let c = 1; c <= s4Cols; c++) {
        r.getCell(c).font = {
          size: financialReportTokens.xlsx.fonts.subtitle,
          bold: true,
          color: { argb: C.gray900 },
        }
      }
    }
  })

  const s4FooterRow = taxStart + 2 + taxItems.length
  writeSheetFooter(s4, s4FooterRow, s4Cols)
  hideGridLines(s4)
  addFooter(s4)
  applyPrintSetup(s4)

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
