// ==========================================
// San Javier Academy Manager - Real-time Sync
// ==========================================
// Suscripción en tiempo real a las 17 colecciones Firestore con onSnapshot.
// Cuando cualquier dispositivo escribe un cambio, todos los listeners activos
// reciben la actualización automáticamente y actualizan el store de Zustand.

import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { fromFirestore } from './firestoreSync'
import { useDataStore } from '@/stores/dataStore'

const COLLECTIONS = [
  { name: 'courts',                stateKey: 'courts'                },
  { name: 'tariffs',               stateKey: 'tariffs'               },
  { name: 'players',               stateKey: 'players'               },
  { name: 'coaches',               stateKey: 'coaches'               },
  { name: 'groups',                stateKey: 'groups'                },
  { name: 'enrollments',           stateKey: 'enrollments'           },
  { name: 'payments',              stateKey: 'payments'              },
  { name: 'attendance',            stateKey: 'attendance'            },
  { name: 'activities',            stateKey: 'activities'            },
  { name: 'privateLessons',        stateKey: 'privateLessons'        },
  { name: 'invitations',           stateKey: 'invitations'           },
  { name: 'events',                stateKey: 'events'                },
  { name: 'eventPayments',         stateKey: 'eventPayments'         },
  { name: 'privateLessonPayments', stateKey: 'privateLessonPayments' },
  { name: 'evaluations',           stateKey: 'evaluations'           },
  { name: 'matchReports',          stateKey: 'matchReports'          },
  { name: 'coachSalaryConfigs',    stateKey: 'coachSalaryConfigs'    },
] as const

/**
 * Suscribe a las 17 colecciones del club en tiempo real.
 *
 * - Cada snapshot actualiza la colección correspondiente en el store de Zustand.
 * - `onFirstLoad` se llama UNA SOLA VEZ cuando todos los listeners han recibido
 *   su primer snapshot (sirve para ocultar el spinner de carga inicial).
 * - Retorna una función que cancela los 17 listeners (llamar al hacer logout).
 */
export function subscribeToAllData(
  clubId: string,
  onFirstLoad: () => void
): () => void {
  const unsubscribers: Array<() => void> = []
  const loaded = new Set<string>()
  let firstLoadCalled = false

  const markLoaded = (name: string) => {
    if (!loaded.has(name)) {
      loaded.add(name)
      if (!firstLoadCalled && loaded.size === COLLECTIONS.length) {
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
        // Shallow merge — solo reemplaza esta colección, deja el resto intacto
        useDataStore.setState({ [stateKey]: docs })
        markLoaded(name)
      },
      (err) => {
        // Error de permisos u otro — no bloquear el spinner de carga
        console.warn(`[realtimeSync] Error en colección "${name}":`, err)
        markLoaded(name)
      }
    )

    unsubscribers.push(unsub)
  }

  return () => unsubscribers.forEach((u) => u())
}
