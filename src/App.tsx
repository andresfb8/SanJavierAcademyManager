import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore, hasPermission } from '@/stores/authStore'
import type { UserRole } from '@/types'
import { MainLayout } from '@/components/layout/MainLayout'
import { Toaster } from '@/components/ui/toaster'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const PlayersPage = lazy(() => import('@/pages/PlayersPage'))
const PlayerProfilePage = lazy(() => import('@/pages/PlayerProfilePage'))
const GroupsPage = lazy(() => import('@/pages/GroupsPage'))
const GroupDetailPage = lazy(() => import('@/pages/GroupDetailPage'))
const AttendancePage = lazy(() => import('@/pages/AttendancePage'))
const PaymentsPage = lazy(() => import('@/pages/PaymentsPage'))
const PlayerPaymentsPage = lazy(() => import('@/pages/PlayerPaymentsPage'))
const PlayerGroupsPage = lazy(() => import('@/pages/PlayerGroupsPage'))
const CoachesPage = lazy(() => import('@/pages/CoachesPage'))
const AgendaPage = lazy(() => import('@/pages/AgendaPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const PlanningPage = lazy(() => import('@/pages/PlanningPage'))
const MethodologyPage = lazy(() => import('@/pages/MethodologyPage'))
const UsersPage = lazy(() => import('@/pages/UsersPage'))
const ActivateAccountPage = lazy(() => import('@/pages/ActivateAccountPage'))
const EventsActivitiesPage = lazy(() => import('@/pages/EventsActivitiesPage'))
const EventDetailPage = lazy(() => import('@/pages/EventDetailPage'))
const PrivateLessonDetailPage = lazy(() => import('@/pages/PrivateLessonDetailPage'))
const ClassDetailPage = lazy(() => import('@/pages/ClassDetailPage'))
const CoachProfilePage = lazy(() => import('@/pages/CoachProfilePage'))
const EvaluacionesPage = lazy(() => import('@/pages/EvaluacionesPage'))
const ActivityLogPage = lazy(() => import('@/pages/ActivityLogPage'))
const InvoicesPage = lazy(() => import('@/pages/InvoicesPage'))
const ReportsPage = lazy(() => import('@/pages/ReportsPage'))
const FinancialsPage = lazy(() => import('@/pages/FinancialsPage'))
const PlayerDashboard = lazy(() => import('@/pages/PlayerDashboard'))
const CoachDashboard = lazy(() => import('@/pages/CoachDashboard'))
const FreeSlotsPage = lazy(() => import('@/pages/FreeSlotsPage'))

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Cargando...</p>
    </div>
  </div>
)

function RoleRoute({
  children,
  module,
  action = 'read',
}: {
  children: React.ReactNode
  module: string
  action?: string
}) {
  const { user } = useAuthStore()
  const effectiveRole = (user?.activeRole ?? user?.role) as UserRole | undefined
  if (effectiveRole && !hasPermission(effectiveRole, module, action)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) {
    return <PageLoader />
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PaymentsRouter() {
  const { user } = useAuthStore()
  const activeRole = user?.activeRole ?? user?.role
  if (activeRole === 'jugador' || activeRole === 'tutor') {
    return <PlayerPaymentsPage />
  }
  return <PaymentsPage />
}

function GroupsRouter() {
  const { user } = useAuthStore()
  const activeRole = user?.activeRole ?? user?.role
  if (activeRole === 'jugador' || activeRole === 'tutor') {
    return <PlayerGroupsPage />
  }
  return <GroupsPage />
}

function PlayersRouter() {
  const { user } = useAuthStore()
  const activeRole = user?.activeRole ?? user?.role
  if (activeRole === 'jugador' || activeRole === 'tutor') {
    if (user?.linkedPlayerId) {
      return <Navigate to={`/jugadores/${user.linkedPlayerId}`} replace />
    }
    return <Navigate to="/" replace />
  }
  return <PlayersPage />
}

export default function App() {
  const { initAuth, isLoading, user } = useAuthStore()

  useEffect(() => {
    const unsubscribe = initAuth()
    return unsubscribe
  }, [initAuth])

  if (isLoading) {
    return <PageLoader />
  }

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/activar-cuenta" element={<ActivateAccountPage />} />
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/"
              element={(() => {
                const activeRole = user?.activeRole ?? user?.role
                if (activeRole === 'jugador') return <PlayerDashboard />
                if (activeRole === 'entrenador') return <CoachDashboard />
                return <DashboardPage />
              })()}
            />
            <Route path="/jugadores" element={<PlayersRouter />} />
            <Route path="/jugadores/:id" element={<PlayerProfilePage />} />
            <Route path="/grupos" element={<GroupsRouter />} />
            <Route path="/grupos/:id" element={<GroupDetailPage />} />
            <Route path="/asistencia" element={<AttendancePage />} />
            <Route path="/huecos" element={<FreeSlotsPage />} />
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/eventos" element={<EventsActivitiesPage />} />
            <Route path="/eventos/:id" element={<EventDetailPage />} />
            <Route path="/clases-particulares/:id" element={<PrivateLessonDetailPage />} />
            <Route path="/clases/:groupId/:date" element={<ClassDetailPage />} />
            <Route path="/pagos" element={<RoleRoute module="payments"><PaymentsRouter /></RoleRoute>} />
            <Route path="/facturas" element={<RoleRoute module="payments"><InvoicesPage /></RoleRoute>} />
            <Route path="/entrenadores" element={<RoleRoute module="coaches"><CoachesPage /></RoleRoute>} />
            {/* Sin RoleRoute: los entrenadores pueden ver su propio perfil */}
            <Route path="/entrenadores/:id" element={<CoachProfilePage />} />
            <Route path="/informes" element={<RoleRoute module="settings"><EvaluacionesPage /></RoleRoute>} />
            <Route path="/informes-mensuales" element={<RoleRoute module="informes_mensuales"><ReportsPage /></RoleRoute>} />
            <Route path="/finanzas" element={<RoleRoute module="informes_mensuales"><FinancialsPage /></RoleRoute>} />
            <Route path="/usuarios" element={<RoleRoute module="users"><UsersPage /></RoleRoute>} />
            <Route path="/configuracion" element={<RoleRoute module="settings"><SettingsPage /></RoleRoute>} />
            <Route path="/actividad" element={<RoleRoute module="settings"><ActivityLogPage /></RoleRoute>} />
            <Route path="/planificacion" element={<RoleRoute module="settings"><PlanningPage /></RoleRoute>} />
            <Route path="/methodology" element={<RoleRoute module="settings"><MethodologyPage /></RoleRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </>
  )
}
