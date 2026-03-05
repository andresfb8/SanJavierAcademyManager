// ==========================================
// San Javier Academy Manager - Real-time Sync
// ==========================================
// Suscripción en tiempo real a las 19 colecciones Firestore con onSnapshot.
// Cuando cualquier dispositivo escribe un cambio, todos los listeners activos
// reciben la actualización automáticamente y actualizan el store de Zustand.

import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { fromFirestore } from './firestoreSync'
import { useDataStore } from '@/stores/dataStore'

const COLLECTIONS = [
  { name: 'courts', stateKey: 'courts' },
  { name: 'tariffs', stateKey: 'tariffs' },
  { name: 'players', stateKey: 'players' },
  { name: 'coaches', stateKey: 'coaches' },
  { name: 'groups', stateKey: 'groups' },
  { name: 'enrollments', stateKey: 'enrollments' },
  { name: 'payments', stateKey: 'payments' },
  { name: 'attendance', stateKey: 'attendance' },
  { name: 'activities', stateKey: 'activities' },
  { name: 'privateLessons', stateKey: 'privateLessons' },
  { name: 'invitations', stateKey: 'invitations' },
  { name: 'events', stateKey: 'events' },
  { name: 'eventPayments', stateKey: 'eventPayments' },
  { name: 'privateLessonPayments', stateKey: 'privateLessonPayments' },
  { name: 'evaluations', stateKey: 'evaluations' },
  { name: 'matchReports', stateKey: 'matchReports' },
  { name: 'coachSalaryConfigs', stateKey: 'coachSalaryConfigs' },
  { name: 'invoices', stateKey: 'invoices' },
  { name: 'users', stateKey: 'users' },
  { name: 'settings_holidays', stateKey: 'holidays' },
] as const

/**
 * Suscribe a las colecciones del club y al documento de configuración en tiempo real.
 *
 * - Cada snapshot actualiza la colección correspondiente en el store de Zustand.
 * - El documento `clubs/{clubId}` también se escucha para sincronizar la
 *   configuración del club (IBAN, CIF, email, etc.) entre dispositivos.
 * - `onFirstLoad` se llama UNA SOLA VEZ cuando todos los listeners han recibido
 *   su primer snapshot (sirve para ocultar el spinner de carga inicial).
 * - Retorna una función que cancela todos los listeners (llamar al hacer logout).
 */
export function subscribeToAllData(
  clubId: string,
  onFirstLoad: () => void
): () => void {
  const unsubscribers: Array<() => void> = []
  const loaded = new Set<string>()
  // +1 for the club document listener
  const TOTAL = COLLECTIONS.length + 1
  let firstLoadCalled = false

  const markLoaded = (name: string) => {
    if (!loaded.has(name)) {
      loaded.add(name)
      if (!firstLoadCalled && loaded.size === TOTAL) {
        firstLoadCalled = true
        onFirstLoad()
      }
    }
  }

  for (const { name, stateKey } of COLLECTIONS) {
    const q = query(collection(db, name), where('clubId', '==', clubId))

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          ...fromFirestore(d.data() as Record<string, unknown>),
          id: d.id,
        }))

        // Safety guard: never replace existing local data with an empty Firestore
        // result. This prevents data loss when a Firestore write failed silently
        // (permission denied, wrong clubId) and the snapshot comes back empty.
        const current = (useDataStore.getState() as unknown as Record<string, unknown>)[stateKey]
        const currentCount = Array.isArray(current) ? current.length : 0

        if (docs.length === 0 && currentCount > 0) {
          console.warn(
            `[realtimeSync] "${name}": Firestore returned 0 docs but store has ${currentCount}. ` +
            `Skipping overwrite — check Firestore permissions and clubId on your documents.`
          )
          markLoaded(name)
          return
        }

        useDataStore.setState({ [stateKey]: docs })
        markLoaded(name)
      },
      (err) => {
        // Error de permisos u otro — no bloquear el spinner de carga
        console.error(`[realtimeSync] FAILED listening to "${name}":`, err)
        markLoaded(name)
      }
    )

    unsubscribers.push(unsub)
  }

  // Club document listener (single doc, not a collection query)
  // This ensures settings like IBAN, CIF, email are synced across all devices.
  const clubUnsub = onSnapshot(
    doc(db, 'clubs', clubId),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = fromFirestore(snapshot.data() as Record<string, unknown>)
        useDataStore.setState({ club: { ...data, id: clubId } as any })
      }
      markLoaded('clubs')
    },
    (err) => {
      console.error('[realtimeSync] FAILED listening to "clubs":', err)
      markLoaded('clubs')
    }
  )

  unsubscribers.push(clubUnsub)

  return () => unsubscribers.forEach((u) => u())
}
