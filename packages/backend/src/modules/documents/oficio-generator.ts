/**
 * Generates the Ofício (Billing Report) PDF using pdfkit.
 * Preserves the existing A4 layout with the current tenant's identity.
 */
import PDFDocument from 'pdfkit'
import { PLATFORM } from '@gb-locacoes/contracts/platform'

import { OFICIO_COLORS, OFICIO_LAYOUT } from './oficio-styles'
import type { OficioData } from './oficio-types'

/* ---------- helpers ---------- */

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtPercent(n: number): string {
  return (
    n.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + '%'
  )
}

type Doc = InstanceType<typeof PDFDocument>

const L = OFICIO_LAYOUT
const C = OFICIO_COLORS

/* ---------- Main generator ---------- */

export async function generateOficioPdf(data: OficioData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []

    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: L.marginTop,
        bottom: L.marginBottom,
        left: L.marginLeft,
        right: L.marginRight,
      },
      info: {
        Title: `Ofício - ${data.cliente.codigo}`,
        Author: data.empresa.razaoSocial,
        Subject: 'Relatório de Faturamento',
        Creator: PLATFORM.displayName + ' SaaS',
      },
      bufferPages: true,
    })

    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const contentWidth = L.pageWidth - L.marginLeft - L.marginRight

    // Track Y position
    let y: number = L.marginTop

    // ─── HEADER BAR ───────────────────────────────────────────
    y = drawHeader(doc, data, contentWidth, y)

    // ─── CLIENT INFO BLOCK ────────────────────────────────────
    y = drawClientInfo(doc, data, contentWidth, y)

    // ─── RENTAL TABLE ─────────────────────────────────────────
    if (data.itensLocacao.length > 0) {
      y = checkPageBreak(doc, y, 120)
      y = drawRentalTable(doc, data, contentWidth, y)
    }

    // ─── SERVICE TABLE ────────────────────────────────────────
    if (data.itensServico.length > 0) {
      y = checkPageBreak(doc, y, 100)
      y = drawServiceTable(doc, data, contentWidth, y)
    }

    // ─── FINANCIAL SUMMARY ────────────────────────────────────
    y = checkPageBreak(doc, y, 120)
    y = drawFinancialSummary(doc, data, contentWidth, y)

    // ─── OBSERVATIONS ─────────────────────────────────────────
    if (data.observacoes) {
      y = checkPageBreak(doc, y, 60)
      drawObservations(doc, data, contentWidth, y)
    }

    // ─── PREVIEW WATERMARK ────────────────────────────────────
    if (data.preview) {
      drawWatermark(doc)
    }

    // ─── FOOTERS ON ALL PAGES ─────────────────────────────────
    drawFooters(doc, data, contentWidth)

    doc.end()
  })
}

/* ══════════════════════════════════════════════════════════════
 * SECTION RENDERERS
 * ══════════════════════════════════════════════════════════════ */

function drawHeader(
  doc: Doc,
  data: OficioData,
  contentWidth: number,
  y: number
): number {
  const headerHeight = 52

  // Orange bar
  doc.rect(L.marginLeft, y, contentWidth, headerHeight).fill(C.headerBg)

  // Title
  doc
    .font('Helvetica-Bold')
    .fontSize(L.titleSize)
    .fillColor(C.headerText)
    .text('RELATÓRIO DE FATURAMENTO', L.marginLeft + 14, y + 8, {
      width: contentWidth - 28,
    })

  // Company name + CNPJ
  doc
    .font('Helvetica')
    .fontSize(9)
    .text(
      `${data.empresa.razaoSocial}  •  CNPJ: ${data.empresa.cnpj}`,
      L.marginLeft + 14,
      y + 30,
      { width: contentWidth - 28 }
    )

  return y + headerHeight + L.sectionGap
}

function drawClientInfo(
  doc: Doc,
  data: OficioData,
  contentWidth: number,
  y: number
): number {
  const c = data.cliente
  const startY = y

  // Background rect (we'll adjust height after drawing)
  const bgX = L.marginLeft
  const paddingX = 10
  const paddingY = 8
  const innerWidth = contentWidth - paddingX * 2
  const col1 = innerWidth * 0.5
  const col2 = innerWidth * 0.5

  // Section label
  doc
    .font('Helvetica-Bold')
    .fontSize(L.sectionHeaderSize)
    .fillColor(C.sectionBg)
    .text('DADOS DO CLIENTE', L.marginLeft + paddingX, y + paddingY, {
      width: innerWidth,
    })

  y += paddingY + 18

  // Draw field pairs in two columns
  const fields: Array<[string, string, string?, string?]> = [
    ['CÓD:', c.codigo, 'DOC:', `${c.documento} (${c.tipoDocumento})`],
    ['RAZÃO:', c.razaoSocial, '', ''],
    ['OBRA:', c.obra, 'MÊS/ANO:', `${c.mesReferencia} / ${c.anoReferencia}`],
    ['CONTATO:', c.contato, 'FORMA:', c.forma],
    ['APROVAÇÃO:', c.aprovacao, 'FATURA:', c.fatura],
    ['BOLETO:', c.boleto, 'NOTA:', c.nota],
    ['ENDEREÇO:', c.endereco, '', ''],
    ['END. COBRANÇA:', c.enderecoCobranca, '', ''],
  ]

  const lineH = 14

  for (const [label1, value1, label2, value2] of fields) {
    const x1 = L.marginLeft + paddingX
    const x2 = L.marginLeft + paddingX + col1

    // Left column
    doc
      .font('Helvetica-Bold')
      .fontSize(L.labelSize)
      .fillColor(C.textSecondary)
      .text(label1, x1, y, { width: 85, continued: false })

    doc
      .font('Helvetica')
      .fontSize(L.valueSize)
      .fillColor(C.textPrimary)
      .text(value1 || '-', x1 + 85, y, { width: col1 - 90 })

    // Right column
    if (label2) {
      doc
        .font('Helvetica-Bold')
        .fontSize(L.labelSize)
        .fillColor(C.textSecondary)
        .text(label2, x2, y, { width: 70, continued: false })

      doc
        .font('Helvetica')
        .fontSize(L.valueSize)
        .fillColor(C.textPrimary)
        .text(value2 || '-', x2 + 70, y, { width: col2 - 75 })
    }

    y += lineH
  }

  y += paddingY

  // Draw border around the block
  const blockHeight = y - startY
  doc
    .rect(bgX, startY, contentWidth, blockHeight)
    .strokeColor(C.border)
    .lineWidth(0.5)
    .stroke()

  return y + L.sectionGap * 0.5
}

function drawRentalTable(
  doc: Doc,
  data: OficioData,
  contentWidth: number,
  y: number
): number {
  const items = data.itensLocacao
  const subtotal = data.resumo.locacao

  // Section header
  y = drawSectionHeader(doc, 'LOCAÇÃO', fmtBRL(subtotal), contentWidth, y)

  // Table header
  const cols = [
    { label: 'N', width: contentWidth * 0.05, align: 'center' as const },
    { label: 'Equipamento', width: contentWidth * 0.3, align: 'left' as const },
    { label: 'Início', width: contentWidth * 0.12, align: 'center' as const },
    { label: 'Fim', width: contentWidth * 0.12, align: 'center' as const },
    { label: 'Qt.', width: contentWidth * 0.07, align: 'center' as const },
    { label: 'Dias', width: contentWidth * 0.07, align: 'center' as const },
    { label: 'Valor', width: contentWidth * 0.15, align: 'right' as const },
    { label: 'Situação', width: contentWidth * 0.12, align: 'center' as const },
  ]

  y = drawTableHeader(doc, cols, contentWidth, y)

  // Table rows
  for (let i = 0; i < items.length; i++) {
    y = checkPageBreak(doc, y, 16)
    const item = items[i]!
    const rowData = [
      String(item.index).padStart(2, '0'),
      item.equipamento,
      item.inicio,
      item.fim,
      String(item.quantidade),
      String(item.dias),
      fmtBRL(item.valor),
      item.situacao,
    ]
    y = drawTableRow(doc, cols, rowData, contentWidth, y, i % 2 === 0)
  }

  // Bottom border
  doc
    .moveTo(L.marginLeft, y)
    .lineTo(L.marginLeft + contentWidth, y)
    .strokeColor(C.border)
    .lineWidth(0.5)
    .stroke()

  return y + L.sectionGap
}

function drawServiceTable(
  doc: Doc,
  data: OficioData,
  contentWidth: number,
  y: number
): number {
  const items = data.itensServico
  const subtotal = data.resumo.servicos

  // Section header
  y = drawSectionHeader(doc, 'SERVIÇOS', fmtBRL(subtotal), contentWidth, y)

  // Table header
  const cols = [
    { label: 'N', width: contentWidth * 0.05, align: 'center' as const },
    { label: 'Serviço', width: contentWidth * 0.25, align: 'left' as const },
    { label: 'Data', width: contentWidth * 0.12, align: 'center' as const },
    { label: 'Descrição', width: contentWidth * 0.22, align: 'left' as const },
    { label: 'Qt.', width: contentWidth * 0.07, align: 'center' as const },
    { label: 'Unit.', width: contentWidth * 0.14, align: 'right' as const },
    { label: 'Valor', width: contentWidth * 0.15, align: 'right' as const },
  ]

  y = drawTableHeader(doc, cols, contentWidth, y)

  for (let i = 0; i < items.length; i++) {
    y = checkPageBreak(doc, y, 16)
    const item = items[i]!
    const rowData = [
      String(item.index).padStart(2, '0'),
      item.servico,
      item.data,
      item.descricao.slice(0, 40),
      String(item.quantidade),
      fmtBRL(item.valorUnitario),
      fmtBRL(item.valorTotal),
    ]
    y = drawTableRow(doc, cols, rowData, contentWidth, y, i % 2 === 0)
  }

  // Bottom border
  doc
    .moveTo(L.marginLeft, y)
    .lineTo(L.marginLeft + contentWidth, y)
    .strokeColor(C.border)
    .lineWidth(0.5)
    .stroke()

  return y + L.sectionGap
}

function drawFinancialSummary(
  doc: Doc,
  data: OficioData,
  contentWidth: number,
  y: number
): number {
  const r = data.resumo

  // Section header
  y = drawSectionHeader(doc, 'RESUMO FINANCEIRO', '', contentWidth, y)

  // Summary table columns
  const cols = [
    { label: '', width: contentWidth * 0.22, align: 'left' as const },
    { label: 'Valor', width: contentWidth * 0.22, align: 'right' as const },
    { label: 'Retenção', width: contentWidth * 0.22, align: 'right' as const },
    { label: 'Alíquota', width: contentWidth * 0.17, align: 'right' as const },
    {
      label: 'Observações',
      width: contentWidth * 0.17,
      align: 'left' as const,
    },
  ]

  y = drawTableHeader(doc, cols, contentWidth, y)

  // Row: Bruto
  y = drawTableRow(
    doc,
    cols,
    [
      'Bruto',
      fmtBRL(r.bruto),
      fmtBRL(r.retencaoTotal),
      fmtPercent(r.retencaoTotalPercent),
      '',
    ],
    contentWidth,
    y,
    false,
    true
  )

  // Row: Locação
  y = drawTableRow(
    doc,
    cols,
    [
      'Locação',
      fmtBRL(r.locacao),
      fmtBRL(r.retencaoLocacao),
      fmtPercent(r.retencaoLocacaoPercent),
      '',
    ],
    contentWidth,
    y,
    true
  )

  // Row: Serviços (only if they exist)
  if (r.servicos > 0) {
    y = drawTableRow(
      doc,
      cols,
      [
        'Serviços',
        fmtBRL(r.servicos),
        fmtBRL(r.retencaoServicos),
        fmtPercent(r.retencaoServicosPercent),
        '',
      ],
      contentWidth,
      y,
      false
    )
  }

  // Separator line
  doc
    .moveTo(L.marginLeft, y)
    .lineTo(L.marginLeft + contentWidth, y)
    .strokeColor(C.sectionBg)
    .lineWidth(1.5)
    .stroke()

  y += 4

  // TOTAL LÍQUIDO row (highlighted)
  const totalRowH = 22
  doc.rect(L.marginLeft, y, contentWidth, totalRowH).fill(C.sectionBg)

  doc
    .font('Helvetica-Bold')
    .fontSize(L.totalRowSize)
    .fillColor(C.sectionText)
    .text('LÍQUIDO', L.marginLeft + 8, y + 5, {
      width: contentWidth * 0.22 - 8,
    })

  doc.text(fmtBRL(r.liquido), L.marginLeft + contentWidth * 0.22, y + 5, {
    width: contentWidth * 0.22,
    align: 'right',
  })

  y += totalRowH

  // Bottom border
  doc
    .moveTo(L.marginLeft, y)
    .lineTo(L.marginLeft + contentWidth, y)
    .strokeColor(C.border)
    .lineWidth(0.5)
    .stroke()

  // Tax footnotes
  y += 8
  doc
    .font('Helvetica')
    .fontSize(6.5)
    .fillColor(C.textMuted)
    .text(
      '* ISS: Isento para locação pura de bens móveis (Súmula Vinculante 31 - STF)',
      L.marginLeft,
      y
    )
  y += 9
  doc.text(
    '* ICMS: Isento — locação não configura circulação de mercadoria',
    L.marginLeft,
    y
  )
  y += 9
  doc.text(
    '* Retenção na fonte: conforme tipo de documento fiscal do tomador',
    L.marginLeft,
    y
  )

  return y + L.sectionGap
}

function drawObservations(
  doc: Doc,
  data: OficioData,
  contentWidth: number,
  y: number
): number {
  // Header
  doc
    .font('Helvetica-Bold')
    .fontSize(L.sectionHeaderSize)
    .fillColor(C.sectionBg)
    .text('OBSERVAÇÕES', L.marginLeft, y)

  y += 16

  doc
    .font('Helvetica')
    .fontSize(L.valueSize)
    .fillColor(C.textPrimary)
    .text(data.observacoes, L.marginLeft, y, {
      width: contentWidth,
      lineGap: 2,
    })

  y = doc.y + L.sectionGap

  return y
}

/* ══════════════════════════════════════════════════════════════
 * SHARED TABLE PRIMITIVES
 * ══════════════════════════════════════════════════════════════ */

type ColDef = {
  label: string
  width: number
  align: 'left' | 'center' | 'right'
}

function drawSectionHeader(
  doc: Doc,
  title: string,
  rightValue: string,
  contentWidth: number,
  y: number
): number {
  const h = 20
  doc.rect(L.marginLeft, y, contentWidth, h).fill(C.sectionBg)

  doc
    .font('Helvetica-Bold')
    .fontSize(L.sectionHeaderSize)
    .fillColor(C.sectionText)
    .text(title, L.marginLeft + 8, y + 4, { width: contentWidth * 0.5 })

  if (rightValue) {
    doc.text(rightValue, L.marginLeft + contentWidth * 0.5, y + 4, {
      width: contentWidth * 0.5 - 8,
      align: 'right',
    })
  }

  return y + h
}

function drawTableHeader(
  doc: Doc,
  cols: ColDef[],
  contentWidth: number,
  y: number
): number {
  const h = 16

  // Light gray background for header
  doc.rect(L.marginLeft, y, contentWidth, h).fill(C.borderLight)

  let x = L.marginLeft

  for (const col of cols) {
    doc
      .font('Helvetica-Bold')
      .fontSize(L.tableHeaderSize)
      .fillColor(C.textPrimary)
      .text(col.label, x + 4, y + 4, {
        width: col.width - 8,
        align: col.align,
      })
    x += col.width
  }

  // Border below header
  doc
    .moveTo(L.marginLeft, y + h)
    .lineTo(L.marginLeft + contentWidth, y + h)
    .strokeColor(C.border)
    .lineWidth(0.5)
    .stroke()

  return y + h
}

function drawTableRow(
  doc: Doc,
  cols: ColDef[],
  values: string[],
  contentWidth: number,
  y: number,
  alternate: boolean,
  bold = false
): number {
  const h = 16

  if (alternate) {
    doc.rect(L.marginLeft, y, contentWidth, h).fill(C.altRow)
  }

  let x = L.marginLeft

  for (let i = 0; i < cols.length; i++) {
    const col = cols[i]!
    const val = values[i] || ''

    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(L.tableBodySize)
      .fillColor(C.textPrimary)
      .text(val, x + 4, y + 4, {
        width: col.width - 8,
        align: col.align,
        lineBreak: false,
      })

    x += col.width
  }

  return y + h
}

/* ══════════════════════════════════════════════════════════════
 * UTILITIES
 * ══════════════════════════════════════════════════════════════ */

function checkPageBreak(doc: Doc, y: number, needed: number): number {
  if (y + needed > L.pageHeight - L.marginBottom - 30) {
    doc.addPage()
    return L.marginTop
  }
  return y
}

function drawWatermark(doc: Doc): void {
  const pages = doc.bufferedPageRange()
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i)

    doc.save()
    doc
      .font('Helvetica-Bold')
      .fontSize(50)
      .fillColor(C.headerBg)
      .opacity(0.08)
      .translate(L.pageWidth / 2, L.pageHeight / 2)
      .rotate(-45, { origin: [0, 0] })
      .text('PRÉVIA', -130, -25, { width: 300, align: 'center' })
    doc.restore()
  }
}

function drawFooters(doc: Doc, data: OficioData, contentWidth: number): void {
  const pages = doc.bufferedPageRange()
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i)

    const footerY = L.pageHeight - L.marginBottom - 5

    // Separator line
    doc
      .moveTo(L.marginLeft, footerY - 8)
      .lineTo(L.marginLeft + contentWidth, footerY - 8)
      .strokeColor(C.borderLight)
      .lineWidth(0.3)
      .stroke()

    doc
      .font('Helvetica')
      .fontSize(L.footerSize)
      .fillColor(C.textMuted)
      .opacity(1)
      .text(
        `${data.empresa.razaoSocial}  •  CNPJ: ${data.empresa.cnpj}  •  ${data.empresa.cidade}/${data.empresa.estado}`,
        L.marginLeft,
        footerY,
        { width: contentWidth * 0.7, align: 'left' }
      )

    doc.text(
      `Gerado em: ${data.geradoEm}  •  Página ${i + 1}/${pages.count}`,
      L.marginLeft + contentWidth * 0.5,
      footerY,
      { width: contentWidth * 0.5, align: 'right' }
    )
  }
}
