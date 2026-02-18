import { create } from 'zustand'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { loadAllData, migrateLocalToFirestore } from '@/lib/dataLoader'
import type { AppUser, UserRole } from '@/types'

interface AuthState {
  user: AppUser | null
  isAuthenticated: boolean
  isLoading: boolean
  isDataLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: AppUser | null) => void
  initAuth: () => () => void
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

// Try to load user profile from Firestore, fallback to Auth data
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

  // Cargar todos los datos del club desde Firestore (fire-and-forget respecto al login)
  if (appUser.clubId) {
    setDataLoading(true)
    // Primero migrar datos de localStorage si Firestore está vacío
    migrateLocalToFirestore(appUser.clubId)
      .then(() => loadAllData(appUser.clubId))
      .catch((err) => console.warn('[Firestore] Error loading initial data:', err))
      .finally(() => setDataLoading(false))
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
    signOut(auth)
    set({ user: null, isAuthenticated: false, isDataLoading: false })
  },

  setUser: (user) => {
    set({ user, isAuthenticated: !!user })
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
    },
    coordinador: {
      dashboard: ['read', 'write'], players: ['read', 'write', 'delete', 'import', 'export'],
      groups: ['read', 'write', 'delete'], attendance: ['read', 'write'],
      payments: ['read', 'write', 'generate'], coaches: ['read', 'write', 'delete'],
      agenda: ['read', 'write'], settings: ['read', 'write'], users: [],
      informes: ['read', 'write', 'delete'], events: ['read', 'write', 'delete'],
    },
    entrenador: {
      dashboard: ['read'], players: ['read'], groups: ['read'],
      attendance: ['read', 'write'], payments: [], coaches: [],
      agenda: ['read'], settings: [], users: [],
      informes: ['read', 'write'], events: ['read'],
    },
    jugador: {
      dashboard: ['read'], players: ['read'], groups: ['read'],
      attendance: ['read'], payments: ['read'], coaches: [],
      agenda: ['read'], settings: [], users: [],
      informes: ['read'], events: ['read'],
    },
    tutor: {
      dashboard: ['read'], players: ['read'], groups: ['read'],
      attendance: ['read'], payments: ['read'], coaches: [],
      agenda: ['read'], settings: [], users: [],
      informes: ['read'], events: ['read'],
    },
  }
  return permissions[role]?.[module]?.includes(action) ?? false
}
