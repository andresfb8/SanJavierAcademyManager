// ==========================================
// San Javier Academy Manager - Real-time Sync
// ==========================================
// Suscripción en tiempo real a las 19 colecciones Firestore con onSnapshot.
// Cuando cualquier dispositivo escribe un cambio, todos los listeners activos
// reciben la actualización automáticamente y actualizan el store de Zustand.

import { collection, doc, onSnapshot, query, where, documentId } from 'firebase/firestore'
import { db } from './firebase'
import { fromFirestore } from './firestoreSync'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'

const COLLECTIONS = [
  { name: 'courts', stateKey: 'courts' },
  { name: 'tariffs', stateKey: 'tariffs' },
  { name: 'players', stateKey: 'players' },
  { name: 'coaches', stateKey: 'coaches' },
  { name: 'groups', stateKey: 'groups' },
  { name: 'seasons', stateKey: 'seasons' },
  { name: 'metricSnapshots', stateKey: 'metricSnapshots' },
  { name: 'enrollments', stateKey: 'enrollments' },
  { name: 'privateLessons', stateKey: 'privateLessons' },
  { name: 'invitations', stateKey: 'invitations' },
  { name: 'events', stateKey: 'events' },
  { name: 'coachSalaryConfigs', stateKey: 'coachSalaryConfigs' },
  { name: 'users', stateKey: 'users' },
  { name: 'settings_holidays', stateKey: 'holidays' },
  { name: 'clubTransactions', stateKey: 'clubTransactions' },
  { name: 'payments', stateKey: 'payments' },
  { name: 'eventPayments', stateKey: 'eventPayments' },
  { name: 'privateLessonPayments', stateKey: 'privateLessonPayments' },
  { name: 'invoices', stateKey: 'invoices' },
  { name: 'attendance', stateKey: 'attendance' },
  { name: 'attendanceNotices', stateKey: 'attendanceNotices' },
  { name: 'cancelledClasses', stateKey: 'cancelledClasses' },
  { name: 'vouchers', stateKey: 'vouchers' },
  { name: 'activities', stateKey: 'activities' },
  { name: 'evaluations', stateKey: 'evaluations' },
  { name: 'matchReports', stateKey: 'matchReports' },
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
// Normaliza un documento CoachSalaryConfig migrando los campos viejos (pre-refactor)
// a los nuevos campos granulares. Esto garantiza compatibilidad hacia atrás cuando
// Firestore todavía tiene documentos con la estructura antigua.
export function normalizeSalaryConfig(doc: Record<string, unknown>): Record<string, unknown> {
  const d = { ...doc }
  // Si faltan los campos nuevos pero existen los viejos, migrarlos
  if (d.ratePerGroupAdults === undefined) {
    d.ratePerGroupAdults = (d.ratePerGroup as number | undefined) ?? 0
  }
  if (d.ratePerGroupMinors === undefined) {
    d.ratePerGroupMinors = 0
  }
  if (d.privateLessonPaymentType === undefined) {
    d.privateLessonPaymentType = 'fixed'
  }
  if (d.privateLessonRate === undefined) {
    d.privateLessonRate = (d.ratePerPrivateLesson as number | undefined) ?? 0
  }
  if (d.eventPaymentType === undefined) {
    d.eventPaymentType = 'percentage'
  }
  if (d.eventRate === undefined) {
    d.eventRate = 0
  }
  return d
}

export function subscribeToAllData(
  clubId: string,
  dbRole: string,
  onFirstLoad: () => void
): () => void {
  const unsubscribers: Array<() => void> = []
  const loaded = new Set<string>()

  // IMPORTANTE: `dbRole` debe ser el campo `role` del documento de usuario en
  // Firestore, NO `activeRole`. Las security rules resuelven los permisos con
  // `hasRole()` → `getUserData().get('role')`, así que el alcance de la
  // suscripción (qué colecciones y con qué filtro) tiene que calcularse con el
  // mismo rol que aplican las reglas; si no, o pedimos datos que las reglas
  // deniegan, o nos auto-restringimos de más.
  // Efecto secundario deseado: como `role` no cambia durante la sesión, cambiar
  // de rol activo con el RoleSwitcher no invalida estas suscripciones.

  // Filtrar colecciones según permisos del rol
  const allowedCollections = COLLECTIONS.filter(coll => {
    // Reglas de suscripción básicas por rol
    if (dbRole === 'director' || dbRole === 'coordinador') return true

    if (dbRole === 'entrenador') {
      // Entrenadores no ven finanzas ni configs de otros
      return !['coachSalaryConfigs', 'clubTransactions', 'invitations'].includes(coll.name)
    }

    if (dbRole === 'jugador' || dbRole === 'tutor') {
      // Jugadores solo ven lo esencial para su portal
      return ['players', 'groups', 'enrollments', 'attendance', 'payments', 'events', 'invoices', 'privateLessonPayments', 'eventPayments', 'attendanceNotices', 'vouchers', 'evaluations', 'matchReports'].includes(coll.name)
    }

    return true
  })

  // +1 for the club document listener
  const TOTAL = allowedCollections.length + 1
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

  for (const { name, stateKey } of allowedCollections) {
    let q = query(collection(db, name), where('clubId', '==', clubId))

    // Firebase Security Rules for 'jugador' and 'tutor' restrict reading ALL documents in certain collections.
    // We must narrow the query to match the security rules, otherwise the entire query is rejected.
    // Se usa el mismo `dbRole` que el filtro de colecciones (ver nota arriba).
    const currentUser = useAuthStore.getState().user

    if (dbRole === 'jugador' || dbRole === 'tutor') {
      const isPlayerRestricted = ['players', 'payments', 'privateLessonPayments', 'eventPayments', 'invoices', 'evaluations'].includes(name)
      if (isPlayerRestricted) {
        const playerIds = dbRole === 'tutor'
          ? (currentUser?.linkedPlayerIds?.length ? currentUser.linkedPlayerIds : ['none'])
          : (currentUser?.linkedPlayerId ? [currentUser.linkedPlayerId] : ['none'])

        // Use 'in' operator to get only the allowed players
        // Firestore limits 'in' queries to 10 elements.
        const safePlayerIds = playerIds.slice(0, 10)
        
        if (name === 'players') {
          q = query(collection(db, name), where('clubId', '==', clubId), where(documentId(), 'in', safePlayerIds))
        } else {
          q = query(collection(db, name), where('clubId', '==', clubId), where('playerId', 'in', safePlayerIds))
        }
      }
    }

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => {
          const data = fromFirestore(d.data() as Record<string, unknown>)
          const normalized = name === 'coachSalaryConfigs' ? normalizeSalaryConfig(data) : data
          return { ...normalized, id: d.id }
        })

        // Safety guard: no reemplazar datos locales con un resultado vacío que
        // provenga SOLO de la caché (fromCache) — evita el "flash" a vacío durante
        // la carga inicial u offline mientras el servidor aún no ha respondido.
        // Un vacío CONFIRMADO por el servidor (fromCache=false) sí se aplica: es un
        // borrado real (p.ej. eliminar el último recibo/inscripción del mes). Antes
        // se ignoraba cualquier snapshot vacío, dejando el elemento borrado en el
        // store y falseando cálculos derivados (tasa de cobro, ocupación, etc.).
        const current = (useDataStore.getState() as unknown as Record<string, unknown>)[stateKey]
        const currentCount = Array.isArray(current) ? current.length : 0

        if (docs.length === 0 && currentCount > 0 && snapshot.metadata.fromCache) {
          console.warn(
            `[realtimeSync] "${name}": snapshot vacío desde caché con ${currentCount} en store. ` +
            `Se ignora hasta confirmación del servidor.`
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
