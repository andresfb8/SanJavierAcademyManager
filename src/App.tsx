import { useEffect, lazy, Suspense } from 'react'
import { useNotificationSetup } from '@/hooks/useNotificationSetup'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Toaster } from '@/components/ui/toaster'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const ActivateAccountPage = lazy(() => import('@/pages/ActivateAccountPage'))
const ActivateInvitationPage = lazy(() => import('@/pages/ActivateInvitationPage'))
const AuthenticatedApp = lazy(() => import('@/AuthenticatedApp'))

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Cargando...</p>
    </div>
  </div>
)

// Comprueba si hay sesión ANTES de renderizar AuthenticatedApp — si no la hay,
// redirige a /login sin llegar a disparar el import() perezoso del bundle
// autenticado (MainLayout, dataStore.ts y todas las páginas internas).
function AuthenticatedGate() {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <AuthenticatedApp />
}

export default function App() {
  const { initAuth, isLoading } = useAuthStore()

  useEffect(() => {
    const unsubscribe = initAuth()
    return unsubscribe
  }, [initAuth])

  // Solicita permiso de notificaciones y registra el token FCM tras login
  useNotificationSetup()

  if (isLoading) {
    return <PageLoader />
  }

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/activar-cuenta" element={<ActivateAccountPage />} />
          <Route path="/activar/:token" element={<ActivateInvitationPage />} />
          <Route path="/*" element={<AuthenticatedGate />} />
        </Routes>
      </Suspense>
      <Toaster />
    </>
  )
}
