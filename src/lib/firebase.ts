import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getMessaging, isSupported } from 'firebase/messaging'
import { getFunctions } from 'firebase/functions'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'MISSING_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'san-javieracademy-manager.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'san-javieracademy-manager',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'san-javieracademy-manager.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '557815904781',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:557815904781:web:ab141e4f43a74cf67cf344',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-T91CZRVVNM',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app, 'europe-west1')

// Messaging — solo disponible en navegadores que lo soportan (no en Safari < 16.4 ni SSR)
export const messagingPromise = isSupported().then((supported) =>
  supported ? getMessaging(app) : null
)

// Exportar funciones de Firestore para transacciones y operaciones atómicas
export {
  runTransaction,
  writeBatch,
  increment,
  serverTimestamp,
  updateDoc,
  doc,
  collection,
} from 'firebase/firestore'

export default app
