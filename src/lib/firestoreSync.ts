// ==========================================
// San Javier Academy Manager - Firestore Sync
// ==========================================
// Helpers genéricos de lectura y escritura para sincronización write-through
// con Firestore. Las escrituras son fire-and-forget para no bloquear la UI.

import { db } from './firebase'
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  runTransaction,
  writeBatch,
  updateDoc as firestoreUpdateDoc,
  limit,
  increment,
  serverTimestamp,
} from 'firebase/firestore'
import { toast } from '@/hooks/use-toast'

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
      result[key] = value.map((v) => (v instanceof Date ? Timestamp.fromDate(v) : v))
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
    const enrollmentsSnap = await getDocs(
      query(collection(db, 'enrollments'), where('clubId', '==', clubId), where('isActive', '==', true))
    )

    let batch = writeBatch(db)
    let count = 0
    let batchOps = 0

    for (const enrollDoc of enrollmentsSnap.docs) {
      const enrollment = enrollDoc.data()

      // Verificación server-side de duplicado
      const existingPayment = await getDocs(
        query(
          collection(db, 'payments'),
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
        concept: `Cuota ${enrollment.groupName} (${month}/${year})`,
        amount: enrollment.customPrice || 0,
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
