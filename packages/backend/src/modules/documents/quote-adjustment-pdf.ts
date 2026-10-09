import PDFDocument from 'pdfkit'
import type { DocumentIssuer } from './quote-pdf'

export function renderQuoteAdjustmentPdf(
  quote: {
    id: string
    quoteCode: string | null
    name: string
    email: string
    company: string | null
    total: number | { toString: () => string } // Decimal
    finalTotal: number | { toString: () => string } | null
    originalTotal: number | { toString: () => string } | null // Decimal | null
    priceAdjustmentReason: string | null
    adjustments: Array<{
      id: string
      category: string
      amount: number | { toString: () => string } // Decimal
      justification: string
      createdAt: Date
    }>
  },
  issuer: DocumentIssuer
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 100, left: 60, right: 60 },
      info: {
        Title: 'Reajuste ' + (quote.quoteCode ?? quote.id),
        Author: issuer.name,
      },
      bufferPages: true,
    })

    const chunks: Uint8Array[] = []
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageWidth = doc.page.width - 60 - 60 // 495

    /* ---- Cabeçalho ---- */
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(issuer.name, { align: 'center' })
    doc.moveDown(0.3)
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(issuer.document || 'Locação de equipamentos', { align: 'center' })

    doc.moveDown(1.5)

    // Título do documento
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('OFÍCIO DE REAJUSTE DE ORÇAMENTO', { align: 'center' })

    doc.moveDown(1.5)

    // Linha separadora
    doc
      .moveTo(60, doc.y)
      .lineTo(pageWidth + 60, doc.y)
      .stroke()

    doc.moveDown(1)

    /* ---- Informações do Orçamento ---- */
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('DADOS DO ORÇAMENTO', { underline: true })
    doc.moveDown(0.5)

    doc
      .font('Helvetica-Bold')
      .text('Código do Orçamento: ', { continued: true })
    doc.font('Helvetica').text(quote.quoteCode || quote.id)

    doc.font('Helvetica-Bold').text('Cliente: ', { continued: true })
    doc.font('Helvetica').text(quote.name || 'Não informado')

    if (quote.company) {
      doc.font('Helvetica-Bold').text('Empresa: ', { continued: true })
      doc.font('Helvetica').text(quote.company)
    }

    doc.font('Helvetica-Bold').text('E-mail: ', { continued: true })
    doc.font('Helvetica').text(quote.email || 'Não informado')

    doc.moveDown(1)

    /* ---- Valores ---- */
    const originalTotal = quote.originalTotal
      ? Number(quote.originalTotal)
      : Number(quote.total)
    const finalTotal = Number(quote.finalTotal ?? quote.total)
    const totalAdjustment = finalTotal - originalTotal

    doc.font('Helvetica-Bold').text('VALORES', { underline: true })
    doc.moveDown(0.5)

    doc.font('Helvetica-Bold').text('Valor Original: ', { continued: true })
    doc.font('Helvetica').text(
      originalTotal.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
    )

    doc.font('Helvetica-Bold').text('Valor Reajustado: ', { continued: true })
    doc
      .font('Helvetica')
      .fillColor('#16a34a')
      .text(
        finalTotal.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })
      )

    doc.fillColor('#000000')
    doc.font('Helvetica-Bold').text('Diferença Total: ', { continued: true })
    doc
      .font('Helvetica')
      .fillColor(totalAdjustment >= 0 ? '#16a34a' : '#dc2626')
      .text(
        totalAdjustment.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })
      )

    doc.fillColor('#000000')
    doc.moveDown(1.5)

    /* ---- Tabela de Reajustes ---- */
    doc
      .font('Helvetica-Bold')
      .text('DETALHAMENTO DOS REAJUSTES', { underline: true })
    doc.moveDown(0.5)

    const columns = { category: 110, amount: 70, reason: 190, date: 80 }
    const header = (top: number) => {
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .rect(60, top, pageWidth, 20)
        .fill('#1f2937')
      doc
        .fillColor('#ffffff')
        .text('Categoria', 65, top + 6, { width: columns.category })
        .text('Valor', 185, top + 6, { width: columns.amount })
        .text('Justificativa', 265, top + 6, { width: columns.reason })
        .text('Data', 465, top + 6, { width: columns.date })
      doc.font('Helvetica').fillColor('#000000')
      return top + 25
    }
    const splitToHeight = (text: string, height: number): [string, string] => {
      if (doc.heightOfString(text, { width: columns.reason }) <= height)
        return [text, '']
      let low = 1,
        high = text.length
      while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        if (
          doc.heightOfString(text.slice(0, middle), {
            width: columns.reason,
          }) <= height
        )
          low = middle
        else high = middle - 1
      }
      const space = text.lastIndexOf(' ', low)
      const cut = space > 0 ? space : low
      return [text.slice(0, cut), text.slice(cut).trimStart()]
    }
    let yPosition = header(doc.y)
    quote.adjustments.forEach((adjustment, index) => {
      let remaining = adjustment.justification || '-'
      let continued = false
      do {
        if (yPosition > doc.page.height - 155) {
          doc.addPage()
          yPosition = header(50)
        }
        doc.font('Helvetica').fontSize(9)
        const maxHeight = doc.page.height - 120 - yPosition
        const [chunk, rest] = splitToHeight(remaining, maxHeight)
        const label =
          getCategoryLabel(adjustment.category) + (continued ? ' (cont.)' : '')
        const rowHeight =
          Math.max(
            25,
            doc.heightOfString(chunk, { width: columns.reason }),
            doc.heightOfString(label, { width: columns.category })
          ) + 10
        doc
          .rect(60, yPosition - 5, pageWidth, rowHeight)
          .fill(index % 2 === 0 ? '#f9fafb' : '#ffffff')
        doc
          .fillColor('#000000')
          .text(label, 65, yPosition, { width: columns.category })
        if (!continued) {
          const amount = Number(adjustment.amount)
          doc
            .fillColor(amount >= 0 ? '#16a34a' : '#dc2626')
            .text(
              amount.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }),
              185,
              yPosition,
              { width: columns.amount }
            )
          doc
            .fillColor('#000000')
            .text(
              new Date(adjustment.createdAt).toLocaleDateString('pt-BR'),
              465,
              yPosition,
              { width: columns.date }
            )
        }
        doc
          .fillColor('#000000')
          .text(chunk, 265, yPosition, { width: columns.reason })
        yPosition += rowHeight + 5
        remaining = rest
        continued = true
      } while (remaining)
    })
    doc.x = 60
    doc.y = yPosition + 15
    if (quote.priceAdjustmentReason) {
      if (doc.y > doc.page.height - 170) doc.addPage()
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('OBSERVAÇÕES GERAIS', 60, doc.y, { width: pageWidth })
      doc
        .moveDown(0.3)
        .fontSize(9)
        .font('Helvetica')
        .text(quote.priceAdjustmentReason, {
          width: pageWidth,
          align: 'justify',
        })
    }
    const pageRange = doc.bufferedPageRange()
    const issuedAt = new Date().toLocaleString('pt-BR')
    for (
      let page = pageRange.start;
      page < pageRange.start + pageRange.count;
      page++
    ) {
      doc.switchToPage(page)
      const bottomMargin = doc.page.margins.bottom
      doc.page.margins.bottom = 0
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#666666')
        .text('Documento gerado em ' + issuedAt, 60, doc.page.height - 80, {
          width: pageWidth,
          align: 'center',
          lineBreak: false,
        })
        .fontSize(7)
        .text(
          issuer.name + ' · ' + (page + 1) + '/' + pageRange.count,
          60,
          doc.page.height - 65,
          { width: pageWidth, align: 'center', lineBreak: false }
        )
      doc.page.margins.bottom = bottomMargin
    }

    // Finalizar documento
    doc.end()
  })
}

/* ---------- Helper Functions ---------- */

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    LABOR: 'Mão de Obra',
    TRANSPORT: 'Deslocamento',
    MAINTENANCE: 'Manutenção',
    EXTENSION: 'Extensão de Período',
    DISCOUNT: 'Desconto',
    OTHER: 'Outro',
  }

  return labels[category] || category
}
