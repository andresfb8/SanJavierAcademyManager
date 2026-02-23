// ==========================================
// Cloud Function: Generación Automática de Facturas Mensuales
// ==========================================
// Se ejecuta el día 1 de cada mes a las 03:00 AM
// Genera facturas FC para todos los pagos pagados del mes anterior

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions/v2'
import * as admin from 'firebase-admin'

const db = admin.firestore()

interface PaymentDoc {
  id: string
  playerId: string
  playerName: string
  amount: number
  status: string
  invoiceId?: string
  [key: string]: any
}

interface PlayerDoc {
  id: string
  firstName: string
  lastName: string
  dni?: string
  address?: string
  city?: string
  postalCode?: string
  registrationDate?: admin.firestore.Timestamp
  [key: string]: any
}

interface ClubDoc {
  id: string
  name: string
  nif?: string
  legalName?: string
  fiscalAddress?: string
  invoiceCounters?: {
    [year: number]: {
      FC?: number
      FR?: number
    }
  }
  defaultVatRateTariffs?: 0 | 10 | 21
  defaultVatRateEvents?: 0 | 10 | 21
  defaultVatRatePrivateLessons?: 0 | 10 | 21
  [key: string]: any
}

/**
 * Cloud Function programada para generar facturas automáticamente
 * Cron: Día 1 de cada mes a las 03:00 AM (Europe/Madrid)
 */
export const generateMonthlyInvoices = onSchedule(
  {
    schedule: '0 3 1 * *',
    timeZone: 'Europe/Madrid',
    region: 'europe-west1',
    retryCount: 3,
  },
  async () => {
    logger.info('[generateMonthlyInvoices] Starting automatic invoice generation...')

    try {
      // Obtener clubs activos
      const clubsSnapshot = await db.collection('clubs').get()

      if (clubsSnapshot.empty) {
        logger.info('[generateMonthlyInvoices] No clubs found')
        return
      }

      // Calcular mes anterior
      const now = new Date()
      const previousMonth = now.getMonth() === 0 ? 12 : now.getMonth()
      const previousYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

      logger.info(`[generateMonthlyInvoices] Processing invoices for ${previousMonth}/${previousYear}`)

      let totalInvoicesGenerated = 0

      // Procesar cada club
      for (const clubDoc of clubsSnapshot.docs) {
        const club = { id: clubDoc.id, ...clubDoc.data() } as ClubDoc

        // Validar datos fiscales del club
        if (!club.nif || !club.legalName || !club.fiscalAddress) {
          logger.warn(`[generateMonthlyInvoices] Club ${club.id} missing fiscal data, skipping`)
          continue
        }

        logger.info(`[generateMonthlyInvoices] Processing club: ${club.name}`)

        try {
          const invoicesGenerated = await generateInvoicesForClub(club, previousMonth, previousYear)
          totalInvoicesGenerated += invoicesGenerated
          logger.info(`[generateMonthlyInvoices] Generated ${invoicesGenerated} invoices for club ${club.name}`)
        } catch (error) {
          logger.error(`[generateMonthlyInvoices] Error processing club ${club.id}:`, error)
          // Continuar con el siguiente club
        }
      }

      logger.info(`[generateMonthlyInvoices] Total invoices generated: ${totalInvoicesGenerated}`)
    } catch (error) {
      logger.error('[generateMonthlyInvoices] Fatal error:', error)
      throw error
    }
  }
)

/**
 * Genera facturas para un club específico
 */
async function generateInvoicesForClub(
  club: ClubDoc,
  month: number,
  year: number
): Promise<number> {
  const clubId = club.id

  // 1. Obtener todos los pagos pagados sin factura del mes/año especificado
  const paymentsCollections = ['payments', 'eventPayments', 'privateLessonPayments']
  const allPayments: PaymentDoc[] = []

  for (const collectionName of paymentsCollections) {
    const paymentsSnapshot = await db
      .collection(collectionName)
      .where('clubId', '==', clubId)
      .where('status', '==', 'pagado')
      .where('billingMonth', '==', month)
      .where('billingYear', '==', year)
      .get()

    paymentsSnapshot.docs.forEach((doc) => {
      const payment = { id: doc.id, ...doc.data() } as PaymentDoc
      // Solo incluir si no tiene invoiceId
      if (!payment.invoiceId) {
        allPayments.push(payment)
      }
    })
  }

  if (allPayments.length === 0) {
    logger.info(`[generateInvoicesForClub] No payments to invoice for club ${clubId}`)
    return 0
  }

  logger.info(`[generateInvoicesForClub] Found ${allPayments.length} payments to invoice`)

  // 2. Agrupar pagos por jugador
  const paymentsByPlayer = new Map<string, PaymentDoc[]>()

  for (const payment of allPayments) {
    const playerId = payment.playerId
    if (!paymentsByPlayer.has(playerId)) {
      paymentsByPlayer.set(playerId, [])
    }
    paymentsByPlayer.get(playerId)!.push(payment)
  }

  logger.info(`[generateInvoicesForClub] Grouped into ${paymentsByPlayer.size} players`)

  // 3. Obtener datos de todos los jugadores
  const playersSnapshot = await db
    .collection('players')
    .where('clubId', '==', clubId)
    .get()

  const playersMap = new Map<string, PlayerDoc>()
  playersSnapshot.docs.forEach((doc) => {
    const player = { id: doc.id, ...doc.data() } as PlayerDoc
    playersMap.set(player.id, player)
  })

  // 4. Generar una factura por jugador
  let invoicesGenerated = 0

  for (const [playerId, payments] of paymentsByPlayer.entries()) {
    const player = playersMap.get(playerId)
    if (!player) {
      logger.warn(`[generateInvoicesForClub] Player ${playerId} not found, skipping`)
      continue
    }

    try {
      await generateInvoiceForPlayer(club, player, payments, year, month)
      invoicesGenerated++
    } catch (error) {
      logger.error(`[generateInvoicesForClub] Error generating invoice for player ${playerId}:`, error)
      // Continuar con el siguiente jugador
    }
  }

  return invoicesGenerated
}

/**
 * Genera una factura para un jugador con transacción atómica
 */
async function generateInvoiceForPlayer(
  club: ClubDoc,
  player: PlayerDoc,
  payments: PaymentDoc[],
  year: number,
  month: number
): Promise<void> {
  const invoiceId = db.collection('invoices').doc().id

  return db.runTransaction(async (transaction) => {
    // 1. Verificar que ningún pago ya tenga invoiceId
    const paymentCollections = ['payments', 'eventPayments', 'privateLessonPayments']

    for (const payment of payments) {
      for (const collectionName of paymentCollections) {
        const paymentRef = db.collection(collectionName).doc(payment.id)
        const paymentSnap = await transaction.get(paymentRef)

        if (paymentSnap.exists && paymentSnap.data()?.invoiceId) {
          throw new Error(`Payment ${payment.id} already has invoiceId`)
        }
      }
    }

    // 2. Obtener contador actual y generar número de factura
    const clubRef = db.collection('clubs').doc(club.id)
    const clubSnap = await transaction.get(clubRef)
    const clubData = clubSnap.data() as ClubDoc

    const currentCounter = clubData.invoiceCounters?.[year]?.FC ?? 0
    const nextNumber = currentCounter + 1
    const invoiceNumber = `FC-${year}-${String(nextNumber).padStart(3, '0')}`

    // 3. Calcular líneas y totales
    const lineItems = payments.map((payment) => {
      const vatRate = (clubData.defaultVatRateTariffs ?? 0) as 0 | 10 | 21
      const total = payment.amount
      const subtotal = total / (1 + vatRate / 100)
      const vatAmount = total - subtotal

      return {
        description: `Pago - ${month}/${year}`,
        quantity: 1,
        unitPrice: subtotal,
        vatRate,
        subtotal,
        vatAmount,
        total,
        paymentId: payment.id,
        paymentType: 'payment',
      }
    })

    const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0)
    const totalVat = lineItems.reduce((sum, item) => sum + item.vatAmount, 0)
    const total = lineItems.reduce((sum, item) => sum + item.total, 0)

    // Calcular desglose de IVA
    const vatBreakdown: { [rate: number]: { base: number; vat: number } } = {}
    for (const item of lineItems) {
      if (!vatBreakdown[item.vatRate]) {
        vatBreakdown[item.vatRate] = { base: 0, vat: 0 }
      }
      vatBreakdown[item.vatRate].base += item.subtotal
      vatBreakdown[item.vatRate].vat += item.vatAmount
    }

    // 4. Construir dirección del cliente
    let customerAddress = ''
    if (player.address) {
      customerAddress = player.address
      if (player.postalCode) customerAddress += `, ${player.postalCode}`
      if (player.city) customerAddress += ` ${player.city}`
    }

    // 5. Crear factura
    const invoice = {
      id: invoiceId,
      invoiceNumber,
      series: 'FC',
      invoiceDate: admin.firestore.FieldValue.serverTimestamp(),
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      customerNif: player.dni || null,
      customerAddress: customerAddress || null,
      lineItems,
      subtotal: Math.round(subtotal * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      total: Math.round(total * 100) / 100,
      vatBreakdown,
      status: 'issued', // Emitir automáticamente
      paymentIds: payments.map((p) => p.id),
      notes: `Factura generada automáticamente el ${new Date().toLocaleDateString('es-ES')}`,
      createdBy: 'system',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      clubId: club.id,
    }

    const invoiceRef = db.collection('invoices').doc(invoiceId)
    transaction.set(invoiceRef, invoice)

    // 6. Actualizar payments con invoiceId
    for (const payment of payments) {
      for (const collectionName of paymentCollections) {
        const paymentRef = db.collection(collectionName).doc(payment.id)
        const paymentSnap = await transaction.get(paymentRef)

        if (paymentSnap.exists) {
          transaction.update(paymentRef, { invoiceId })
          break
        }
      }
    }

    // 7. Incrementar contador
    const counterPath = `invoiceCounters.${year}.FC`
    transaction.update(clubRef, {
      [counterPath]: admin.firestore.FieldValue.increment(1),
    })

    logger.info(`[generateInvoiceForPlayer] Created invoice ${invoiceNumber} for player ${player.id}`)
  })
}
