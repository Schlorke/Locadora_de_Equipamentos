import { financialReportTokens } from '@gb-locacoes/design-tokens/documents'
const T = financialReportTokens.pdf
import PDFDocument from 'pdfkit'
function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}
import type { ExportRow } from '../billing/financial-report-types'
export async function buildProfessionalPdf(
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
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: T.margins,
      bufferPages: true,
    })

    const chunks: Uint8Array[] = []
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageWidth = doc.page.width - 35 - 35 // 525

    /* ---- Header ---- */
    doc
      .fontSize(T.fonts.title)
      .font('Helvetica-Bold')
      .text(meta.companyName, 35, 40)
    doc
      .fontSize(T.fonts.summary)
      .font('Helvetica')
      .text('Relatório Financeiro', 35, 60)
    doc
      .fontSize(T.fonts.note)
      .fillColor(T.colors.secondary)
      .text(
        `Gerado em: ${new Date().toLocaleString('pt-BR')} | Período: ${meta.periodLabel}`,
        35,
        75
      )

    /* ---- Separator ---- */
    doc
      .moveTo(35, 90)
      .lineTo(35 + pageWidth, 90)
      .strokeColor(T.colors.accent)
      .lineWidth(2)
      .stroke()

    /* ---- Summary box ---- */
    const summaryY = 100
    doc.fillColor(T.colors.text)

    const summaryItems = [
      { label: 'Total Bruto', value: fmtBRL(meta.totalGross) },
      { label: 'Total Líquido', value: fmtBRL(meta.totalNet) },
      { label: 'Total Pago', value: fmtBRL(meta.totalPaid) },
      { label: 'Total Pendente', value: fmtBRL(meta.totalPending) },
      { label: 'Lançamentos', value: String(rows.length) },
    ]

    const boxWidth = pageWidth / summaryItems.length
    summaryItems.forEach((item, i) => {
      const x = 35 + i * boxWidth
      doc
        .fontSize(T.fonts.header)
        .font('Helvetica')
        .fillColor(T.colors.secondary)
        .text(item.label, x, summaryY, { width: boxWidth, align: 'center' })
      doc
        .fontSize(T.fonts.subtitle)
        .font('Helvetica-Bold')
        .fillColor(T.colors.text)
        .text(item.value, x, summaryY + 11, {
          width: boxWidth,
          align: 'center',
        })
    })

    /* ---- Separator ---- */
    doc
      .moveTo(35, summaryY + 28)
      .lineTo(35 + pageWidth, summaryY + 28)
      .strokeColor(T.colors.border)
      .lineWidth(0.5)
      .stroke()

    /* ---- Table ---- */
    const tableTop = summaryY + 38
    const columns = [
      { header: 'Código', width: 55, key: 'quoteCode' as const },
      { header: 'Cliente', width: 90, key: 'customerName' as const },
      { header: 'CNPJ/CPF', width: 70, key: 'customerDocument' as const },
      { header: 'V. Bruto', width: 55, key: 'grossAmount' as const },
      { header: 'V. Líquido', width: 55, key: 'netAmount' as const },
      { header: 'Nº Nota', width: 45, key: 'invoiceNumber' as const },
      { header: 'Vencimento', width: 55, key: 'dueDate' as const },
      { header: 'Pagamento', width: 55, key: 'paidAt' as const },
      { header: 'Status', width: 45, key: 'billingStatusLabel' as const },
    ]

    const rowHeight = 16
    const headerHeight = 18
    const bottomMargin = 40

    function drawTableHeader(y: number) {
      /* Header bg */
      doc.rect(35, y, pageWidth, headerHeight).fill(T.colors.accent)

      let x = 35
      doc
        .fontSize(T.fonts.header)
        .font('Helvetica-Bold')
        .fillColor(T.colors.onStrong)
      for (const col of columns) {
        doc.text(col.header, x + 3, y + 5, {
          width: col.width - 6,
          align: 'left',
        })
        x += col.width
      }
      return y + headerHeight
    }

    function drawTableRow(row: ExportRow, y: number, idx: number) {
      /* Alternate row bg */
      if (idx % 2 === 0) {
        doc.rect(35, y, pageWidth, rowHeight).fill(T.colors.alternate)
      }

      let x = 35
      doc.fontSize(T.fonts.row).font('Helvetica').fillColor(T.colors.strong)

      for (const col of columns) {
        let text: string
        if (col.key === 'grossAmount') {
          text = fmtBRL(row.grossAmount)
        } else if (col.key === 'netAmount') {
          text = fmtBRL(row.netAmount)
        } else {
          text = String(row[col.key] || '-')
        }
        // Truncate long text
        if (text.length > 22) text = text.slice(0, 20) + '..'
        doc.text(text, x + 3, y + 4, {
          width: col.width - 6,
          align:
            col.key === 'grossAmount' || col.key === 'netAmount'
              ? 'right'
              : 'left',
        })
        x += col.width
      }
      return y + rowHeight
    }

    let currentY = drawTableHeader(tableTop)

    for (let i = 0; i < rows.length; i++) {
      /* Check if we need a new page */
      if (currentY + rowHeight > doc.page.height - bottomMargin) {
        doc.addPage()
        currentY = drawTableHeader(40)
      }
      currentY = drawTableRow(rows[i]!, currentY, i)
    }

    /* ---- Totals row ---- */
    if (currentY + rowHeight + 4 > doc.page.height - bottomMargin) {
      doc.addPage()
      currentY = 40
    }

    doc
      .moveTo(35, currentY + 2)
      .lineTo(35 + pageWidth, currentY + 2)
      .strokeColor(T.colors.accent)
      .lineWidth(1)
      .stroke()

    currentY += 6
    doc.fontSize(T.fonts.header).font('Helvetica-Bold').fillColor(T.colors.text)

    let tx = 35
    for (const col of columns) {
      let text = ''
      if (col.key === 'quoteCode') text = 'TOTAIS'
      else if (col.key === 'customerName') text = `${rows.length} registros`
      else if (col.key === 'grossAmount') text = fmtBRL(meta.totalGross)
      else if (col.key === 'netAmount') text = fmtBRL(meta.totalNet)
      doc.text(text, tx + 3, currentY + 2, {
        width: col.width - 6,
        align:
          col.key === 'grossAmount' || col.key === 'netAmount'
            ? 'right'
            : 'left',
      })
      tx += col.width
    }

    /* ---- Tax footnotes ---- */
    currentY += 20
    if (currentY + 40 > doc.page.height - bottomMargin) {
      doc.addPage()
      currentY = 40
    }
    doc
      .fontSize(T.fonts.row)
      .font('Helvetica')
      .fillColor(T.colors.muted)
      .text(
        '* ISS: Isento para locação pura de bens móveis (Súmula Vinculante 31 - STF)',
        35,
        currentY
      )
    doc.text(
      '* ICMS: Isento - locação não configura circulação de mercadoria',
      35,
      currentY + 9
    )
    doc.text(
      '* Retenção na fonte: Não incide sobre locação pura (Solução de Consulta COSIT 410/2017)',
      35,
      currentY + 18
    )

    /* ---- Page numbers ---- */
    const pages = doc.bufferedPageRange()
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i)
      doc
        .fontSize(T.fonts.header)
        .font('Helvetica')
        .fillColor(T.colors.footer)
        .text(`Página ${i + 1} de ${pages.count}`, 35, doc.page.height - 25, {
          width: pageWidth,
          align: 'center',
        })
    }

    doc.end()
  })
}
