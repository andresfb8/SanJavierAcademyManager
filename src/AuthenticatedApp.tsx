import { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore, hasPermission } from '@/stores/authStore'
import { useEffectiveStudent } from '@/hooks/usePlayerData'
import type { UserRole, PlayerStatus } from '@/types'
import { MainLayout } from '@/components/layout/MainLayout'
import { PersonasLayout } from '@/components/layout/PersonasLayout'
import { ClasesLayout } from '@/components/layout/ClasesLayout'

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
const PrivateLessonsPage = lazy(() => import('@/pages/PrivateLessonsPage'))
const EventsPage = lazy(() => import('@/pages/EventsPage'))
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
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'))
const FinancialAnalyticsPage = lazy(() => import('@/pages/FinancialAnalyticsPage'))
const SeasonsPage = lazy(() => import('@/pages/SeasonsPage'))

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

// Compartido por los cuatro wrappers de abajo, para no repetir la misma
// comprobacion cuatro veces mas en este archivo (ya aparece, cada una a su
// manera, en PaymentsRouter/PlayersRouter — no se tocan esos, fuera de
// alcance de este cambio).
function isPortalRole(role: UserRole | undefined) {
  return role === 'jugador' || role === 'tutor'
}

// Usado SOLO en la ruta antigua "/grupos" (fuera de ClasesLayout). Desde
// que GroupsPage perdio su <Header> propio (ahora vive en el topbar de
// ClasesLayout), quedarse aqui para personal del club dejaria la pagina
// sin ningun titulo — se redirige a la ruta nueva, ya con el topbar
// compartido. jugador/tutor siguen viendo su propia vista tal cual, sin
// redirigir (PlayerGroupsPage no depende de ClasesLayout).
function GroupsLegacyRedirect() {
  const { user } = useAuthStore()
  const activeRole = user?.activeRole ?? user?.role
  if (isPortalRole(activeRole)) {
    return <PlayerGroupsPage />
  }
  return <Navigate to="/clases/grupos" replace />
}

// Mismo motivo que GroupsLegacyRedirect, para "/asistencia". A diferencia
// de GroupsPage/PlayerGroupsPage (dos componentes distintos), AttendancePage
// ya distingue jugador/tutor internamente (vista "Mi Asistencia"), asi que
// para ellos se sigue renderizando tal cual — solo el personal del club se
// redirige a la ruta nueva, con el topbar compartido.
function AttendanceLegacyRedirect() {
  const { user } = useAuthStore()
  const activeRole = user?.activeRole ?? user?.role
  if (isPortalRole(activeRole)) {
    return <AttendancePage />
  }
  return <Navigate to="/clases/asistencia" replace />
}

// Simetrico a GroupsLegacyRedirect/AttendanceLegacyRedirect, pero en la
// direccion contraria: si jugador/tutor llega a /clases/grupos o
// /clases/asistencia (URL escrita a mano, marcador viejo — ningun enlace
// propio de su portal apunta aqui), se le devuelve a su ruta antigua en
// vez de mostrarle su vista correcta anidada bajo el topbar y las 6
// pestanas de personal del club (Parrilla/Eventos/Particulares no tienen
// proteccion de rol propia, asi que quedarian ahi mismo un clic).
function GroupsInClasesLayout() {
  const { user } = useAuthStore()
  const activeRole = user?.activeRole ?? user?.role
  if (isPortalRole(activeRole)) {
    return <Navigate to="/grupos" replace />
  }
  return <GroupsPage />
}

function AttendanceInClasesLayout() {
  const { user } = useAuthStore()
  const activeRole = user?.activeRole ?? user?.role
  if (isPortalRole(activeRole)) {
    return <Navigate to="/asistencia" replace />
  }
  return <AttendancePage />
}

function PlayersRouter({ initialStatusFilter }: { initialStatusFilter?: PlayerStatus }) {
  const { user } = useAuthStore()
  const { studentId } = useEffectiveStudent()
  const activeRole = user?.activeRole ?? user?.role
  if (activeRole === 'jugador' || activeRole === 'tutor') {
    if (studentId) {
      return <Navigate to={`/jugadores/${studentId}`} replace />
    }
    return <Navigate to="/" replace />
  }
  return <PlayersPage initialStatusFilter={initialStatusFilter} />
}

export default function AuthenticatedApp() {
  const { user } = useAuthStore()

  return (
    <Routes>
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
            if (activeRole === 'jugador' || activeRole === 'tutor') return <PlayerDashboard />
            if (activeRole === 'entrenador') return <CoachDashboard />
            return <DashboardPage />
          })()}
        />
        <Route path="/jugadores" element={<Navigate to="/personas/jugadores" replace />} />
        <Route path="/jugadores/:id" element={<PlayerProfilePage />} />
        <Route path="/personas" element={<PersonasLayout />}>
          <Route index element={<Navigate to="/personas/jugadores" replace />} />
          <Route path="jugadores" element={<PlayersRouter />} />
          <Route path="lista-espera" element={<PlayersRouter initialStatusFilter="lista_espera" />} />
          <Route path="entrenadores" element={<RoleRoute module="coaches"><CoachesPage /></RoleRoute>} />
          <Route path="usuarios" element={<RoleRoute module="users"><UsersPage /></RoleRoute>} />
        </Route>
        <Route path="/clases" element={<ClasesLayout />}>
          <Route index element={<Navigate to="/clases/parrilla" replace />} />
          <Route path="parrilla" element={<AgendaPage />} />
          <Route path="grupos" element={<GroupsInClasesLayout />} />
          <Route path="asistencia" element={<AttendanceInClasesLayout />} />
          <Route path="particulares" element={<PrivateLessonsPage />} />
          <Route path="eventos" element={<EventsPage />} />
          <Route path="metodologia" element={<RoleRoute module="settings"><MethodologyPage /></RoleRoute>} />
        </Route>
        <Route path="/agenda" element={<Navigate to="/clases/parrilla" replace />} />
        <Route path="/eventos" element={<Navigate to="/clases/eventos" replace />} />
        <Route path="/methodology" element={<Navigate to="/clases/metodologia" replace />} />
        {/* /grupos y /asistencia no son un simple <Navigate>: sirven
            contenido distinto a jugador/tutor (PlayerGroupsPage, vista "Mi
            Asistencia") que no debe quedar anidado bajo el topbar de
            ClasesLayout, asi que cada uno usa un wrapper que solo redirige
            al personal del club a la ruta /clases/* nueva. Ver
            GroupsLegacyRedirect/AttendanceLegacyRedirect mas arriba. */}
        <Route path="/grupos" element={<GroupsLegacyRedirect />} />
        <Route path="/grupos/:id" element={<GroupDetailPage />} />
        <Route path="/asistencia" element={<AttendanceLegacyRedirect />} />
        <Route path="/huecos" element={<FreeSlotsPage />} />
        <Route path="/eventos/:id" element={<EventDetailPage />} />
        <Route path="/clases-particulares/:id" element={<PrivateLessonDetailPage />} />
        <Route path="/clases/:groupId/:date" element={<ClassDetailPage />} />
        <Route path="/pagos" element={<RoleRoute module="payments"><PaymentsRouter /></RoleRoute>} />
        <Route path="/facturas" element={<RoleRoute module="payments"><InvoicesPage /></RoleRoute>} />
        <Route path="/entrenadores" element={<Navigate to="/personas/entrenadores" replace />} />
        {/* Sin RoleRoute: los entrenadores pueden ver su propio perfil */}
        <Route path="/entrenadores/:id" element={<CoachProfilePage />} />
        <Route path="/informes" element={<RoleRoute module="settings"><EvaluacionesPage /></RoleRoute>} />
        <Route path="/informes-mensuales" element={<RoleRoute module="informes_mensuales"><ReportsPage /></RoleRoute>} />
        <Route path="/finanzas" element={<RoleRoute module="informes_mensuales"><FinancialsPage /></RoleRoute>} />
        <Route path="/finanzas-analitica" element={<RoleRoute module="informes_mensuales"><FinancialAnalyticsPage /></RoleRoute>} />
        <Route path="/usuarios" element={<Navigate to="/personas/usuarios" replace />} />
        <Route path="/configuracion" element={<RoleRoute module="settings"><SettingsPage /></RoleRoute>} />
        <Route path="/actividad" element={<RoleRoute module="settings"><ActivityLogPage /></RoleRoute>} />
        <Route path="/temporadas" element={<RoleRoute module="settings"><SeasonsPage /></RoleRoute>} />
        <Route path="/planificacion" element={<RoleRoute module="settings"><PlanningPage /></RoleRoute>} />
        <Route path="/analitica" element={<RoleRoute module="settings"><AnalyticsPage /></RoleRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
