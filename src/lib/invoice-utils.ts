// ==========================================
// Invoice Utilities - Sistema de Facturación
// ==========================================
// Funciones para generación, validación y cálculos de facturas
// con cumplimiento fiscal español (IVA 0%, 10%, 21%)

import type {
  Invoice,
  InvoiceLineItem,
  InvoiceSeries,
  VatRate,
  Payment,
  EventPayment,
  PrivateLessonPayment,
  Player,
  Club,
} from '@/types'

// ==========================================
// Tipos helper
// ==========================================

type AnyPayment = Payment | EventPayment | PrivateLessonPayment
type PaymentType = 'payment' | 'eventPayment' | 'privateLessonPayment'

// ==========================================
// Generación de número de factura
// ==========================================

/**
 * Genera el siguiente número de factura con formato año-serie
 * @example getNextInvoiceNumber('FC', 15, 2024) => 'FC-2024-016'
 * @example getNextInvoiceNumber('FR', 0, 2025) => 'FR-2025-001'
 */
export function getNextInvoiceNumber(
  series: InvoiceSeries,
  currentCounter: number,
  year: number = new Date().getFullYear()
): string {
  const nextNumber = currentCounter + 1
  const paddedNumber = String(nextNumber).padStart(3, '0')
  return `${series}-${year}-${paddedNumber}`
}

// ==========================================
// Creación de líneas de factura
// ==========================================

/**
 * Convierte un pago en una línea de factura con cálculos de IVA
 */
export function createInvoiceLineItem(
  payment: AnyPayment,
  paymentType: PaymentType,
  defaultVatRate: VatRate = 0
): InvoiceLineItem {
  // Determinar VAT rate (usar el del pago si existe, sino el default)
  const vatRate: VatRate = ('vatRate' in payment && payment.vatRate !== undefined)
    ? payment.vatRate
    : defaultVatRate

  // El amount del pago incluye IVA, necesitamos desglosarlo
  const total = payment.amount
  const subtotal = total / (1 + vatRate / 100)
  const vatAmount = total - subtotal

  // Descripción según tipo de pago
  let description = ''
  if ('concept' in payment && payment.concept) {
    description = payment.concept
  } else if (paymentType === 'eventPayment' && 'eventName' in payment) {
    description = `Evento: ${payment.eventName}`
  } else if (paymentType === 'privateLessonPayment' && 'lessonDate' in payment) {
    const lessonDate = payment.lessonDate instanceof Date
      ? payment.lessonDate
      : new Date(payment.lessonDate)
    description = `Clase particular - ${lessonDate.toLocaleDateString('es-ES')}`
  } else {
    description = 'Servicio'
  }

  return {
    description,
    quantity: 1,
    unitPrice: subtotal,
    vatRate,
    subtotal,
    vatAmount,
    total,
    paymentId: payment.id,
    paymentType,
  }
}

// ==========================================
// Cálculo de desglose de IVA
// ==========================================

/**
 * Agrupa las líneas de factura por tipo de IVA y calcula totales
 * @returns Objeto con base y VAT por cada tipo de IVA usado
 * @example { 0: { base: 50, vat: 0 }, 21: { base: 25, vat: 5.25 } }
 */
export function calculateVATBreakdown(
  lineItems: InvoiceLineItem[]
): Invoice['vatBreakdown'] {
  const breakdown: Invoice['vatBreakdown'] = {}

  lineItems.forEach((item) => {
    if (!breakdown[item.vatRate]) {
      breakdown[item.vatRate] = { base: 0, vat: 0 }
    }
    breakdown[item.vatRate]!.base += item.subtotal
    breakdown[item.vatRate]!.vat += item.vatAmount
  })

  // Redondear a 2 decimales para evitar problemas de precisión
  Object.keys(breakdown).forEach((key) => {
    const rate = Number(key) as VatRate
    if (breakdown[rate]) {
      breakdown[rate]!.base = Math.round(breakdown[rate]!.base * 100) / 100
      breakdown[rate]!.vat = Math.round(breakdown[rate]!.vat * 100) / 100
    }
  })

  return breakdown
}

// ==========================================
// Validación de datos
// ==========================================

/**
 * Valida que una factura tenga todos los datos necesarios
 */
export function validateInvoiceData(
  invoice: Partial<Invoice>,
  club: Club
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Validar datos del club
  if (!club.nif) {
    errors.push('El club debe tener NIF configurado')
  }
  if (!club.legalName) {
    errors.push('El club debe tener razón social configurada')
  }
  if (!club.fiscalAddress) {
    errors.push('El club debe tener domicilio fiscal configurado')
  }

  // Validar datos de la factura
  if (!invoice.invoiceNumber) {
    errors.push('Falta número de factura')
  }
  if (!invoice.playerId) {
    errors.push('Falta ID del jugador/cliente')
  }
  if (!invoice.playerName) {
    errors.push('Falta nombre del cliente')
  }
  if (!invoice.lineItems || invoice.lineItems.length === 0) {
    errors.push('La factura debe tener al menos una línea')
  }
  if (invoice.lineItems) {
    invoice.lineItems.forEach((item, index) => {
      if (item.quantity <= 0) {
        errors.push(`Línea ${index + 1}: cantidad inválida`)
      }
      if (item.unitPrice < 0) {
        errors.push(`Línea ${index + 1}: precio unitario inválido`)
      }
    })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Verifica si un conjunto de pagos puede ser facturado
 */
export function canGenerateInvoice(
  paymentIds: string[],
  allPayments: AnyPayment[]
): { canInvoice: boolean; reason?: string } {
  if (paymentIds.length === 0) {
    return { canInvoice: false, reason: 'Debe seleccionar al menos un pago' }
  }

  // Filtrar solo los pagos seleccionados
  const selectedPayments = allPayments.filter((p) => paymentIds.includes(p.id))

  if (selectedPayments.length !== paymentIds.length) {
    return {
      canInvoice: false,
      reason: 'Algunos pagos seleccionados no se encontraron',
    }
  }

  // Verificar que ninguno ya tenga invoiceId
  const alreadyInvoiced = selectedPayments.filter((p) => p.invoiceId)
  if (alreadyInvoiced.length > 0) {
    return {
      canInvoice: false,
      reason: `${alreadyInvoiced.length} pago(s) ya están facturados`,
    }
  }

  // Verificar que todos estén pagados
  const unpaid = selectedPayments.filter((p) => p.status !== 'pagado')
  if (unpaid.length > 0) {
    return {
      canInvoice: false,
      reason: 'Solo se pueden facturar pagos en estado "pagado"',
    }
  }

  // Verificar que todos sean del mismo jugador
  const playerIds = new Set(selectedPayments.map((p) => p.playerId))
  if (playerIds.size > 1) {
    return {
      canInvoice: false,
      reason: 'Todos los pagos deben pertenecer al mismo jugador',
    }
  }

  return { canInvoice: true }
}

// ==========================================
// Generación de factura completa
// ==========================================

/**
 * Genera una factura completa a partir de pagos seleccionados
 * Incluye validación, cálculo de líneas, totales y desglose IVA
 */
export async function generateInvoiceFromPayments(
  paymentIds: string[],
  payments: Payment[],
  eventPayments: EventPayment[],
  privateLessonPayments: PrivateLessonPayment[],
  player: Player,
  club: Club,
  series: InvoiceSeries = 'FC',
  options?: {
    invoiceDate?: Date
    dueDate?: Date
    notes?: string
    status?: 'draft' | 'issued' | 'paid'
  }
): Promise<Omit<Invoice, 'id' | 'createdAt'>> {
  // Modo manual: factura sin pagos vinculados
  const isManualInvoice = paymentIds.length === 0

  // Combinar todos los pagos en un solo array
  const allPayments: AnyPayment[] = [
    ...payments,
    ...eventPayments,
    ...privateLessonPayments,
  ]

  // Validación inicial (solo para facturas con pagos)
  if (!isManualInvoice) {
    const validationResult = canGenerateInvoice(paymentIds, allPayments)
    if (!validationResult.canInvoice) {
      throw new Error(validationResult.reason || 'No se puede generar la factura')
    }
  }

  // Obtener los pagos seleccionados
  const selectedPayments = allPayments.filter((p) => paymentIds.includes(p.id))

  // Determinar tipo de cada pago para createInvoiceLineItem
  const lineItems: InvoiceLineItem[] = selectedPayments.map((payment) => {
    let paymentType: PaymentType = 'payment'
    let defaultVatRate: VatRate = club.defaultVatRateTariffs ?? 0

    if (eventPayments.some((ep) => ep.id === payment.id)) {
      paymentType = 'eventPayment'
      defaultVatRate = club.defaultVatRateEvents ?? 21
    } else if (privateLessonPayments.some((plp) => plp.id === payment.id)) {
      paymentType = 'privateLessonPayment'
      defaultVatRate = club.defaultVatRatePrivateLessons ?? 21
    }

    return createInvoiceLineItem(payment, paymentType, defaultVatRate)
  })

  // Calcular totales
  const subtotal = Math.round(
    lineItems.reduce((sum, item) => sum + item.subtotal, 0) * 100
  ) / 100
  const totalVat = Math.round(
    lineItems.reduce((sum, item) => sum + item.vatAmount, 0) * 100
  ) / 100
  const total = Math.round(
    lineItems.reduce((sum, item) => sum + item.total, 0) * 100
  ) / 100

  // Calcular desglose de IVA
  const vatBreakdown = calculateVATBreakdown(lineItems)

  // Obtener contador actual del club para generar número
  const year = new Date().getFullYear()
  const currentCounter = club.invoiceCounters?.[year]?.[series] ?? 0
  const invoiceNumber = getNextInvoiceNumber(series, currentCounter, year)

  // Construir dirección del cliente
  let customerAddress = ''
  if (player.address) {
    customerAddress = player.address
    if (player.postalCode) {
      customerAddress += `, ${player.postalCode}`
    }
    if (player.city) {
      customerAddress += ` ${player.city}`
    }
  }

  // Construir objeto Invoice
  const invoice: Omit<Invoice, 'id' | 'createdAt'> = {
    invoiceNumber,
    series,
    invoiceDate: options?.invoiceDate ?? new Date(),
    dueDate: options?.dueDate,
    playerId: player.id,
    playerName: `${player.firstName} ${player.lastName}`,
    customerNif: player.dni || undefined,
    customerAddress: customerAddress || undefined,
    customerEmail: player.email || undefined,
    customerPhone: player.phone || undefined,
    lineItems,
    subtotal,
    totalVat,
    total,
    vatBreakdown,
    status: options?.status ?? 'issued',
    paymentIds,
    notes: options?.notes,
    createdBy: '', // Se asignará en el dataStore
  }

  // Validar factura final
  const finalValidation = validateInvoiceData(invoice, club)
  if (!finalValidation.valid) {
    throw new Error(
      `Datos de factura inválidos: ${finalValidation.errors.join(', ')}`
    )
  }

  return invoice
}

// ==========================================
// Generación de factura manual
// ==========================================

/**
 * Genera una factura manual con líneas de concepto personalizadas
 * Útil para crear facturas a clientes sin pagos previos o externos
 */
export async function generateManualInvoice(
  lineItems: InvoiceLineItem[],
  player: Player,
  club: Club,
  series: InvoiceSeries = 'FC',
  options?: {
    invoiceDate?: Date
    dueDate?: Date
    notes?: string
    status?: 'draft' | 'issued' | 'paid'
  }
): Promise<Omit<Invoice, 'id' | 'createdAt'>> {
  // Validar que haya líneas
  if (lineItems.length === 0) {
    throw new Error('Debe incluir al menos una línea en la factura')
  }

  // Calcular totales
  const subtotal = Math.round(
    lineItems.reduce((sum, item) => sum + item.subtotal, 0) * 100
  ) / 100
  const totalVat = Math.round(
    lineItems.reduce((sum, item) => sum + item.vatAmount, 0) * 100
  ) / 100
  const total = Math.round(
    lineItems.reduce((sum, item) => sum + item.total, 0) * 100
  ) / 100

  // Calcular desglose de IVA
  const vatBreakdown = calculateVATBreakdown(lineItems)

  // Obtener contador actual del club para generar número
  const year = new Date().getFullYear()
  const currentCounter = club.invoiceCounters?.[year]?.[series] ?? 0
  const invoiceNumber = getNextInvoiceNumber(series, currentCounter, year)

  // Construir dirección del cliente
  let customerAddress = ''
  if (player.address) {
    customerAddress = player.address
    if (player.postalCode) {
      customerAddress += `, ${player.postalCode}`
    }
    if (player.city) {
      customerAddress += ` ${player.city}`
    }
  }

  // Construir objeto Invoice
  const invoice: Omit<Invoice, 'id' | 'createdAt'> = {
    invoiceNumber,
    series,
    invoiceDate: options?.invoiceDate ?? new Date(),
    dueDate: options?.dueDate,
    playerId: player.id,
    playerName: `${player.firstName} ${player.lastName}`,
    customerNif: player.dni || undefined,
    customerAddress: customerAddress || undefined,
    lineItems,
    subtotal,
    totalVat,
    total,
    vatBreakdown,
    status: options?.status ?? 'issued',
    paymentIds: [], // Sin pagos vinculados para facturas manuales
    notes: options?.notes,
    createdBy: '', // Se asignará en el dataStore
  }

  // Validar factura final
  const finalValidation = validateInvoiceData(invoice, club)
  if (!finalValidation.valid) {
    throw new Error(
      `Datos de factura inválidos: ${finalValidation.errors.join(', ')}`
    )
  }

  return invoice
}

// ==========================================
// Generación de factura rectificativa
// ==========================================

/**
 * Genera una factura rectificativa (FR) a partir de una factura original
 * Las líneas tendrán importes negativos
 */
export async function generateCorrectiveInvoice(
  originalInvoice: Invoice,
  club: Club,
  options?: {
    notes?: string
  }
): Promise<Omit<Invoice, 'id' | 'createdAt'>> {
  // Crear líneas con importes negativos
  const correctiveLineItems: InvoiceLineItem[] = originalInvoice.lineItems.map(
    (item) => ({
      ...item,
      quantity: -item.quantity,
      subtotal: -item.subtotal,
      vatAmount: -item.vatAmount,
      total: -item.total,
    })
  )

  // Calcular desglose VAT negativo
  const vatBreakdown = calculateVATBreakdown(correctiveLineItems)

  // Obtener contador FR
  const year = new Date().getFullYear()
  const currentCounter = club.invoiceCounters?.[year]?.FR ?? 0
  const invoiceNumber = getNextInvoiceNumber('FR', currentCounter, year)

  const notes =
    options?.notes ||
    `Factura rectificativa de ${originalInvoice.invoiceNumber}`

  return {
    invoiceNumber,
    series: 'FR',
    invoiceDate: new Date(),
    playerId: originalInvoice.playerId,
    playerName: originalInvoice.playerName,
    customerNif: originalInvoice.customerNif,
    customerAddress: originalInvoice.customerAddress,
    lineItems: correctiveLineItems,
    subtotal: -originalInvoice.subtotal,
    totalVat: -originalInvoice.totalVat,
    total: -originalInvoice.total,
    vatBreakdown,
    status: 'draft',
    paymentIds: [], // Las rectificativas no están vinculadas a pagos
    notes,
    createdBy: '', // Se asignará en el dataStore
  }
}
