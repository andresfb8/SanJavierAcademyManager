import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CalendarDays,
  Clock,
  MapPin,
  User,
  CheckCircle2,
  XCircle,
  Trophy,
  ChevronRight,
  CreditCard,
  MessageCircle,
  Ticket,
  RefreshCw,
  Award,
  ClipboardCheck,
} from 'lucide-react'
import { cn, formatDate, ensureDate } from '@/lib/utils'
import type { AttendanceNotice } from '@/types'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { PlayerPaymentsList } from '@/components/player/PlayerPaymentsList'
import { VoucherCard } from '@/components/vouchers/VoucherCard'
import { PlayerProgressSheet } from '@/components/player/PlayerProgressSheet'
import { usePlayerData } from '@/hooks/usePlayerData'
import {
  MisGruposCard,
  EstadoPagosCard,
  UltimasEvaluacionesCard,
  AsistenciaMensualChart,
  ProximosEventosCard,
  VouchersDesktopCard,
} from '@/components/player/PlayerDashboardCards'

export default function PlayerDashboard() {
  const { user } = useAuthStore()
  const {
    attendanceNotices,
    addAttendanceNotice,
    deleteAttendanceNotice,
    vouchers,
    evaluations,
    matchReports,
    events,
  } = useDataStore()

  const navigate = useNavigate()
  const [showPayments, setShowPayments] = useState(false)
  const [showVouchers, setShowVouchers] = useState(false)
  const [showProgress, setShowProgress] = useState(false)

  const {
    studentId,
    myGroups,
    nextClass,
    attendancePercent,
    pendingPaymentsCount,
    overduePaymentsCount,
    recoveryBalance,
    activeVouchersCount,
  } = usePlayerData()

  const now = new Date()

  // ── Aviso de asistencia para la próxima clase ─────────────────────────────
  const nextClassDateStr = nextClass ? nextClass.classDate.toISOString().split('T')[0] : ''
  const currentNotice = attendanceNotices.find(
    (n) =>
      n.playerId === studentId &&
      n.groupId === nextClass?.group.id &&
      (ensureDate(n.date).toISOString().split('T')[0]) === nextClassDateStr
  )

  const handleAttendanceNotice = (type: 'present' | 'absent') => {
    if (!studentId || !nextClass) return
    if (currentNotice) {
      deleteAttendanceNotice(currentNotice.id)
      if (currentNotice.type === type) return
    }
    const newNotice: Omit<AttendanceNotice, 'id' | 'createdAt'> = {
      playerId: studentId,
      playerName: user?.displayName || 'Alumno',
      groupId: nextClass.group.id,
      date: new Date(nextClassDateStr),
      type,
    }
    addAttendanceNotice(newNotice)
  }

  // ── Quick Actions (Mobile & Desktop) ───────────────────────────────────────
  const quickActions = [
    {
      label: 'Mi Próxima Clase',
      icon: CalendarDays,
      sub: nextClass
        ? `${formatDate(ensureDate(nextClass.classDate))} · ${nextClass.slot.startTime}`
        : 'Sin clases próximas',
      color: 'bg-emerald-50 text-emerald-600',
      onClick: () => {
        if (nextClass) navigate(`/grupos/${nextClass.group.id}`)
      },
    },
    {
      label: 'Mis Pagos',
      icon: CreditCard,
      sub:
        overduePaymentsCount > 0
          ? `${overduePaymentsCount} vencido${overduePaymentsCount > 1 ? 's' : ''}`
          : pendingPaymentsCount > 0
          ? `${pendingPaymentsCount} pendiente${pendingPaymentsCount > 1 ? 's' : ''}`
          : 'Al día ✓',
      color:
        overduePaymentsCount > 0
          ? 'bg-red-50 text-red-600'
          : pendingPaymentsCount > 0
          ? 'bg-amber-50 text-amber-600'
          : 'bg-emerald-50 text-emerald-600',
      onClick: () => setShowPayments(true),
    },
    {
      label: 'Mi Asistencia',
      icon: ClipboardCheck,
      sub: `${attendancePercent}% este mes`,
      color: 'bg-blue-50 text-blue-600',
      onClick: () => navigate('/asistencia'),
    },
    {
      label: 'Mi Perfil',
      icon: User,
      sub: 'Ver ficha completa',
      color: 'bg-slate-100 text-slate-600',
      onClick: () => {
        if (studentId) navigate(`/jugadores/${studentId}`)
      },
    },
  ]

  const renderNextClassWidget = () => {
    if (nextClass) {
      return (
        <Card className="border-none shadow-2xl shadow-emerald-900/10 rounded-[2.5rem] overflow-hidden bg-white">
          <div className="bg-emerald-600 p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                <CalendarDays className="h-24 w-24" />
              </div>
              <div className="flex items-center justify-between mb-4 relative z-10">
                <Badge className="bg-white/20 text-white border-none px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                  Próxima Clase
                </Badge>
                <div className="flex items-center gap-1.5 text-emerald-100 text-[11px] font-bold">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDate(ensureDate(nextClass.classDate))} · {nextClass.slot.startTime}
                </div>
              </div>
              <h2 className="text-2xl font-black mb-1 relative z-10">{nextClass.group.name}</h2>
              <div className="flex items-center gap-4 text-emerald-100 text-xs relative z-10 opacity-90">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {nextClass.group.courtName}
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {nextClass.group.coachName}
                </div>
              </div>
            </div>

            <CardContent className="p-6 space-y-4">
              {nextClass.diffHours <= 48 ? (
                <>
                  <div className="flex justify-between items-end mb-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">¿Asistirás a clase?</p>
                    <span className="text-[10px] font-bold text-slate-300">Responde antes de 24h</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className={cn(
                        'h-16 rounded-[1.25rem] border-2 font-black transition-all active:scale-95 text-sm',
                        currentNotice?.type === 'present'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-lg shadow-emerald-100'
                          : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                      )}
                      onClick={() => handleAttendanceNotice('present')}
                    >
                      <CheckCircle2 className={cn('h-5 w-5 mr-2', currentNotice?.type === 'present' ? 'text-emerald-500' : 'text-slate-300')} />
                      Sí, voy
                    </Button>
                    <Button
                      variant="outline"
                      className={cn(
                        'h-16 rounded-[1.25rem] border-2 font-black transition-all active:scale-95 text-sm',
                        currentNotice?.type === 'absent'
                          ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-lg shadow-rose-100'
                          : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                      )}
                      onClick={() => handleAttendanceNotice('absent')}
                    >
                      <XCircle className={cn('h-5 w-5 mr-2', currentNotice?.type === 'absent' ? 'text-rose-500' : 'text-slate-300')} />
                      No puedo
                    </Button>
                  </div>
                  {currentNotice?.type === 'absent' && (
                    <div className="bg-amber-50 rounded-2xl p-4 flex gap-3 items-start animate-in slide-in-from-top-2 duration-500 mt-4 border border-amber-100/50">
                      <div className="h-8 w-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                        <MessageCircle className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] text-amber-800 font-bold leading-tight">
                          Aviso enviado a tu entrenador.
                        </p>
                        {nextClass.diffHours >= 24 ? (
                          <p className="text-[10px] text-emerald-600 font-black uppercase tracking-tight">
                            ✓ Crédito de recuperación asegurado (+24h)
                          </p>
                        ) : (
                          <p className="text-[10px] text-rose-400 font-bold italic">
                            Aviso tardío: no se generará crédito automático.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-6 border-2 border-dashed border-slate-50 rounded-[2rem]">
                  <div className="bg-slate-50 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-300">
                    <Clock className="h-6 w-6" />
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Confirmación en {Math.floor((nextClass.diffHours - 48) / 24)} días
                  </p>
                  <p className="text-[10px] font-bold text-slate-300 mt-1">
                    Se abre 48 horas antes del inicio
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
      )
    }
    
    return (
      <Card className="border-none shadow-sm rounded-[2.5rem] p-10 text-center bg-white border border-slate-50">
        <CalendarDays className="h-12 w-12 text-slate-200 mx-auto mb-4" />
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Sin clases próximas</h3>
        <p className="text-xs text-slate-300 mt-1 font-bold">Tu agenda está despejada por ahora</p>
      </Card>
    )
  }


  return (
    <div className="min-h-screen bg-slate-50/50 pb-24 lg:pb-6">
      <Header title="Mi Portal" />

      {/* ── MOBILE LAYOUT (< lg) ───────────────────────────────────────── */}
      <div className="max-w-md mx-auto px-5 py-6 space-y-6 lg:hidden">
        {/* Saludo */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
              Hola, {user?.displayName?.split(' ')[0]}
            </h1>
            <p className="text-sm font-medium text-slate-400">{formatDate(now)}</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-100/50">
            <Trophy className="h-6 w-6" />
          </div>
        </div>

        {/* Botones de acción rápida — móvil */}
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.label}
                onClick={action.onClick}
                className="flex flex-col gap-2 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm text-left active:scale-95 transition-all hover:shadow-md"
              >
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', action.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 leading-tight">{action.label}</p>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">{action.sub}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Widget Próxima Clase */}
        {renderNextClassWidget()}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-none shadow-lg shadow-slate-200/50 rounded-[2rem] bg-white p-6 border border-slate-50">
            <div className="flex items-center justify-between mb-2">
              <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center">
                <RefreshCw className="h-5 w-5" />
              </div>
              <span className="text-3xl font-black text-slate-800 tracking-tighter">{recoveryBalance}</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Recuperaciones</p>
            <p className="text-[9px] font-bold text-slate-300">Válidas 60 días</p>
          </Card>

          <Card
            className="border-none shadow-lg shadow-slate-200/50 rounded-[2rem] bg-white p-6 border border-slate-50 cursor-pointer active:scale-95 transition-all group"
            onClick={() => setShowPayments(true)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="h-10 w-10 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CreditCard className="h-5 w-5" />
              </div>
              <ChevronRight className="h-5 w-5 text-slate-200 group-hover:text-amber-400 transition-colors" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mis Pagos</p>
            <p className="text-[9px] font-bold text-amber-500 mt-1 uppercase tracking-tight">Gestionar →</p>
          </Card>
        </div>

        {/* Seguimiento y Bonos */}
        <div className="space-y-4 pt-2">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Seguimiento y Bonos</h3>
          <div className="grid grid-cols-1 gap-3">
            <Card
              className="border-none shadow-lg shadow-slate-200/40 rounded-[1.75rem] bg-white p-5 cursor-pointer active:scale-98 transition-all flex items-center justify-between group border border-slate-50"
              onClick={() => setShowProgress(true)}
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800">Mi Progreso</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                    {evaluations.filter((e) => e.playerId === studentId).length} Evaluaciones · {matchReports.filter((m) => m.playerIds.includes(studentId || '')).length} Informes
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-200 group-hover:text-indigo-500 transition-colors" />
            </Card>

            <Card
              className="border-none shadow-lg shadow-slate-200/40 rounded-[1.75rem] bg-white p-5 cursor-pointer active:scale-98 transition-all flex items-center justify-between group border border-slate-50"
              onClick={() => setShowVouchers(true)}
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-all duration-300">
                  <Ticket className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800">Mis Bonos</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                    {activeVouchersCount} Activos · Ver clases restantes
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-200 group-hover:text-purple-500 transition-colors" />
            </Card>
          </div>
        </div>

        {/* Agenda Semanal */}
        <div className="space-y-4 pt-2">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Mi Agenda Semanal</h3>
          <div className="space-y-3">
            {myGroups.length === 0 ? (
              <div className="bg-slate-50 rounded-[2rem] p-8 text-center border-2 border-dashed border-slate-100">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Sin grupos asignados</p>
              </div>
            ) : (
              myGroups.map((group) => (
                <div
                  key={group.id}
                  className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-100/50 flex items-center justify-between hover:border-emerald-100 transition-colors group cursor-pointer"
                  onClick={() => navigate(`/grupos/${group.id}`)}
                >
                  <div className="flex items-center gap-5">
                    <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-all duration-300">
                      <CalendarDays className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-[15px] font-black text-slate-800 leading-tight">{group.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                        {group.schedule.map((s) => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][s.dayOfWeek]).join(', ')} · {group.coachName}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-200 group-hover:text-emerald-500 transition-colors" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── DESKTOP LAYOUT (≥ lg) — 3 column grid ─────────────────────── */}
      <div className="hidden lg:block px-8 py-8 max-w-7xl mx-auto">
        {/* Saludo Desktop */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Hola, {user?.displayName?.split(' ')[0]} 👋
            </h1>
            <p className="text-sm font-medium text-slate-400 mt-1">{formatDate(now)}</p>
          </div>
          <div className="flex items-center gap-3">
            {pendingPaymentsCount > 0 && (
              <Badge variant="destructive" className="px-3 py-1.5 text-sm">
                {overduePaymentsCount > 0 ? `${overduePaymentsCount} pagos vencidos` : `${pendingPaymentsCount} pagos pendientes`}
              </Badge>
            )}
          </div>
        </div>

        {/* Quick Actions Desktop */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.label}
                onClick={action.onClick}
                className="flex items-center gap-4 p-5 rounded-[1.5rem] bg-white border border-slate-100 shadow-sm text-left hover:shadow-md hover:border-slate-200 transition-all active:scale-95 group"
              >
                <div className={cn('h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110', action.color)}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800 leading-tight">{action.label}</p>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">{action.sub}</p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Columna izquierda */}
          <div className="col-span-1 space-y-4">
            {renderNextClassWidget()}
            <MisGruposCard groups={myGroups} />
            {studentId && (
              <EstadoPagosCard
                pendingCount={pendingPaymentsCount}
                overdueCount={overduePaymentsCount}
                studentId={studentId}
                onClick={() => setShowPayments(true)}
              />
            )}
          </div>

          {/* Columna central */}
          <div className="col-span-1 space-y-4">
            {studentId && (
              <UltimasEvaluacionesCard
                evaluations={evaluations}
                studentId={studentId}
                onClick={() => setShowProgress(true)}
              />
            )}
            {studentId && (
              <AsistenciaMensualChart
                studentId={studentId}
                groupIds={myGroups.map((g) => g.id)}
              />
            )}
          </div>

          {/* Columna derecha */}
          <div className="col-span-1 space-y-4">
            <ProximosEventosCard events={events} studentId={studentId ?? ''} />
            {studentId && <VouchersDesktopCard studentId={studentId} onClick={() => setShowVouchers(true)} />}

            {/* Recuperaciones (desktop) */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <RefreshCw className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800">{recoveryBalance}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Recuperaciones disponibles</p>
                <p className="text-[11px] text-slate-300">Válidas 60 días</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SHEETS (shared mobile & desktop) ────────────────────────────── */}
      <PlayerProgressSheet
        open={showProgress}
        onOpenChange={setShowProgress}
        studentId={studentId || ''}
      />

      {/* Payments Sheet */}
      <Sheet open={showPayments} onOpenChange={setShowPayments}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-[2.5rem] p-0 overflow-hidden border-none bg-slate-50">
          <div className="p-6 pb-2">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
            <h2 className="text-xl font-black text-slate-800 mb-1">Mis Pagos y Facturas</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Historial completo</p>
          </div>
          <div className="px-5 pb-20 h-full overflow-y-auto">
            {studentId && <PlayerPaymentsList playerId={studentId} />}
          </div>
        </SheetContent>
      </Sheet>

      {/* Vouchers Sheet */}
      <Sheet open={showVouchers} onOpenChange={setShowVouchers}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-[2.5rem] p-0 overflow-hidden border-none bg-slate-50">
          <div className="p-6 pb-2">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
            <h2 className="text-xl font-black text-slate-800 mb-1">Mis Bonos</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Clases disponibles y consumidas</p>
          </div>
          <div className="px-5 pb-20 h-full overflow-y-auto space-y-4">
            {studentId && (() => {
              const myVouchers = vouchers.filter((v) => v.playerId === studentId)
              if (myVouchers.length === 0) {
                return (
                  <div className="text-center py-10 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <Ticket className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-500">No tienes bonos activos.</p>
                    <p className="text-xs text-slate-400 mt-1">Contacta con la academia para comprar uno.</p>
                  </div>
                )
              }
              return (
                <div className="space-y-3">
                  {myVouchers.map((voucher) => (
                    <VoucherCard key={voucher.id} voucher={voucher} />
                  ))}
                </div>
              )
            })()}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
