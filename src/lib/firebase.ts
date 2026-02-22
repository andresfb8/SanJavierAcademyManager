import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCHK_Al4Sh6bqjiTXLuY84QO3A-rUR-oW8',
  authDomain: 'san-javieracademy-manager.firebaseapp.com',
  projectId: 'san-javieracademy-manager',
  storageBucket: 'san-javieracademy-manager.firebasestorage.app',
  messagingSenderId: '557815904781',
  appId: '1:557815904781:web:ab141e4f43a74cf67cf344',
  measurementId: 'G-T91CZRVVNM',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

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
