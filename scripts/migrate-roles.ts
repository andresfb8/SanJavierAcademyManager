/**
 * scripts/migrate-roles.ts
 *
 * Script one-shot para añadir el campo roles[] a todos los usuarios existentes
 * que solo tienen el campo role (string).
 *
 * Uso: npx ts-node --esm scripts/migrate-roles.ts
 *
 * Requiere: GOOGLE_APPLICATION_CREDENTIALS o FIREBASE_SERVICE_ACCOUNT env var.
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Inicializar Firebase Admin si no está inicializado
if (getApps().length === 0) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  if (serviceAccount) {
    initializeApp({ credential: cert(JSON.parse(serviceAccount)) })
  } else {
    // Usa GOOGLE_APPLICATION_CREDENTIALS automáticamente
    initializeApp()
  }
}

const db = getFirestore()

async function migrateRoles() {
  console.log('[migrate-roles] Iniciando migración...')

  const usersSnap = await db.collection('users').get()
  const batch = db.batch()
  let migratedCount = 0

  for (const docSnap of usersSnap.docs) {
    const data = docSnap.data()
    // Solo migrar si NO tiene roles[] o está vacío
    if (!data.roles || !Array.isArray(data.roles) || data.roles.length === 0) {
      const primaryRole = data.role ?? 'jugador'
      batch.update(docSnap.ref, { roles: [primaryRole] })
      migratedCount++
      console.log(`  → ${docSnap.id}: role="${primaryRole}" → roles=["${primaryRole}"]`)
    } else {
      console.log(`  ✓ ${docSnap.id}: ya tiene roles=${JSON.stringify(data.roles)}`)
    }
  }

  if (migratedCount > 0) {
    await batch.commit()
    console.log(`\n[migrate-roles] ✅ Migrados ${migratedCount} de ${usersSnap.size} usuarios.`)
  } else {
    console.log(`\n[migrate-roles] ✅ Ningún usuario necesitó migración. Total: ${usersSnap.size}.`)
  }
}

migrateRoles().catch((err) => {
  console.error('[migrate-roles] ❌ Error:', err)
  process.exit(1)
})
