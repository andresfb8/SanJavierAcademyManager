/**
 * Script para crear el usuario director en Firebase Auth y Firestore.
 * Ejecutar con: npx tsx scripts/create-director.ts
 */
import { initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { getFirestore, doc, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'MISSING_API_KEY',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'san-javieracademy-manager.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'san-javieracademy-manager',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'san-javieracademy-manager.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '557815904781',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:557815904781:web:ab141e4f43a74cf67cf344',
  measurementId: 'G-T91CZRVVNM',
}

const EMAIL = 'andresfernandez@clubdepadelsanjavier.es'
const PASSWORD = process.env.ADMIN_PASSWORD || '123456' // In production, this must be provided via env
const DISPLAY_NAME = 'Andrés Fernández'

async function main() {
  if (firebaseConfig.apiKey === 'MISSING_API_KEY') {
    console.warn('⚠️ WARNING: VITE_FIREBASE_API_KEY is missing. Providing a dummy key for the script to run, but auth might fail if it relies on the real key.')
  }

  console.log('Inicializando Firebase...')
  const app = initializeApp(firebaseConfig)
  const auth = getAuth(app)
  const db = getFirestore(app)

  try {
    console.log(`Creando usuario: ${EMAIL}`)
    const credential = await createUserWithEmailAndPassword(auth, EMAIL, PASSWORD)
    const user = credential.user

    console.log(`Usuario creado con UID: ${user.uid}`)

    // Update display name in Firebase Auth
    await updateProfile(user, { displayName: DISPLAY_NAME })
    console.log(`Nombre actualizado: ${DISPLAY_NAME}`)

    // Create user document in Firestore
    const userDocRef = doc(db, 'users', user.uid)
    await setDoc(userDocRef, {
      email: EMAIL,
      displayName: DISPLAY_NAME,
      role: 'director',
      clubId: 'club-001',
      isActive: true,
      createdAt: new Date(),
    })
    console.log('Documento de usuario creado en Firestore (users/' + user.uid + ')')

    console.log('\n✓ Usuario director creado correctamente!')
    console.log(`  Email: ${EMAIL}`)
    console.log(`  Contraseña: ${PASSWORD}`)
    console.log(`  Rol: director`)
    console.log(`  UID: ${user.uid}`)

    process.exit(0)
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err.code === 'auth/email-already-in-use') {
      console.log('El usuario ya existe en Firebase Auth.')
      console.log(`Email: ${EMAIL}`)
      console.log('Puedes iniciar sesión directamente con las credenciales.')
    } else {
      console.error('Error:', err.message || error)
    }
    process.exit(1)
  }
}

main()
