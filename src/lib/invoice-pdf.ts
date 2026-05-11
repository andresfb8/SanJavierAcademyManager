// ==========================================
// Invoice PDF Generation - Spanish Format
// ==========================================
// Genera PDFs de facturas según estándares fiscales españoles
// con desglose de IVA y formato profesional

import type { jsPDF } from 'jspdf'
import type { Invoice, Club } from '@/types'
import { ensureDate } from './utils'

// --- Constantes de diseño (reutilizadas de pdf-reports.ts) ---

const MARGIN = 20
const PAGE_WIDTH = 210 // A4 width in mm
const PAGE_HEIGHT = 297 // A4 height in mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const FONT_SIZE = {
  title: 16,
  subtitle: 12,
  normal: 10,
  small: 8,
} as const

const COLORS = {
  headerBg: { r: 30, g: 64, b: 175 }, // blue-800
  headerText: { r: 255, g: 255, b: 255 },
  rowAlt: { r: 245, g: 247, b: 250 },
  border: { r: 200, g: 200, b: 200 },
  text: { r: 30, g: 30, b: 30 },
  muted: { r: 120, g: 120, b: 120 },
  success: { r: 22, g: 163, b: 74 },
} as const

// --- Utilidades ---

function formatCurrencyPdf(amount: number): string {
  return amount.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €'
}

function formatDatePdf(date: any): string {
  const d = ensureDate(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
  const safeText = text || ''
  const textWidth = doc.getTextWidth(safeText)
  if (textWidth <= maxWidth) return safeText

  // Truncar y añadir elipsis
  let truncated = safeText
  while (doc.getTextWidth(truncated + '...') > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1)
  }
  return truncated + '...'
}

// --- Secciones del PDF ---

/**
 * Dibuja el encabezado con datos del club y factura
 */
function drawInvoiceHeader(
  doc: jsPDF,
  club: Club,
  invoice: Invoice,
  startY: number
): number {
  let y = startY

  // --- Columna Izquierda: Datos del Club ---
  doc.setFontSize(FONT_SIZE.title)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(COLORS.headerBg.r, COLORS.headerBg.g, COLORS.headerBg.b)
  doc.text(club?.name || 'Factura', MARGIN, y)
  y += 6

  doc.setFontSize(FONT_SIZE.normal)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b)

  if (club.legalName) {
    doc.text(club.legalName, MARGIN, y)
    y += 5
  }

  if (club.nif) {
    doc.text(`NIF: ${club.nif}`, MARGIN, y)
    y += 5
  }

  if (club.fiscalAddress) {
    const addressLines = doc.splitTextToSize(club.fiscalAddress, 80)
    addressLines.forEach((line: string) => {
      doc.text(line, MARGIN, y)
      y += 5
    })
  }

  // --- Columna Derecha: Datos de la Factura ---
  const rightX = PAGE_WIDTH - MARGIN
  let rightY = startY

  doc.setFontSize(FONT_SIZE.title)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(COLORS.headerBg.r, COLORS.headerBg.g, COLORS.headerBg.b)
  doc.text('FACTURA', rightX, rightY, { align: 'right' })
  rightY += 8

  doc.setFontSize(FONT_SIZE.subtitle)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b)
  doc.text(invoice.invoiceNumber, rightX, rightY, { align: 'right' })
  rightY += 7

  doc.setFontSize(FONT_SIZE.normal)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b)
  doc.text(`Fecha: ${formatDatePdf(invoice.invoiceDate)}`, rightX, rightY, { align: 'right' })
  rightY += 5

  if (invoice.dueDate) {
    doc.text(`Vencimiento: ${formatDatePdf(invoice.dueDate)}`, rightX, rightY, { align: 'right' })
    rightY += 5
  }

  // Retornar el mayor de los dos Y
  return Math.max(y, rightY) + 10
}

/**
 * Dibuja los datos del cliente
 */
function drawCustomerInfo(
  doc: jsPDF,
  invoice: Invoice,
  startY: number
): number {
  let y = startY

  // Título
  doc.setFontSize(FONT_SIZE.subtitle)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b)
  doc.text('DATOS DEL CLIENTE', MARGIN, y)
  y += 7

  // Línea divisoria
  doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y)
  y += 6

  doc.setFontSize(FONT_SIZE.normal)
  doc.setFont('helvetica', 'normal')

  // Nombre
  doc.setFont('helvetica', 'bold')
  doc.text(invoice.playerName || 'Cliente', MARGIN, y)
  y += 5
  doc.setFont('helvetica', 'normal')

  // NIF/DNI
  if (invoice.customerNif) {
    doc.text(`NIF/DNI: ${invoice.customerNif}`, MARGIN, y)
    y += 5
  }

  // Dirección
  if (invoice.customerAddress) {
    const addressLines = doc.splitTextToSize(invoice.customerAddress, CONTENT_WIDTH)
    addressLines.forEach((line: string) => {
      doc.text(line, MARGIN, y)
      y += 5
    })
  }

  // Email
  if (invoice.customerEmail) {
    doc.text(`Email: ${invoice.customerEmail}`, MARGIN, y)
    y += 5
  }

  // Teléfono
  if (invoice.customerPhone) {
    doc.text(`Tel: ${invoice.customerPhone}`, MARGIN, y)
    y += 5
  }

  return y + 8
}

/**
 * Dibuja la tabla de líneas de factura
 */
function drawInvoiceTable(
  doc: jsPDF,
  invoice: Invoice,
  startY: number
): number {
  let y = startY

  // Header de la tabla
  const colWidths = {
    description: 70,
    quantity: 15,
    unitPrice: 25,
    vatRate: 15,
    subtotal: 25,
    total: 25,
  }

  const colX = {
    description: MARGIN,
    quantity: MARGIN + colWidths.description,
    unitPrice: MARGIN + colWidths.description + colWidths.quantity,
    vatRate: MARGIN + colWidths.description + colWidths.quantity + colWidths.unitPrice,
    subtotal: MARGIN + colWidths.description + colWidths.quantity + colWidths.unitPrice + colWidths.vatRate,
    total: PAGE_WIDTH - MARGIN - colWidths.total,
  }

  // Dibujar header
  doc.setFillColor(COLORS.headerBg.r, COLORS.headerBg.g, COLORS.headerBg.b)
  doc.rect(MARGIN, y, CONTENT_WIDTH, 8, 'F')

  doc.setFontSize(FONT_SIZE.small)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(COLORS.headerText.r, COLORS.headerText.g, COLORS.headerText.b)

  doc.text('Descripción', colX.description + 2, y + 5.5)
  doc.text('Cant.', colX.quantity + 2, y + 5.5)
  doc.text('P. Unit.', colX.unitPrice + 2, y + 5.5)
  doc.text('IVA %', colX.vatRate + 2, y + 5.5)
  doc.text('Subtotal', colX.subtotal + 2, y + 5.5)
  doc.text('Total', colX.total + 2, y + 5.5)
  y += 8

  // Dibujar líneas
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b)
  doc.setFontSize(FONT_SIZE.normal)

  invoice.lineItems.forEach((item, index) => {
    const isAlt = index % 2 === 1
    if (isAlt) {
      doc.setFillColor(COLORS.rowAlt.r, COLORS.rowAlt.g, COLORS.rowAlt.b)
      doc.rect(MARGIN, y, CONTENT_WIDTH, 7, 'F')
    }

    const description = truncateText(doc, item.description, colWidths.description - 4)
    doc.text(description, colX.description + 2, y + 5)
    doc.text(String(item.quantity), colX.quantity + 2, y + 5)
    doc.text(formatCurrencyPdf(item.unitPrice), colX.unitPrice + 2, y + 5)
    doc.text(`${item.vatRate}%`, colX.vatRate + 2, y + 5)
    doc.text(formatCurrencyPdf(item.subtotal), colX.subtotal + 2, y + 5)
    doc.text(formatCurrencyPdf(item.total), colX.total + 2, y + 5)
    y += 7
  })

  // Línea final de tabla
  doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y)

  return y + 8
}

/**
 * Dibuja el desglose de IVA
 */
function drawVATSummary(
  doc: jsPDF,
  invoice: Invoice,
  startY: number
): number {
  let y = startY

  // Título
  doc.setFontSize(FONT_SIZE.subtitle)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b)
  doc.text('DESGLOSE DE IVA', MARGIN, y)
  y += 7

  // Tabla de desglose
  const colX = {
    type: MARGIN,
    base: MARGIN + 40,
    vat: MARGIN + 90,
    total: MARGIN + 140,
  }

  doc.setFontSize(FONT_SIZE.small)
  doc.setFont('helvetica', 'bold')

  // Header
  doc.setFillColor(COLORS.rowAlt.r, COLORS.rowAlt.g, COLORS.rowAlt.b)
  doc.rect(MARGIN, y, 100, 6, 'F')

  doc.text('Tipo IVA', colX.type + 2, y + 4)
  doc.text('Base Imponible', colX.base + 2, y + 4)
  doc.text('Cuota IVA', colX.vat + 2, y + 4)
  y += 6

  // Líneas de desglose
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(FONT_SIZE.normal)

  Object.entries(invoice.vatBreakdown).forEach(([rate, { base, vat }]) => {
    doc.text(`${rate}%`, colX.type + 2, y + 5)
    doc.text(formatCurrencyPdf(base), colX.base + 2, y + 5)
    doc.text(formatCurrencyPdf(vat), colX.vat + 2, y + 5)
    y += 6
  })

  return y + 8
}

/**
 * Dibuja los totales destacados
 */
function drawInvoiceTotals(
  doc: jsPDF,
  invoice: Invoice,
  startY: number
): number {
  let y = startY

  const rightX = PAGE_WIDTH - MARGIN
  const labelX = rightX - 60

  doc.setFontSize(FONT_SIZE.normal)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b)

  // Base imponible
  doc.text('Base Imponible:', labelX, y)
  doc.text(formatCurrencyPdf(invoice.subtotal), rightX, y, { align: 'right' })
  y += 6

  // Total IVA
  doc.text('Total IVA:', labelX, y)
  doc.text(formatCurrencyPdf(invoice.totalVat), rightX, y, { align: 'right' })
  y += 8

  // TOTAL (destacado)
  doc.setFontSize(FONT_SIZE.subtitle)
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(COLORS.success.r, COLORS.success.g, COLORS.success.b)
  doc.rect(labelX - 5, y - 5, 65, 8, 'F')
  doc.setTextColor(COLORS.headerText.r, COLORS.headerText.g, COLORS.headerText.b)
  doc.text('TOTAL:', labelX, y)
  doc.text(formatCurrencyPdf(invoice.total), rightX, y, { align: 'right' })

  return y + 10
}

/**
 * Dibuja el pie de página con notas y forma de pago
 */
function drawLegalFooter(
  doc: jsPDF,
  invoice: Invoice,
  startY: number
): number {
  let y = startY

  doc.setFontSize(FONT_SIZE.normal)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b)

  // Notas
  if (invoice.notes) {
    doc.setFont('helvetica', 'bold')
    doc.text('Observaciones:', MARGIN, y)
    y += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(FONT_SIZE.small)
    const notesLines = doc.splitTextToSize(invoice.notes, CONTENT_WIDTH)
    notesLines.forEach((line: string) => {
      doc.text(line, MARGIN, y)
      y += 4
    })
    y += 4
  }

  // Exención de IVA
  if (invoice.totalVat === 0) {
    doc.setFontSize(FONT_SIZE.small)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b)
    const exemptionText = "Operación exenta de IVA en virtud de la Ley 37/1992, de 28 de diciembre, del Impuesto sobre el Valor Añadido, Art. 20.1.13º y 14º."
    const exemptionLines = doc.splitTextToSize(exemptionText, CONTENT_WIDTH)
    exemptionLines.forEach((line: string) => {
      doc.text(line, MARGIN, y)
      y += 4
    })
    y += 4
  }

  // Pie legal
  doc.setFontSize(FONT_SIZE.small)
  doc.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b)
  const footerY = PAGE_HEIGHT - MARGIN - 10
  doc.text(
    'Esta factura ha sido generada electrónicamente por San Javier Academy Manager',
    PAGE_WIDTH / 2,
    footerY,
    { align: 'center' }
  )

  return y
}

// --- Función Principal ---

/**
 * Genera y descarga un PDF de factura en formato español
 */
export async function generateInvoicePDF(invoice: Invoice, club: Club): Promise<void> {
  try {
    const { jsPDF: JsPDF } = await import('jspdf')
    const doc = new JsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    }) as unknown as jsPDF

    let y = MARGIN

    // Dibujar todas las secciones
    y = drawInvoiceHeader(doc, club, invoice, y)
    y = drawCustomerInfo(doc, invoice, y)
    y = drawInvoiceTable(doc, invoice, y)
    y = drawVATSummary(doc, invoice, y)
    y = drawInvoiceTotals(doc, invoice, y)
    drawLegalFooter(doc, invoice, y)

    // Descargar
    const fileName = `${invoice.invoiceNumber.replace(/\//g, '-')}.pdf`
    doc.save(fileName)
  } catch (error) {
    console.error('[generateInvoicePDF] Error al generar el PDF:', error)
    alert('No se pudo generar el PDF. Verifica que los datos del club y la factura estén completos en Configuración.')
  }
}
