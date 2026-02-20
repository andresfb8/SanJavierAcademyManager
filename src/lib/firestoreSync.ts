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
} from 'firebase/firestore'

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

// Escribe/sobreescribe un doc en Firestore.
// Retorna la Promise para que el caller pueda detectar errores de escritura.
export function syncDoc(
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
  clubId: string
): Promise<void> {
  const payload = toFirestore({ ...data, clubId })
  return setDoc(doc(db, collectionName, id), payload).catch((err) => {
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
