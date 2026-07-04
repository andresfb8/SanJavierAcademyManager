import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  CalendarDays,
  Clock,
  MapPin,
  User,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Trophy,
  ChevronRight,
  CreditCard,
  MessageCircle,
  Ticket,
  RefreshCw,
  Award,
  ClipboardCheck,
  BellOff,
  Star,
} from 'lucide-react'
import { cn, formatDate, ensureDate } from '@/lib/utils'
import type { AttendanceNotice } from '@/types'
import { useClassReviewsQuery } from '@/hooks/useQueries'
import { collection, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { PlayerPaymentsList } from '@/components/player/PlayerPaymentsList'
import { VoucherCard } from '@/components/vouchers/VoucherCard'
import { PlayerProgressSheet } from '@/components/player/PlayerProgressSheet'
import { ScheduleAbsenceDialog } from '@/components/player/ScheduleAbsenceDialog'
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
    cancelledClasses,
    attendance,
  } = useDataStore()

  const navigate = useNavigate()
  const [showPayments, setShowPayments] = useState(false)
  const [showVouchers, setShowVouchers] = useState(false)
  const [showProgress, setShowProgress] = useState(false)
  const [showAbsences, setShowAbsences] = useState(false)
  const [surveySkipped, setSurveySkipped] = useState(false)
  const [surveySubmitted, setSurveySubmitted] = useState(false)

  // ── Survey state ──────────────────────────────────────────────────────────
  const [surveyPunctual, setSurveyPunctual] = useState<boolean | null>(null)
  const [surveyUsedPhone, setSurveyUsedPhone] = useState<boolean | null>(null)
  const [surveyQuality, setSurveyQuality] = useState<number>(0)
  const [surveyComment, setSurveyComment] = useState('')
  const [surveySubmitting, setSurveySubmitting] = useState(false)

  const {
    studentId,
    student,
    myGroups,
    nextClass,
    attendancePercent,
    pendingPaymentsCount,
    overduePaymentsCount,
    recoveryBalance,
    activeVouchersCount,
  } = usePlayerData()

  const { data: myReviews = [], refetch: refetchReviews } = useClassReviewsQuery(studentId ?? undefined)

  const now = new Date()

  const activeRole = user?.activeRole ?? user?.role
  const isTutor = activeRole === 'tutor'
  const studentFirstName = student?.firstName ?? user?.displayName?.split(' ')[0] ?? ''
  const studentFullName = student
    ? `${student.firstName} ${student.lastName}`.trim()
    : user?.displayName || 'Alumno'

  // ── Cuestionario pendiente: clase en últimas 48h donde fui presente y no valoré ──
  // La encuesta la responde el propio jugador; se oculta para tutores.
  const pendingReview = useMemo(() => {
    if (!studentId || isTutor || surveySkipped || surveySubmitted) return null
    const cutoff = new Date(now)
    cutoff.setHours(cutoff.getHours() - 48)

    const reviewed = new Set(
      myReviews.map(r => `${r.groupId}-${r.date}`)
    )

    for (const record of attendance) {
      const d = record.date instanceof Date ? record.date : new Date(record.date)
      if (d < cutoff || d > now) continue
      const wasPresent = record.records.some(e => e.playerId === studentId && e.status === 'presente')
      if (!wasPresent) continue
      const dateStr = d.toISOString().split('T')[0]
      const key = `${record.groupId}-${dateStr}`
      if (!reviewed.has(key)) {
        return { ...record, dateStr }
      }
    }
    return null
  }, [attendance, studentId, isTutor, myReviews, surveySkipped, surveySubmitted])

  const handleSurveySubmit = async () => {
    if (!pendingReview || !studentId || surveyQuality === 0 || surveyPunctual === null || surveyUsedPhone === null) return
    setSurveySubmitting(true)
    try {
      const playerEntry = pendingReview.records.find(e => e.playerId === studentId)
      await addDoc(collection(db, 'classReviews'), {
        groupId: pendingReview.groupId,
        coachId: pendingReview.coachId,
        playerId: studentId,
        playerName: playerEntry?.playerName ?? studentFullName,
        date: pendingReview.dateStr,
        punctual: surveyPunctual,
        usedPhone: surveyUsedPhone,
        quality: surveyQuality,
        comment: surveyComment.trim() || null,
        submittedAt: new Date(),
      })
      setSurveySubmitted(true)
      refetchReviews()
    } finally {
      setSurveySubmitting(false)
    }
  }

  // ── Aviso de asistencia para la próxima clase ─────────────────────────────
  const nextClassDateStr = nextClass ? nextClass.classDate.toISOString().split('T')[0] : ''
  const currentNotice = attendanceNotices.find(
    (n) =>
      n.playerId === studentId &&
      n.groupId === nextClass?.group.id &&
      (ensureDate(n.date).toISOString().split('T')[0]) === nextClassDateStr
  )

  const handleAttendanceNotice = (type: 'present' | 'absent' | 'uncertain') => {
    if (!studentId || !nextClass) return
    if (currentNotice) {
      deleteAttendanceNotice(currentNotice.id)
      if (currentNotice.type === type) return
    }
    const newNotice: Omit<AttendanceNotice, 'id' | 'createdAt'> = {
      playerId: studentId,
      playerName: studentFullName,
      groupId: nextClass.group.id,
      date: new Date(nextClassDateStr),
      type,
    }
    addAttendanceNotice(newNotice)
  }

  // ── Ausencias programadas (mis avisos de ausencia futuros) ───────────────
  const myAbsenceCount = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return attendanceNotices.filter(
      (n) =>
        n.playerId === studentId &&
        n.type === 'absent' &&
        new Date(n.date instanceof Date ? n.date : n.date) >= today,
    ).length
  }, [attendanceNotices, studentId])

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
    {
      label: 'Mis Ausencias',
      icon: BellOff,
      sub: myAbsenceCount > 0 ? `${myAbsenceCount} avisada${myAbsenceCount > 1 ? 's' : ''}` : 'Programar aviso',
      color: myAbsenceCount > 0 ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500',
      onClick: () => setShowAbsences(true),
    },
  ]

  // ── Comprobar si la próxima clase está cancelada ─────────────────────────
  const nextClassCancelled = useMemo(() => {
    if (!nextClass) return false
    const dateStr = nextClass.classDate.toISOString().split('T')[0]
    return cancelledClasses.some(c => c.groupId === nextClass.group.id && c.date === dateStr)
  }, [nextClass, cancelledClasses])

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
              {nextClassCancelled ? (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
                  <XCircle className="h-6 w-6 text-red-500 shrink-0" />
                  <div>
                    <p className="text-sm font-black text-red-700">Clase cancelada</p>
                    <p className="text-xs text-red-500 mt-0.5">Tu entrenador ha cancelado esta clase. Revisa próximas fechas.</p>
                  </div>
                </div>
              ) : nextClass.diffHours <= 48 ? (
                <>
                  <div className="mb-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">¿Asistirás a clase?</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      variant="outline"
                      className={cn(
                        'h-16 rounded-[1.25rem] border-2 font-black transition-all active:scale-95 text-sm flex-col gap-1',
                        currentNotice?.type === 'present'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-lg shadow-emerald-100'
                          : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                      )}
                      onClick={() => handleAttendanceNotice('present')}
                    >
                      <CheckCircle2 className={cn('h-5 w-5', currentNotice?.type === 'present' ? 'text-emerald-500' : 'text-slate-300')} />
                      <span className="text-[11px]">Asisto</span>
                    </Button>
                    <Button
                      variant="outline"
                      className={cn(
                        'h-16 rounded-[1.25rem] border-2 font-black transition-all active:scale-95 text-sm flex-col gap-1',
                        currentNotice?.type === 'uncertain'
                          ? 'bg-amber-50 border-amber-400 text-amber-700 shadow-lg shadow-amber-100'
                          : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                      )}
                      onClick={() => handleAttendanceNotice('uncertain')}
                    >
                      <HelpCircle className={cn('h-5 w-5', currentNotice?.type === 'uncertain' ? 'text-amber-500' : 'text-slate-300')} />
                      <span className="text-[11px]">En duda</span>
                    </Button>
                    <Button
                      variant="outline"
                      className={cn(
                        'h-16 rounded-[1.25rem] border-2 font-black transition-all active:scale-95 text-sm flex-col gap-1',
                        currentNotice?.type === 'absent'
                          ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-lg shadow-rose-100'
                          : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                      )}
                      onClick={() => handleAttendanceNotice('absent')}
                    >
                      <XCircle className={cn('h-5 w-5', currentNotice?.type === 'absent' ? 'text-rose-500' : 'text-slate-300')} />
                      <span className="text-[11px]">No asisto</span>
                    </Button>
                  </div>
                  {currentNotice && (
                    <div className="bg-slate-50 rounded-2xl p-3 flex gap-2 items-center animate-in slide-in-from-top-2 duration-300 mt-2 border border-slate-100">
                      <MessageCircle className="h-4 w-4 text-slate-400 shrink-0" />
                      <p className="text-[11px] text-slate-600 font-medium">
                        Aviso enviado a tu entrenador.
                      </p>
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
            <p className="text-sm font-medium text-slate-400">
              {isTutor ? <>Viendo a <span className="font-bold text-slate-600">{studentFirstName}</span> · {formatDate(now)}</> : formatDate(now)}
            </p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-100/50">
            <Trophy className="h-6 w-6" />
          </div>
        </div>

        {/* Survey post-entrenamiento */}
        {pendingReview && !surveySubmitted && (
          <Card className="border-emerald-100 bg-emerald-50/40">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                  <p className="font-semibold text-sm text-foreground">¿Cómo fue tu clase?</p>
                </div>
                <button
                  className="text-xs text-muted-foreground underline"
                  onClick={() => setSurveySkipped(true)}
                >
                  Saltar
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{pendingReview.groupName} · {pendingReview.dateStr}</p>

              {/* Puntualidad */}
              <div>
                <p className="text-xs font-medium mb-2">¿El coach fue puntual?</p>
                <div className="flex gap-2">
                  <Button
                    size="sm" variant={surveyPunctual === true ? 'default' : 'outline'}
                    className="h-8 text-xs flex-1"
                    onClick={() => setSurveyPunctual(true)}
                  >Sí</Button>
                  <Button
                    size="sm" variant={surveyPunctual === false ? 'destructive' : 'outline'}
                    className="h-8 text-xs flex-1"
                    onClick={() => setSurveyPunctual(false)}
                  >No</Button>
                </div>
              </div>

              {/* Móvil */}
              <div>
                <p className="text-xs font-medium mb-2">¿Usó el móvil en pista?</p>
                <div className="flex gap-2">
                  <Button
                    size="sm" variant={surveyUsedPhone === false ? 'default' : 'outline'}
                    className="h-8 text-xs flex-1"
                    onClick={() => setSurveyUsedPhone(false)}
                  >No</Button>
                  <Button
                    size="sm" variant={surveyUsedPhone === true ? 'destructive' : 'outline'}
                    className="h-8 text-xs flex-1"
                    onClick={() => setSurveyUsedPhone(true)}
                  >Sí</Button>
                </div>
              </div>

              {/* Calidad */}
              <div>
                <p className="text-xs font-medium mb-2">Calidad de la clase</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setSurveyQuality(n)}>
                      <Star className={cn('h-7 w-7', n <= surveyQuality ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200')} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Comentario */}
              <div>
                <p className="text-xs font-medium mb-1">¿Algo a mejorar? <span className="text-muted-foreground">(opcional)</span></p>
                <Textarea
                  rows={2}
                  placeholder="Escribe aquí..."
                  className="text-sm resize-none"
                  value={surveyComment}
                  onChange={e => setSurveyComment(e.target.value)}
                />
              </div>

              <Button
                className="w-full"
                disabled={surveyQuality === 0 || surveyPunctual === null || surveyUsedPhone === null || surveySubmitting}
                onClick={handleSurveySubmit}
              >
                {surveySubmitting ? 'Enviando...' : 'Enviar valoración'}
              </Button>
            </CardContent>
          </Card>
        )}

        {surveySubmitted && (
          <Card className="border-emerald-100 bg-emerald-50/40">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <p className="text-sm font-medium text-emerald-700">¡Gracias por tu valoración!</p>
            </CardContent>
          </Card>
        )}

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

        {/* Stats rápidas */}
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

          <Card className="border-none shadow-lg shadow-slate-200/50 rounded-[2rem] bg-white p-6 border border-slate-50">
            <div className="flex items-center justify-between mb-2">
              <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <span className="text-3xl font-black text-slate-800 tracking-tighter">{attendancePercent}%</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Asistencia</p>
            <p className="text-[9px] font-bold text-slate-300">Este mes</p>
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
            <p className="text-sm font-medium text-slate-400 mt-1">
              {isTutor ? <>Viendo a <span className="font-bold text-slate-600">{studentFirstName}</span> · {formatDate(now)}</> : formatDate(now)}
            </p>
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

            {/* Ausencias programadas (desktop) */}
            <button
              onClick={() => setShowAbsences(true)}
              className={cn(
                'w-full flex items-center gap-3 rounded-2xl p-4 border text-left transition-colors',
                myAbsenceCount > 0
                  ? 'bg-red-50 border-red-100 hover:bg-red-100'
                  : 'bg-white border-slate-100 hover:border-slate-200',
              )}
            >
              <div className={cn(
                'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                myAbsenceCount > 0 ? 'bg-red-100' : 'bg-slate-100',
              )}>
                <BellOff className={cn('h-5 w-5', myAbsenceCount > 0 ? 'text-red-500' : 'text-slate-400')} />
              </div>
              <div>
                <p className={cn('text-sm font-bold', myAbsenceCount > 0 ? 'text-red-700' : 'text-slate-600')}>
                  {myAbsenceCount > 0
                    ? `${myAbsenceCount} ausencia${myAbsenceCount > 1 ? 's' : ''} programada${myAbsenceCount > 1 ? 's' : ''}`
                    : 'Programar ausencia'}
                </p>
                <p className={cn('text-xs mt-0.5', myAbsenceCount > 0 ? 'text-red-400' : 'text-slate-400')}>
                  {myAbsenceCount > 0 ? 'Tu entrenador está informado' : 'Avisa con antelación y gana recuperaciones'}
                </p>
              </div>
            </button>

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

      {/* Ausencias Dialog */}
      {studentId && (
        <ScheduleAbsenceDialog
          open={showAbsences}
          onOpenChange={setShowAbsences}
          myGroups={myGroups}
          existingNotices={attendanceNotices}
          studentId={studentId}
          playerName={studentFullName}
          onAdd={addAttendanceNotice}
          onDelete={deleteAttendanceNotice}
        />
      )}

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
