// ==========================================
// San Javier Academy Manager - Generación de PDFs
// ==========================================

import jsPDF from 'jspdf'

// --- Interfaces de datos para los informes ---

export interface PaymentReportRow {
  playerName: string
  groupName: string
  concept: string
  amount: number
  status: string
  paidDate?: string
  paymentMethod?: string
}

export interface MonthlyReportData {
  clubName: string
  month: number
  year: number
  payments: PaymentReportRow[]
  totalIngresos: number
  totalPendiente: number
  tasaCobro: number
  totalRecibos: number
}

export interface PlayerHistoryData {
  clubName: string
  playerName: string
  playerDni: string
  playerEmail: string
  playerPhone: string
  payments: PaymentReportRow[]
  totalPaid: number
  totalPending: number
}

export interface AnnualReportData {
  clubName: string
  year: number
  monthlyData: {
    month: string
    ingresos: number
    pendiente: number
    recibos: number
  }[]
  totalIngresos: number
  totalPendiente: number
  totalRecibos: number
}

// --- Constantes de diseño ---

const MARGIN = 20
const PAGE_WIDTH = 210 // A4 width in mm
const PAGE_HEIGHT = 297 // A4 height in mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const FONT_SIZE = {
  title: 18,
  subtitle: 14,
  normal: 10,
  small: 8,
} as const

const COLORS = {
  headerBg: { r: 30, g: 64, b: 175 } as const, // blue-800 (#1e40af)
  headerText: { r: 255, g: 255, b: 255 } as const,
  rowAlt: { r: 245, g: 247, b: 250 } as const,
  border: { r: 200, g: 200, b: 200 } as const,
  text: { r: 30, g: 30, b: 30 } as const,
  muted: { r: 120, g: 120, b: 120 } as const,
  success: { r: 22, g: 163, b: 74 } as const,
  warning: { r: 234, g: 88, b: 12 } as const,
} as const

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// --- Utilidades ---

function formatCurrencyPdf(amount: number): string {
  return amount.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' \u20AC'
}

function formatPercentPdf(value: number): string {
  return value.toFixed(1) + ' %'
}

function getGeneratedDateString(): string {
  const now = new Date()
  const day = String(now.getDate()).padStart(2, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const year = now.getFullYear()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${minutes}`
}

// --- Funciones de dibujo reutilizables ---

function drawHeader(doc: jsPDF, clubName: string, title: string, subtitle?: string): number {
  let y = MARGIN

  // Club name
  doc.setFontSize(FONT_SIZE.title)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(COLORS.headerBg.r, COLORS.headerBg.g, COLORS.headerBg.b)
  doc.text(clubName, MARGIN, y + 6)
  y += 12

  // Divider line
  doc.setDrawColor(COLORS.headerBg.r, COLORS.headerBg.g, COLORS.headerBg.b)
  doc.setLineWidth(0.8)
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y)
  y += 8

  // Report title
  doc.setFontSize(FONT_SIZE.subtitle)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b)
  doc.text(title, MARGIN, y + 4)
  y += 10

  // Optional subtitle
  if (subtitle) {
    doc.setFontSize(FONT_SIZE.normal)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b)
    doc.text(subtitle, MARGIN, y + 3)
    y += 8
  }

  y += 4
  return y
}

function drawFooter(doc: jsPDF, pageNumber: number, totalPages: number): void {
  const y = PAGE_HEIGHT - MARGIN + 5

  doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y - 4, MARGIN + CONTENT_WIDTH, y - 4)

  doc.setFontSize(FONT_SIZE.small)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b)

  doc.text(`Generado: ${getGeneratedDateString()}`, MARGIN, y)
  doc.text(
    `P\u00E1gina ${pageNumber} de ${totalPages}`,
    MARGIN + CONTENT_WIDTH,
    y,
    { align: 'right' }
  )
}

function addFootersToAllPages(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawFooter(doc, i, totalPages)
  }
}

/**
 * Truncate text to fit within a given width.
 */
function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) {
    return text
  }
  let truncated = text
  while (truncated.length > 0 && doc.getTextWidth(truncated + '...') > maxWidth) {
    truncated = truncated.slice(0, -1)
  }
  return truncated + '...'
}

/**
 * Reusable table drawing function.
 * Returns the Y position after the table.
 */
function drawTable(
  doc: jsPDF,
  headers: string[],
  rows: string[][],
  startX: number,
  startY: number,
  colWidths: number[],
  options?: {
    rowHeight?: number
    headerHeight?: number
    fontSize?: number
  }
): number {
  const rowHeight = options?.rowHeight ?? 8
  const headerHeight = options?.headerHeight ?? 9
  const fontSize = options?.fontSize ?? FONT_SIZE.small

  let y = startY
  const maxY = PAGE_HEIGHT - MARGIN - 10 // Reserve space for footer

  // --- Draw header row ---
  doc.setFillColor(COLORS.headerBg.r, COLORS.headerBg.g, COLORS.headerBg.b)
  let x = startX
  for (let i = 0; i < headers.length; i++) {
    doc.rect(x, y, colWidths[i], headerHeight, 'F')
    x += colWidths[i]
  }

  doc.setFontSize(fontSize)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(COLORS.headerText.r, COLORS.headerText.g, COLORS.headerText.b)

  x = startX
  for (let i = 0; i < headers.length; i++) {
    const cellText = truncateText(doc, headers[i], colWidths[i] - 4)
    doc.text(cellText, x + 2, y + headerHeight - 2.5)
    x += colWidths[i]
  }

  y += headerHeight

  // --- Draw data rows ---
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(fontSize)

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    // Check for page break
    if (y + rowHeight > maxY) {
      doc.addPage()
      y = MARGIN

      // Redraw header on new page
      doc.setFillColor(COLORS.headerBg.r, COLORS.headerBg.g, COLORS.headerBg.b)
      x = startX
      for (let i = 0; i < headers.length; i++) {
        doc.rect(x, y, colWidths[i], headerHeight, 'F')
        x += colWidths[i]
      }
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(COLORS.headerText.r, COLORS.headerText.g, COLORS.headerText.b)
      x = startX
      for (let i = 0; i < headers.length; i++) {
        const cellText = truncateText(doc, headers[i], colWidths[i] - 4)
        doc.text(cellText, x + 2, y + headerHeight - 2.5)
        x += colWidths[i]
      }
      y += headerHeight
      doc.setFont('helvetica', 'normal')
    }

    const row = rows[rowIdx]

    // Alternate row background
    if (rowIdx % 2 === 1) {
      doc.setFillColor(COLORS.rowAlt.r, COLORS.rowAlt.g, COLORS.rowAlt.b)
      doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F')
    }

    // Row border bottom
    doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b)
    doc.setLineWidth(0.2)
    doc.line(startX, y + rowHeight, startX + colWidths.reduce((a, b) => a + b, 0), y + rowHeight)

    // Cell text
    doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b)
    doc.setFontSize(fontSize)

    x = startX
    for (let i = 0; i < row.length; i++) {
      const cellText = truncateText(doc, row[i] ?? '', colWidths[i] - 4)
      doc.text(cellText, x + 2, y + rowHeight - 2)
      x += colWidths[i]
    }

    y += rowHeight
  }

  return y
}

/**
 * Draw a KPI box (label + value) at position.
 */
function drawKpiBox(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string
): void {
  // Box background
  doc.setFillColor(245, 247, 250)
  doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, width, height, 2, 2, 'FD')

  // Label
  doc.setFontSize(FONT_SIZE.small)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b)
  doc.text(label, x + width / 2, y + 8, { align: 'center' })

  // Value
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(COLORS.headerBg.r, COLORS.headerBg.g, COLORS.headerBg.b)
  doc.text(value, x + width / 2, y + 17, { align: 'center' })
}

// ==========================================
// 1. Informe Mensual
// ==========================================

export function generateMonthlyReport(data: MonthlyReportData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const monthLabel = MONTH_NAMES[data.month - 1] ?? ''
  const subtitle = `${monthLabel} ${data.year}`

  // Header
  let y = drawHeader(doc, data.clubName, 'Resumen Mensual', subtitle)

  // KPI section
  const kpiWidth = (CONTENT_WIDTH - 9) / 4 // 4 boxes with 3px gap between
  const kpiHeight = 24
  const kpiGap = 3

  drawKpiBox(doc, MARGIN, y, kpiWidth, kpiHeight, 'Total Ingresos', formatCurrencyPdf(data.totalIngresos))
  drawKpiBox(doc, MARGIN + kpiWidth + kpiGap, y, kpiWidth, kpiHeight, 'Pendiente Cobro', formatCurrencyPdf(data.totalPendiente))
  drawKpiBox(doc, MARGIN + (kpiWidth + kpiGap) * 2, y, kpiWidth, kpiHeight, 'Tasa Cobro', formatPercentPdf(data.tasaCobro))
  drawKpiBox(doc, MARGIN + (kpiWidth + kpiGap) * 3, y, kpiWidth, kpiHeight, 'Total Recibos', String(data.totalRecibos))

  y += kpiHeight + 10

  // Payments table
  const headers = ['Jugador', 'Grupo', 'Concepto', 'Importe', 'Estado', 'Fecha Pago']
  const colWidths = [38, 30, 34, 24, 22, 22]

  const rows: string[][] = data.payments.map((p) => [
    p.playerName,
    p.groupName,
    p.concept,
    formatCurrencyPdf(p.amount),
    p.status,
    p.paidDate ?? '-',
  ])

  drawTable(doc, headers, rows, MARGIN, y, colWidths)

  // Footers
  addFootersToAllPages(doc)

  // Save
  const filename = `Resumen_Mensual_${monthLabel}_${data.year}.pdf`
  doc.save(filename)
}

// ==========================================
// 2. Historial de Pagos del Jugador
// ==========================================

export function generatePlayerHistoryReport(data: PlayerHistoryData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Header
  let y = drawHeader(doc, data.clubName, `Historial de Pagos - ${data.playerName}`)

  // Player info section
  doc.setFontSize(FONT_SIZE.normal)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b)

  const infoFields: [string, string][] = [
    ['Nombre:', data.playerName],
    ['DNI:', data.playerDni],
    ['Email:', data.playerEmail],
    ['Tel\u00E9fono:', data.playerPhone],
  ]

  for (const [label, value] of infoFields) {
    doc.setFont('helvetica', 'bold')
    doc.text(label, MARGIN, y + 3)
    doc.setFont('helvetica', 'normal')
    doc.text(value, MARGIN + 25, y + 3)
    y += 6
  }

  y += 6

  // Payments table
  const headers = ['Mes/A\u00F1o', 'Concepto', 'Importe', 'Estado', 'M\u00E9todo', 'Fecha Pago']
  const colWidths = [28, 36, 26, 24, 28, 28]

  const rows: string[][] = data.payments.map((p) => [
    p.groupName, // Used as month/year identifier in this context
    p.concept,
    formatCurrencyPdf(p.amount),
    p.status,
    p.paymentMethod ?? '-',
    p.paidDate ?? '-',
  ])

  y = drawTable(doc, headers, rows, MARGIN, y, colWidths)

  // Summary section
  y += 8

  // Check if summary fits on current page
  if (y + 30 > PAGE_HEIGHT - MARGIN - 10) {
    doc.addPage()
    y = MARGIN
  }

  doc.setDrawColor(COLORS.headerBg.r, COLORS.headerBg.g, COLORS.headerBg.b)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y)
  y += 8

  // Total pagado
  doc.setFontSize(FONT_SIZE.normal)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(COLORS.success.r, COLORS.success.g, COLORS.success.b)
  doc.text('Total Pagado:', MARGIN, y + 3)
  doc.text(formatCurrencyPdf(data.totalPaid), MARGIN + 80, y + 3)
  y += 7

  // Total pendiente
  doc.setTextColor(COLORS.warning.r, COLORS.warning.g, COLORS.warning.b)
  doc.text('Total Pendiente:', MARGIN, y + 3)
  doc.text(formatCurrencyPdf(data.totalPending), MARGIN + 80, y + 3)

  // Footers
  addFootersToAllPages(doc)

  // Save
  const safeName = data.playerName.replace(/\s+/g, '_')
  const filename = `Historial_Pagos_${safeName}.pdf`
  doc.save(filename)
}

// ==========================================
// 3. Informe Anual
// ==========================================

export function generateAnnualReport(data: AnnualReportData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Header
  let y = drawHeader(doc, data.clubName, `Resumen Anual ${data.year}`)

  // Summary table: Mes, Ingresos, Pendiente, Recibos
  const headers = ['Mes', 'Ingresos', 'Pendiente', 'Recibos']
  const colWidths = [50, 40, 40, 40]

  const rows: string[][] = data.monthlyData.map((m) => [
    m.month,
    formatCurrencyPdf(m.ingresos),
    formatCurrencyPdf(m.pendiente),
    String(m.recibos),
  ])

  y = drawTable(doc, headers, rows, MARGIN, y, colWidths, {
    rowHeight: 9,
    headerHeight: 10,
    fontSize: FONT_SIZE.normal,
  })

  // Totals row
  const totalRowY = y
  const totalTableWidth = colWidths.reduce((a, b) => a + b, 0)

  doc.setFillColor(COLORS.headerBg.r, COLORS.headerBg.g, COLORS.headerBg.b)
  doc.rect(MARGIN, totalRowY, totalTableWidth, 10, 'F')

  doc.setFontSize(FONT_SIZE.normal)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(COLORS.headerText.r, COLORS.headerText.g, COLORS.headerText.b)

  let x = MARGIN
  doc.text('TOTAL', x + 2, totalRowY + 7)
  x += colWidths[0]
  doc.text(formatCurrencyPdf(data.totalIngresos), x + 2, totalRowY + 7)
  x += colWidths[1]
  doc.text(formatCurrencyPdf(data.totalPendiente), x + 2, totalRowY + 7)
  x += colWidths[2]
  doc.text(String(data.totalRecibos), x + 2, totalRowY + 7)

  // Footers
  addFootersToAllPages(doc)

  // Save
  const filename = `Resumen_Anual_${data.year}.pdf`
  doc.save(filename)
}
