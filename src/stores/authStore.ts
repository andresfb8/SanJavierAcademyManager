import { create } from 'zustand'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  createUserWithEmailAndPassword,
  type User as FirebaseUser,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { migrateLocalToFirestore } from '@/lib/dataLoader'
import { subscribeToAllData } from '@/lib/realtimeSync'
import { retryFailedSyncs } from '@/lib/firestoreSync'
import { useDataStore } from '@/stores/dataStore'
import type { AppUser, UserRole } from '@/types'

interface AuthState {
  user: AppUser | null
  isAuthenticated: boolean
  isLoading: boolean
  isDataLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  resetPassword: (email: string) => Promise<void>
  changePassword: (currentPass: string, newPass: string) => Promise<void>
  setUser: (user: AppUser | null) => void
  signupPlayer: (email: string, pass: string, playerId: string) => Promise<void>
  initAuth: () => () => void
}

// Mantiene el unsubscribe de los 17 listeners onSnapshot fuera del estado
// para evitar problemas de serialización y acceso desde cualquier función.
let _dataUnsubscribe: (() => void) | null = null

// Limpia todas las colecciones del store al hacer logout o cuando expira la sesión.
// Evita que el próximo usuario vea datos del usuario anterior en el mismo dispositivo.
function clearDataStore(): void {
  useDataStore.setState({
    courts: [],
    tariffs: [],
    players: [],
    coaches: [],
    groups: [],
    enrollments: [],
    privateLessons: [],
    invitations: [],
    events: [],
    coachSalaryConfigs: [],
    attendanceNotices: [],
    vouchers: [],
    attendance: [],
    payments: [],
    evaluations: [],
    matchReports: [],
    invoices: [],
  })
}

// Build an AppUser from Firebase Auth user data (fallback when Firestore is unavailable)
function buildUserFromAuth(firebaseUser: FirebaseUser): AppUser {
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email ?? '',
    displayName: firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? '',
    role: 'director',
    clubId: 'club-001',
    isActive: true,
    createdAt: new Date(),
  }
}

// Try to load user profile from Firestore, fallback to Auth data.
// Tras obtener el perfil, inicia los 17 listeners onSnapshot (tiempo real).
async function loadUserProfile(
  firebaseUser: FirebaseUser,
  setDataLoading: (v: boolean) => void
): Promise<AppUser> {
  let appUser: AppUser

  try {
    const userDocRef = doc(db, 'users', firebaseUser.uid)
    const userDoc = await getDoc(userDocRef)

    if (userDoc.exists()) {
      const data = userDoc.data()
      appUser = {
        id: firebaseUser.uid,
        email: data.email ?? firebaseUser.email ?? '',
        displayName: data.displayName ?? firebaseUser.displayName ?? '',
        role: data.role ?? 'director',
        clubId: data.clubId ?? 'club-001',
        linkedPlayerId: data.linkedPlayerId,
        linkedPlayerIds: data.linkedPlayerIds,
        isActive: data.isActive ?? true,
        createdAt: data.createdAt?.toDate?.() ?? new Date(),
      }
    } else {
      // No doc exists - try to create it, but don't fail if we can't
      appUser = buildUserFromAuth(firebaseUser)
      try {
        await setDoc(userDocRef, {
          email: appUser.email,
          displayName: appUser.displayName,
          role: appUser.role,
          clubId: appUser.clubId,
          isActive: appUser.isActive,
          createdAt: appUser.createdAt,
        })
      } catch {
        // Firestore write failed (permissions) - continue with Auth data
      }
    }
  } catch {
    // Firestore read failed - use Auth data as fallback
    appUser = buildUserFromAuth(firebaseUser)
  }

  // Iniciar sincronización en tiempo real con Firestore
  if (appUser.clubId) {
    setDataLoading(true)
    // Cancelar listeners previos antes de crear nuevos (guard para doble disparo de onAuthStateChanged)
    if (_dataUnsubscribe) {
      _dataUnsubscribe()
      _dataUnsubscribe = null
    }
    migrateLocalToFirestore(appUser.clubId)
      .then(() => {
        // Reintentar syncs fallidos de sesiones anteriores
        return retryFailedSyncs()
      })
      .then((retriedCount) => {
        if (retriedCount > 0) {
          console.info(`[Auth] Retried ${retriedCount} failed syncs on login`)
        }
        // Iniciar listeners en tiempo real
        _dataUnsubscribe = subscribeToAllData(appUser.clubId, appUser.role, () => {
          setDataLoading(false)
        })
      })
      .catch((err) => {
        console.warn('[Firestore] Error en carga inicial:', err)
        setDataLoading(false)
      })
  }

  return appUser
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isDataLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true })
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      const appUser = await loadUserProfile(
        credential.user,
        (v) => set({ isDataLoading: v })
      )
      set({ user: appUser, isAuthenticated: true, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  logout: () => {
    // 1. Cancelar los 17 listeners de Firestore
    if (_dataUnsubscribe) {
      _dataUnsubscribe()
      _dataUnsubscribe = null
    }
    // 2. Limpiar datos del store para el siguiente usuario
    clearDataStore()
    // 3. Cerrar sesión en Firebase Auth
    signOut(auth).catch(err => console.error('[Auth] Logout error:', err))
    set({ user: null, isAuthenticated: false, isDataLoading: false })
    
    // 4. Forzar redirección al login para limpiar cualquier estado residual del router
    window.location.href = '/login'
  },

  resetPassword: async (email: string) => {
    await sendPasswordResetEmail(auth, email)
  },

  changePassword: async (currentPass: string, newPass: string) => {
    const user = auth.currentUser
    if (!user || (!user.email && !user.uid)) throw new Error('Usuario no autenticado en Firebase')
    // We need to re-authenticate the user before changing the password
    const credential = EmailAuthProvider.credential(user.email || '', currentPass)
    await reauthenticateWithCredential(user, credential)
    await updatePassword(user, newPass)
  },

  setUser: (user) => {
    set({ user, isAuthenticated: !!user })
  },

  signupPlayer: async (email, pass, playerId) => {
    set({ isLoading: true })
    try {
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, pass)
      
      // Crear perfil de usuario en Firestore con rol jugador
      const userDocRef = doc(db, 'users', firebaseUser.uid)
      await setDoc(userDocRef, {
        email,
        displayName: email.split('@')[0],
        role: 'jugador',
        clubId: 'club-001',
        linkedPlayerId: playerId,
        isActive: true,
        createdAt: new Date(),
      })
      
      // Note: onAuthStateChanged will handle the rest (loadUserProfile, etc)
    } finally {
      set({ isLoading: false })
    }
  },

  initAuth: () => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const appUser = await loadUserProfile(
          firebaseUser,
          (v) => set({ isDataLoading: v })
        )
        set({ user: appUser, isAuthenticated: true, isLoading: false })
      } else {
        // Sesión expirada o logout externo (otra pestaña, token caducado...)
        if (_dataUnsubscribe) {
          _dataUnsubscribe()
          _dataUnsubscribe = null
        }
        clearDataStore()
        set({ user: null, isAuthenticated: false, isLoading: false, isDataLoading: false })
      }
    })
    return unsubscribe
  },
}))

export function hasPermission(role: UserRole, module: string, action: string = 'read'): boolean {
  const permissions: Record<UserRole, Record<string, string[]>> = {
    director: {
      dashboard: ['read', 'write'], players: ['read', 'write', 'delete', 'import', 'export'],
      groups: ['read', 'write', 'delete'], attendance: ['read', 'write'],
      payments: ['read', 'write', 'generate'], coaches: ['read', 'write', 'delete'],
      agenda: ['read', 'write'], settings: ['read', 'write'], users: ['read', 'write', 'delete'],
      informes: ['read', 'write', 'delete'], events: ['read', 'write', 'delete'],
      informes_mensuales: ['read', 'generate'],
    },
    coordinador: {
      dashboard: ['read', 'write'], players: ['read', 'write', 'delete', 'import', 'export'],
      groups: ['read', 'write', 'delete'], attendance: ['read', 'write'],
      payments: ['read', 'write', 'generate'], coaches: ['read', 'write', 'delete'],
      agenda: ['read', 'write'], settings: ['read', 'write'], users: [],
      informes: ['read', 'write', 'delete'], events: ['read', 'write', 'delete'],
      informes_mensuales: ['read', 'generate'],
    },
    entrenador: {
      dashboard: ['read'], players: ['read'], groups: ['read'],
      attendance: ['read', 'write'], payments: [], coaches: [],
      agenda: ['read'], settings: ['read'], users: [],
      informes: ['read', 'write'], events: ['read'],
      informes_mensuales: [],
    },
    jugador: {
      dashboard: ['read'], players: ['read'], groups: ['read'],
      attendance: ['read'], payments: ['read'], coaches: [],
      agenda: ['read'], settings: [], users: [],
      informes: ['read'], events: ['read'],
      informes_mensuales: [],
    },
    tutor: {
      dashboard: ['read'], players: ['read'], groups: ['read'],
      attendance: ['read'], payments: ['read'], coaches: [],
      agenda: ['read'], settings: [], users: [],
      informes: ['read'], events: ['read'],
      informes_mensuales: [],
    },
  }
  return permissions[role]?.[module]?.includes(action) ?? false
}
