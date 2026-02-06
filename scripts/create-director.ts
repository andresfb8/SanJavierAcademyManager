/**
 * Script para crear el usuario director en Firebase Auth y Firestore.
 * Ejecutar con: npx tsx scripts/create-director.ts
 */
import { initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { getFirestore, doc, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCHK_Al4Sh6bqjiTXLuY84QO3A-rUR-oW8',
  authDomain: 'san-javieracademy-manager.firebaseapp.com',
  projectId: 'san-javieracademy-manager',
  storageBucket: 'san-javieracademy-manager.firebasestorage.app',
  messagingSenderId: '557815904781',
  appId: '1:557815904781:web:ab141e4f43a74cf67cf344',
  measurementId: 'G-T91CZRVVNM',
}

const EMAIL = 'andresfernandez@clubdepadelsanjavier.es'
const PASSWORD = '123456'
const DISPLAY_NAME = 'Andrés Fernández'

async function main() {
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
