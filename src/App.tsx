import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { MainLayout } from '@/components/layout/MainLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import PlayersPage from '@/pages/PlayersPage'
import PlayerProfilePage from '@/pages/PlayerProfilePage'
import GroupsPage from '@/pages/GroupsPage'
import GroupDetailPage from '@/pages/GroupDetailPage'
import AttendancePage from '@/pages/AttendancePage'
import PaymentsPage from '@/pages/PaymentsPage'
import CoachesPage from '@/pages/CoachesPage'
import AgendaPage from '@/pages/AgendaPage'
import SettingsPage from '@/pages/SettingsPage'
import PlanningPage from '@/pages/PlanningPage'
import UsersPage from '@/pages/UsersPage'
import ActivateAccountPage from '@/pages/ActivateAccountPage'
import EventsActivitiesPage from '@/pages/EventsActivitiesPage'
import EventDetailPage from '@/pages/EventDetailPage'
import PrivateLessonDetailPage from '@/pages/PrivateLessonDetailPage'
import ClassDetailPage from '@/pages/ClassDetailPage'
import CoachProfilePage from '@/pages/CoachProfilePage'
import EvaluacionesPage from '@/pages/EvaluacionesPage'
import ActivityLogPage from '@/pages/ActivityLogPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { initAuth, isLoading } = useAuthStore()

  useEffect(() => {
    const unsubscribe = initAuth()
    return unsubscribe
  }, [initAuth])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/activar/:token" element={<ActivateAccountPage />} />
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/jugadores" element={<PlayersPage />} />
        <Route path="/jugadores/:id" element={<PlayerProfilePage />} />
        <Route path="/grupos" element={<GroupsPage />} />
        <Route path="/grupos/:id" element={<GroupDetailPage />} />
        <Route path="/asistencia" element={<AttendancePage />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/eventos" element={<EventsActivitiesPage />} />
        <Route path="/eventos/:id" element={<EventDetailPage />} />
        <Route path="/clases-particulares/:id" element={<PrivateLessonDetailPage />} />
        <Route path="/clases/:groupId/:date" element={<ClassDetailPage />} />
        <Route path="/pagos" element={<PaymentsPage />} />
        <Route path="/entrenadores" element={<CoachesPage />} />
        <Route path="/entrenadores/:id" element={<CoachProfilePage />} />
        <Route path="/informes" element={<EvaluacionesPage />} />
        <Route path="/usuarios" element={<UsersPage />} />
        <Route path="/configuracion" element={<SettingsPage />} />
        <Route path="/actividad" element={<ActivityLogPage />} />
        <Route path="/planificacion" element={<PlanningPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
