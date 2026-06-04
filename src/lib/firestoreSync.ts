// ==========================================
// San Javier Academy Manager - Firestore Sync
// ==========================================
// Helpers genéricos de lectura y escritura para sincronización write-through
// con Firestore. Las escrituras son fire-and-forget para no bloquear la UI.

import { 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch, 
  doc, 
  Timestamp, 
  serverTimestamp, 
  increment,
  runTransaction,
  limit,
  setDoc,
  deleteDoc,
  updateDoc as firestoreUpdateDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import { toast } from '@/hooks/use-toast'
import type { Invoice, Payment, Enrollment } from '@/types'
import { MONTHS } from '@/constants'
import { isBillingMonth } from './billing-utils'

// Convierte Timestamps de Firestore a Date de JS (recursivo en arrays)
export function fromFirestore(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      result[key] = value.toDate()
    } else if (Array.isArray(value)) {
      result[key] = value.map((v) => (v instanceof Timestamp ? v.toDate() : v))
    } else {
      result[key] = value
    }
  }
  return result
}

// Convierte Dates a Timestamps de Firestore; omite funciones
export function toFirestore(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || typeof value === 'function') {
      // Omit: Firestore doesn't support undefined or functions
    } else if (value instanceof Date) {
      result[key] = Timestamp.fromDate(value)
    } else if (Array.isArray(value)) {
      result[key] = value.map((v) => {
        if (v instanceof Date) return Timestamp.fromDate(v)
        if (v !== null && typeof v === 'object') return toFirestore(v as Record<string, unknown>)
        return v
      })
    } else if (value !== null && typeof value === 'object') {
      // Recursively clean nested objects (e.g. guardian, which has optional string fields)
      result[key] = toFirestore(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result
}

// Lee todos los docs de una colección para un club concreto
export async function loadCollection<T>(
  collectionName: string,
  clubId: string
): Promise<T[]> {
  const q = query(
    collection(db, collectionName),
    where('clubId', '==', clubId)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({
    ...fromFirestore(d.data() as Record<string, unknown>),
    id: d.id,
  })) as T[]
}

// Escribe/sobreescribe un doc en Firestore con opciones de merge y validación.
// Retorna la Promise para que el caller pueda detectar errores de escritura.
// NOTA: Por defecto usa { merge: true } para evitar conflictos Last-Write-Wins
export async function syncDoc(
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
  clubId: string,
  options?: { merge?: boolean; validate?: boolean }
): Promise<void> {
  const payload = toFirestore({ ...data, clubId })
  const docRef = doc(db, collectionName, id)
  const shouldMerge = options?.merge ?? true // Default a merge para evitar LWW

  // Validación: verificar que el documento existe antes de actualizar
  if (options?.validate) {
    return runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef)
      if (!docSnap.exists()) {
        throw new Error(`Document ${collectionName}/${id} does not exist`)
      }
      transaction.set(docRef, payload, { merge: shouldMerge })
    })
  }

  return setDoc(docRef, payload, { merge: shouldMerge }).catch((err) => {
    console.error(`[Firestore] FAILED syncing ${collectionName}/${id}:`, err)
    throw err
  })
}

// Elimina un doc en Firestore (fire-and-forget, no bloquea la UI)
export function deleteFirestoreDoc(collectionName: string, id: string): void {
  deleteDoc(doc(db, collectionName, id)).catch((err) =>
    console.warn(`[Firestore] Error deleting ${collectionName}/${id}:`, err)
  )
}

// ==========================================
// Multi-Device Sync Improvements
// ==========================================

// Interface para cambios fallidos que se encolan
interface FailedSync {
  collectionName: string
  id: string
  data: Record<string, unknown>
  clubId: string
  timestamp: number
}

// Helper: obtener cola de syncs fallidos
function getFailedSyncQueue(): FailedSync[] {
  try {
    const stored = localStorage.getItem('sjam-failed-syncs')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// Helper: encolar un sync fallido para retry posterior
function queueFailedSync(
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
  clubId: string
): void {
  const queue = getFailedSyncQueue()
  queue.push({ collectionName, id, data, clubId, timestamp: Date.now() })
  localStorage.setItem('sjam-failed-syncs', JSON.stringify(queue))
  console.warn(`[Firestore] Sync queued for retry: ${collectionName}/${id}`)
}

// syncDoc con retry automático y exponential backoff
export async function syncDocWithRetry(
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
  clubId: string,
  options?: { retries?: number; showToast?: boolean; merge?: boolean }
): Promise<void> {
  const maxRetries = options?.retries ?? 2
  const showToast = options?.showToast ?? true // Mostrar toast por defecto

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await syncDoc(collectionName, id, data, clubId, {
        merge: options?.merge ?? true,
      })
      return // Éxito
    } catch (error) {
      if (attempt === maxRetries) {
        // Fallo final después de todos los reintentos
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(
          `[Firestore] Failed after ${maxRetries} retries: ${collectionName}/${id}`,
          errorMessage
        )

        if (showToast) {
          toast.error(`Error al guardar: ${errorMessage}`)
        }

        // Encolar para retry posterior
        queueFailedSync(collectionName, id, data, clubId)
        throw error
      }

      // Esperar antes de reintentar (exponential backoff: 1s, 2s, 4s...)
      const delay = 1000 * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
      console.info(`[Firestore] Retry ${attempt + 1}/${maxRetries}: ${collectionName}/${id}`)
    }
  }
}

// Reintentar todos los syncs fallidos en cola (llamar al login)
export async function retryFailedSyncs(): Promise<number> {
  const queue = getFailedSyncQueue()
  if (queue.length === 0) return 0

  console.info(`[Firestore] Retrying ${queue.length} failed syncs...`)
  let succeeded = 0
  const remaining: FailedSync[] = []

  for (const sync of queue) {
    try {
      await syncDoc(sync.collectionName, sync.id, sync.data, sync.clubId)
      succeeded++
      console.info(`[Firestore] Retry success: ${sync.collectionName}/${sync.id}`)
    } catch (error) {
      console.warn(`[Firestore] Retry failed: ${sync.collectionName}/${sync.id}`, error)
      remaining.push(sync)
    }
  }

  localStorage.setItem('sjam-failed-syncs', JSON.stringify(remaining))

  if (succeeded > 0) {
    console.info(`[Firestore] ${succeeded} pending changes synced successfully`)
    toast.success(`${succeeded} cambios pendientes sincronizados`)
  }

  return succeeded
}

// ==========================================
// Transacciones Atómicas para Race Conditions
// ==========================================

// Sincroniza enrollment con incremento atómico del contador del grupo
export async function syncEnrollmentWithGroupCounter(
  enrollmentId: string,
  enrollmentData: Record<string, unknown>,
  groupId: string,
  delta: number, // +1 para agregar, -1 para eliminar
  clubId: string
): Promise<void> {
  return runTransaction(db, async (transaction) => {
    const groupRef = doc(db, 'groups', groupId)
    const groupSnap = await transaction.get(groupRef)

    if (!groupSnap.exists()) {
      throw new Error('Grupo no encontrado')
    }

    // Validar capacidad si es inscripción nueva (delta > 0)
    if (delta > 0) {
      const groupData = groupSnap.data()
      const currentEnrollment = groupData.currentEnrollment || 0
      const maxCapacity = groupData.maxCapacity || 0

      if (currentEnrollment >= maxCapacity) {
        throw new Error('El grupo está lleno')
      }
    }

    // Escrituras atómicas
    const enrollmentRef = doc(db, 'enrollments', enrollmentId)
    transaction.set(enrollmentRef, toFirestore({ ...enrollmentData, clubId }))

    // Incremento/decremento atómico del contador
    transaction.update(groupRef, {
      currentEnrollment: increment(delta),
    })
  }).catch((error) => {
    console.error(`[Firestore] Transaction failed: ${error}`)
    throw error
  })
}

// Actualiza enrollment con incremento atómico del contador del grupo
export async function updateEnrollmentStatus(
  enrollmentId: string,
  groupId: string,
  isActive: boolean,
  clubId: string
): Promise<void> {
  return runTransaction(db, async (transaction) => {
    const enrollmentRef = doc(db, 'enrollments', enrollmentId)
    const enrollmentSnap = await transaction.get(enrollmentRef)

    if (!enrollmentSnap.exists()) {
      throw new Error('Inscripción no encontrada')
    }

    const currentData = enrollmentSnap.data()
    const wasActive = currentData.isActive

    // Solo actualizar si cambia el estado
    if (wasActive === isActive) {
      return // No hay cambio
    }

    // Actualizar enrollment
    transaction.update(enrollmentRef, {
      isActive,
      unenrollmentDate: isActive ? null : serverTimestamp(),
    })

    // Incrementar o decrementar contador del grupo
    const groupRef = doc(db, 'groups', groupId)
    const delta = isActive ? 1 : -1
    transaction.update(groupRef, {
      currentEnrollment: increment(delta),
    })
  })
}

// ==========================================
// Generación Atómica de Recibos Mensuales
// ==========================================

// Genera recibos mensuales con lock server-side para prevenir duplicados
export async function generateMonthlyReceiptsAtomic(
  clubId: string,
  month: number,
  year: number,
  userId: string,
  generateId: () => string
): Promise<number> {
  const generationId = `${clubId}-${year}-${month}`
  const generationRef = doc(db, 'receiptGenerations', generationId)

  // Paso 1: Adquirir lock con transacción
  try {
    await runTransaction(db, async (transaction) => {
      const generationSnap = await transaction.get(generationRef)

      if (generationSnap.exists()) {
        const data = generationSnap.data()
        if (data.status === 'completed') {
          throw new Error('Los recibos ya han sido generados para este mes')
        }
        if (data.status === 'pending') {
          throw new Error('Ya hay una generación de recibos en proceso')
        }
      }

      // Marcar como pending (previene otros dispositivos)
      transaction.set(generationRef, {
        id: generationId,
        clubId,
        year,
        month,
        generatedAt: serverTimestamp(),
        generatedBy: userId,
        status: 'pending',
        receiptCount: 0,
      })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.warn(`[generateReceipts] Lock failed: ${message}`)
    throw error
  }

  // Paso 2: Generar recibos con validación de duplicados
  try {
    // Pre-cargar grupos para obtener precio y frecuencia de facturación
    const groupsSnap = await getDocs(
      query(collection(db, 'groups'), where('clubId', '==', clubId))
    )
    const groupsMap = new Map<string, { defaultTariffPrice: number; billingFrequency: string; startDate: any; installmentPrices?: Record<string, number> }>()
    for (const groupDoc of groupsSnap.docs) {
      const g = groupDoc.data()
      groupsMap.set(groupDoc.id, {
        defaultTariffPrice: g.defaultTariffPrice ?? 0,
        billingFrequency: g.billingFrequency ?? 'monthly',
        startDate: g.startDate,
        installmentPrices: g.installmentPrices,
      })
    }

    const enrollmentsSnap = await getDocs(
      query(collection(db, 'enrollments'), where('clubId', '==', clubId), where('isActive', '==', true))
    )

    let batch = writeBatch(db)
    let count = 0
    let batchOps = 0

    for (const enrollDoc of enrollmentsSnap.docs) {
      const enrollment = enrollDoc.data()

      // Obtener datos del grupo para precio y frecuencia
      const group = groupsMap.get(enrollment.groupId)
      if (!group) {
        console.warn(`[generateReceipts] Group ${enrollment.groupId} not found for enrollment ${enrollDoc.id}, skipping`)
        continue
      }

      // Respetar frecuencia de facturación por matrícula (con fallback al grupo para matrículas antiguas)
      const freq = enrollment.billingFrequency ?? group.billingFrequency
      const anchor = enrollment.billingAnchorMonth ?? (
        group.startDate instanceof Date
          ? group.startDate.getMonth() + 1
          : new Date((group.startDate as any).toDate?.() ?? group.startDate).getMonth() + 1
      )

      if (!isBillingMonth(freq, anchor, month)) {
        continue
      }

      // For installments: additionally verify the specific month exists in the group's price map
      if (freq === 'installments') {
        const billingKey = `${year}-${String(month).padStart(2, '0')}`
        if (!group.installmentPrices || !group.installmentPrices[billingKey]) {
          continue
        }
      }

      // Verificación server-side de duplicado
      const existingPayment = await getDocs(
        query(
          collection(db, 'payments'),
          where('clubId', '==', clubId),
          where('enrollmentId', '==', enrollDoc.id),
          where('billingMonth', '==', month),
          where('billingYear', '==', year),
          limit(1)
        )
      )

      if (!existingPayment.empty) {
        console.info(`[generateReceipts] Payment already exists for enrollment ${enrollDoc.id}`)
        continue // Ya existe
      }

      // Calcular importe: customPrice tiene prioridad
      // Para plazos: usar el precio específico del mes (YYYY-MM), para mensual: usar precio base del grupo
      let baseAmount: number
      if (freq === 'installments' && group.installmentPrices) {
        const billingKey = `${year}-${String(month).padStart(2, '0')}`
        baseAmount = group.installmentPrices[billingKey] ?? group.defaultTariffPrice
      } else {
        baseAmount = group.defaultTariffPrice
      }
      const amount = enrollment.customPrice ?? baseAmount

      // Crear pago
      const paymentId = generateId()
      const dueDate = new Date(year, month - 1, 5) // Día 5 del mes

      batch.set(doc(db, 'payments', paymentId), {
        id: paymentId,
        clubId,
        playerId: enrollment.playerId,
        playerName: enrollment.playerName,
        enrollmentId: enrollDoc.id,
        groupId: enrollment.groupId,
        groupName: enrollment.groupName,
        concept: `${MONTHS[month - 1].label} ${year} - ${enrollment.groupName} · Cuota Socio`,
        amount,
        status: 'pendiente',
        category: 'cuota',
        billingMonth: month,
        billingYear: year,
        dueDate: Timestamp.fromDate(dueDate),
        autogenerated: true,
        createdAt: serverTimestamp(),
      })
      count++
      batchOps++

      // Límite de batch Firestore = 500
      if (batchOps >= 500) {
        await batch.commit()
        console.info(`[generateReceipts] Committed batch of ${batchOps} receipts`)
        batch = writeBatch(db)
        batchOps = 0
      }
    }

    // Commit del batch final
    if (batchOps > 0) {
      await batch.commit()
      console.info(`[generateReceipts] Committed final batch of ${batchOps} receipts`)
    }

    // Paso 3: Marcar como completado
    await firestoreUpdateDoc(generationRef, {
      status: 'completed',
      receiptCount: count,
    })

    console.info(`[generateReceipts] Successfully generated ${count} receipts for ${month}/${year}`)
    return count
  } catch (error) {
    // Marcar como failed
    await firestoreUpdateDoc(generationRef, {
      status: 'failed',
    }).catch((err) => console.error('[generateReceipts] Failed to update status:', err))

    console.error('[generateReceipts] Failed:', error)
    throw error
  }
}

// ==========================================
// Generación Atómica de Facturas
// ==========================================

/**
 * Crea una factura con transacción atómica que:
 * 1. Verifica que los pagos no tengan invoiceId (previene duplicados)
 * 2. Crea el documento de factura
 * 3. Actualiza todos los pagos con el invoiceId
 * 4. Incrementa el contador de facturas del club
 *
 * @param invoice Datos completos de la factura
 * @param paymentIds IDs de los pagos a vincular
 * @param clubId ID del club
 * @throws Error si algún pago ya está facturado o no existe
 */
export async function createInvoiceAtomic(
  invoice: Invoice,
  paymentIds: string[],
  clubId: string,
  newPayments?: Payment[]
): Promise<void> {
  // ─── DIAGNOSTIC LOGGING ────────────────────────────────────────────
  // Import auth to get current user UID and verify it matches Firestore expectations
  const { auth } = await import('./firebase')
  const currentUser = auth.currentUser
  console.log('[createInvoiceAtomic] DIAGNOSTIC:', {
    invoiceClubId: clubId,
    invoiceId: invoice.id,
    invoiceSeries: invoice.series,
    authUID: currentUser?.uid ?? 'NOT AUTHENTICATED',
    authEmail: currentUser?.email ?? 'N/A',
    paymentIds,
  })

  // Also check if we can read the user doc to verify permissions context
  try {
    const { doc: fsDoc, getDoc: fsGetDoc } = await import('firebase/firestore')
    if (currentUser) {
      const userSnap = await fsGetDoc(fsDoc(db, 'users', currentUser.uid))
      if (userSnap.exists()) {
        const userData = userSnap.data()
        // Log each field as a plain string so it's visible without expanding the object
        console.log(`[createInvoiceAtomic] USER role="${userData.role}" clubId="${userData.clubId}" isActive=${userData.isActive}`)
        console.log(`[createInvoiceAtomic] All user fields: ${JSON.stringify(userData)}`)
        if (userData.clubId !== clubId) {
          console.error(`[createInvoiceAtomic] ⚠️ MISMATCH: user.clubId="${userData.clubId}" !== transaction clubId="${clubId}"`)
        }
        if (userData.role !== 'director' && userData.role !== 'coordinador') {
          console.error(`[createInvoiceAtomic] ⚠️ ROLE NOT ADMIN: role="${userData.role}" (must be 'director' or 'coordinador')`)
        }
      } else {
        console.error('[createInvoiceAtomic] ⚠️ User document DOES NOT EXIST in Firestore for UID:', currentUser.uid)
      }
    }
  } catch (diagErr) {
    console.error('[createInvoiceAtomic] Diagnostic check failed:', diagErr)
  }
  // ─── END DIAGNOSTIC ────────────────────────────────────────────────

  return runTransaction(db, async (transaction) => {
    // Paso 1: Verificar que ningún pago tenga invoiceId (TODAS LAS LECTURAS PRIMERO)
    const paymentCollections = ['payments', 'eventPayments', 'privateLessonPayments']
    const paymentRefsToUpdate = [] // Guardamos las referencias para actualizar luego

    for (const paymentId of paymentIds) {
      let found = false

      for (const collectionName of paymentCollections) {
        const paymentRef = doc(db, collectionName, paymentId)
        const paymentSnap = await transaction.get(paymentRef)

        if (paymentSnap.exists()) {
          found = true
          const paymentData = paymentSnap.data()

          if (paymentData.invoiceId) {
            throw new Error(`El pago ${paymentId} ya está facturado`)
          }

          paymentRefsToUpdate.push(paymentRef)
          break
        }
      }

      if (!found) {
        throw new Error(`Pago ${paymentId} no encontrado`)
      }
    }

    // A PARTIR DE AQUÍ SOLO ESCRITURAS

    // Paso 1.5: Insertar nuevos pagos manuales vinculados a esta factura
    if (newPayments && newPayments.length > 0) {
      for (const payment of newPayments) {
        const paymentRef = doc(db, 'payments', payment.id)
        transaction.set(paymentRef, toFirestore({ ...payment, invoiceId: invoice.id, clubId }))
      }
    }

    // Paso 2: Crear la factura
    const invoiceRef = doc(db, 'invoices', invoice.id)
    transaction.set(invoiceRef, toFirestore({ ...invoice, clubId }))

    // Paso 3: Actualizar todos los pagos encontrados previamente
    for (const paymentRef of paymentRefsToUpdate) {
      transaction.update(paymentRef, { invoiceId: invoice.id })
    }

    // Paso 4: Incrementar contador del club
    const clubRef = doc(db, 'clubs', clubId)
    const year = new Date().getFullYear()
    const counterPath = `invoiceCounters.${year}.${invoice.series}`

    transaction.set(clubRef, {
      [counterPath]: increment(1),
    }, { merge: true })
  }).catch((error) => {
    console.error('[Firestore] createInvoiceAtomic failed:', error)
    throw error
  })
}

/**
 * Desvincula pagos de una factura atómicamente
 */
export async function unlinkPaymentsFromInvoiceAtomic(
  paymentIds: string[]
): Promise<void> {
  if (paymentIds.length === 0) return

  return runTransaction(db, async (transaction) => {
    const paymentCollections = ['payments', 'eventPayments', 'privateLessonPayments']

    for (const paymentId of paymentIds) {
      let found = false
      for (const collectionName of paymentCollections) {
        const paymentRef = doc(db, collectionName, paymentId)
        const paymentSnap = await transaction.get(paymentRef)

        if (paymentSnap.exists()) {
          transaction.update(paymentRef, { invoiceId: null })
          found = true
          break
        }
      }
      if (!found) {
        console.warn(`[Firestore] Payment ${paymentId} not found during unlinking`)
      }
    }
  })
}

// ==========================================
// Movimiento de Matrículas entre Grupos
// ==========================================

// Mueve una matrícula de un grupo a otro en una transacción atómica.
// Desactiva la matrícula actual y crea una nueva en el grupo destino.
export async function moveEnrollmentAtomic(
  oldEnrollmentId: string,
  oldGroupId: string,
  newEnrollmentId: string,
  newEnrollmentData: Record<string, unknown>,
  newGroupId: string,
  clubId: string
): Promise<void> {
  return runTransaction(db, async (transaction) => {
    // Read new group to check existence + capacity
    const newGroupRef = doc(db, 'groups', newGroupId)
    const newGroupSnap = await transaction.get(newGroupRef)

    if (!newGroupSnap.exists()) {
      throw new Error('Grupo destino no encontrado')
    }

    const newGroupData = newGroupSnap.data()
    if ((newGroupData.currentEnrollment ?? 0) >= (newGroupData.maxCapacity ?? 0)) {
      throw new Error('El grupo destino está lleno')
    }

    // Read old enrollment and group to validate state before writing
    const oldEnrollmentRef = doc(db, 'enrollments', oldEnrollmentId)
    const oldGroupRef = doc(db, 'groups', oldGroupId)

    const [oldEnrollmentSnap, oldGroupSnap] = await Promise.all([
      transaction.get(oldEnrollmentRef),
      transaction.get(oldGroupRef),
    ])

    if (!oldEnrollmentSnap.exists() || !oldEnrollmentSnap.data().isActive) {
      throw new Error('La inscripción original ya no está activa')
    }
    if (!oldGroupSnap.exists()) {
      throw new Error('Grupo origen no encontrado')
    }

    const newEnrollmentRef = doc(db, 'enrollments', newEnrollmentId)

    // Deactivate old enrollment
    transaction.update(oldEnrollmentRef, {
      isActive: false,
      unenrollmentDate: serverTimestamp(),
    })

    // Decrement old group counter
    transaction.update(oldGroupRef, {
      currentEnrollment: increment(-1),
    })

    // Create new enrollment
    transaction.set(newEnrollmentRef, toFirestore({ ...newEnrollmentData, clubId }))

    // Increment new group counter
    transaction.update(newGroupRef, {
      currentEnrollment: increment(1),
    })
  }).catch((error) => {
    console.error(`[Firestore] moveEnrollmentAtomic failed: ${error}`)
    throw error
  })
}
