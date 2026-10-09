import PDFDocument from 'pdfkit'

export type DocumentIssuer = { name: string; document?: string | null }
export type QuoteDocument = {
  id: string
  quoteCode: string | null
  name: string
  email: string
  phone: string
  createdAt: Date
  validUntil: Date | null
  startDate: Date | null
  endDate: Date | null
  originalTotal: string | null
  total: string
  finalTotal: string | null
  message: string | null
  items: Array<{
    name: string
    quantity: number
    days: number
    pricePerDay: string
    total: string
  }>
}
const money = (value: string) =>
  Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const date = (value: Date) =>
  value.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
export function renderQuotePdf(
  quote: QuoteDocument,
  issuer: DocumentIssuer
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: 'A4',
      margin: 55,
      info: {
        Title: 'Orçamento ' + (quote.quoteCode ?? quote.id),
        Author: issuer.name,
      },
    })
    const chunks: Uint8Array[] = []
    pdf.on('data', (chunk: Uint8Array) => chunks.push(chunk))
    pdf.on('end', () => resolve(Buffer.concat(chunks)))
    pdf.on('error', reject)
    pdf
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(issuer.name, { align: 'center' })
    if (issuer.document)
      pdf
        .font('Helvetica')
        .fontSize(10)
        .text(issuer.document, { align: 'center' })
    pdf
      .moveDown()
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('ORÇAMENTO ' + (quote.quoteCode ?? quote.id))
    pdf
      .font('Helvetica')
      .fontSize(10)
      .moveDown()
      .text('Cliente: ' + quote.name)
    pdf.text('E-mail: ' + quote.email).text('Telefone: ' + quote.phone)
    pdf.text('Emissão: ' + date(quote.createdAt))
    if (quote.validUntil) pdf.text('Validade: ' + date(quote.validUntil))
    if (quote.startDate && quote.endDate)
      pdf.text(
        'Período: ' + date(quote.startDate) + ' a ' + date(quote.endDate)
      )
    pdf.moveDown().font('Helvetica-Bold').text('EQUIPAMENTOS').moveDown(0.5)
    for (const item of quote.items) {
      if (pdf.y > pdf.page.height - 120) pdf.addPage()
      pdf.font('Helvetica-Bold').text(item.name)
      pdf
        .font('Helvetica')
        .text(
          item.quantity +
            ' unidade(s) · ' +
            item.days +
            ' dia(s) · diária ' +
            money(item.pricePerDay)
        )
      pdf.text('Total do item: ' + money(item.total)).moveDown(0.7)
    }
    if (pdf.y > pdf.page.height - 150) pdf.addPage()
    if (
      quote.originalTotal &&
      quote.originalTotal !== (quote.finalTotal ?? quote.total)
    )
      pdf.text('Valor original: ' + money(quote.originalTotal))
    pdf
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('Valor total: ' + money(quote.finalTotal ?? quote.total))
      .moveDown()
    if (quote.message)
      pdf
        .font('Helvetica')
        .fontSize(10)
        .text('Observações: ' + quote.message)
    pdf.end()
  })
}
