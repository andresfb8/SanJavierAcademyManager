import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/shared/StatCard'
import { ActivityFeed } from '@/components/shared/ActivityFeed'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import {
  Users,
  Clock,
  CalendarDays,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Bell,
  Trophy,
  GraduationCap,
  Plus,
  Euro,
  ClipboardList,
} from 'lucide-react'
import { calculateEventSalary } from '@/lib/salary-utils'
import { formatCurrency } from '@/lib/utils'
import { isGroupCurrentlyActive } from '@/lib/group-utils'

export default function CoachDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const {
    players,
    groups,
    enrollments,
    coaches,
    privateLessons,
    attendanceNotices,
    activities,
    attendance,
    coachSalaryConfigs,
    events,
    eventPayments,
    cancelledClasses,
    addCancelledClass,
    deleteCancelledClass,
  } = useDataStore()
  const [cancelDialog, setCancelDialog] = useState<{ groupId: string; groupName: string; dateStr: string } | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const now = new Date()
  const [activityCollapsed, setActivityCollapsed] = useState(false)

  // -- Coach identification --
  const currentCoachId = useMemo(() => {
    if (!user) return null
    let coach = coaches.find(c => c.userId === user.id)
    if (!coach && user.email) {
      coach = coaches.find(c => c.email?.toLowerCase() === user.email?.toLowerCase())
    }
    return coach?.id ?? null
  }, [user?.id, user?.email, coaches])

  // -- Coach-specific KPIs --
  const coachHoursThisMonth = useMemo(() => {
    if (!currentCoachId) return 0
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    let totalMinutes = 0

    const coachGroups = groups.filter(g => g.coachId === currentCoachId)
    coachGroups.forEach(group => {
      group.schedule.forEach(slot => {
        const [startH, startM] = slot.startTime.split(':').map(Number)
        const [endH, endM] = slot.endTime.split(':').map(Number)
        totalMinutes += ((endH * 60 + endM) - (startH * 60 + startM)) * 4 // Approx 4 weeks
      })
    })

    const coachLessons = privateLessons.filter(pl => {
      const lessonDate = pl.date instanceof Date ? pl.date : new Date(pl.date)
      return pl.coachId === currentCoachId && lessonDate >= startOfMonth && lessonDate <= endOfMonth
    })
    coachLessons.forEach(lesson => {
      const [startH, startM] = lesson.startTime.split(':').map(Number)
      const [endH, endM] = lesson.endTime.split(':').map(Number)
      totalMinutes += (endH * 60 + endM) - (startH * 60 + startM)
    })

    return Math.round(totalMinutes / 60 * 10) / 10
  }, [currentCoachId, groups, privateLessons])

  const coachAssignedPlayers = useMemo(() => {
    if (!currentCoachId) return 0
    const coachGroupIds = groups.filter(g => g.coachId === currentCoachId).map(g => g.id)
    const playerIds = new Set(enrollments.filter(e => coachGroupIds.includes(e.groupId)).map(e => e.playerId))
    return playerIds.size
  }, [currentCoachId, groups, enrollments])

  const coachClassesToday = useMemo(() => {
    if (!currentCoachId) return 0
    const today = now.getDay()
    return groups.filter(g => isGroupCurrentlyActive(g, now) && g.coachId === currentCoachId && g.schedule.some(s => s.dayOfWeek === today)).length
  }, [currentCoachId, groups, now])

  // -- Active/Next Class Logic --
  const activeClass = useMemo(() => {
    if (!currentCoachId) return null
    const dayOfWeek = now.getDay()
    const currentCoachGroups = groups.filter(g => g.coachId === currentCoachId && isGroupCurrentlyActive(g, now))

    for (const group of currentCoachGroups) {
      for (const slot of group.schedule) {
        if (slot.dayOfWeek === dayOfWeek) {
          const [startH, startM] = slot.startTime.split(':').map(Number)
          const [endH, endM] = slot.endTime.split(':').map(Number)
          const startTime = new Date(now)
          startTime.setHours(startH, startM, 0)
          const endTime = new Date(now)
          endTime.setHours(endH, endM, 0)
          const diffMinutes = (startTime.getTime() - now.getTime()) / (1000 * 60)
          
          if ((diffMinutes >= -15 && diffMinutes <= 60) || (now >= startTime && now <= endTime)) {
            return {
              id: group.id,
              name: group.name,
              startTime: slot.startTime,
              endTime: slot.endTime,
              isOngoing: now >= startTime && now <= endTime,
              courtName: group.courtName
            }
          }
        }
      }
    }
    return null
  }, [currentCoachId, groups])

  const visibleActivities = useMemo(() => {
    return activities.filter(a => a.userId === user?.id && a.type !== 'payment_received')
  }, [activities, user?.id])

  // -- Salario estimado del mes --
  const estimatedSalary = useMemo(() => {
    if (!currentCoachId) return null
    const salaryConfig = coachSalaryConfigs.find(c => c.coachId === currentCoachId)
    if (!salaryConfig) return null
    // Grupo con clase en ALGUN momento de este mes (no solo hoy), para no
    // dejar de pagar un grupo que dio clase parte del mes antes de finalizar
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const coachGroups = groups.filter(g => {
      if (g.coachId !== currentCoachId || !g.isActive) return false
      const gStart = g.startDate instanceof Date ? g.startDate : new Date(g.startDate)
      const gEnd = g.endDate instanceof Date ? g.endDate : new Date(g.endDate)
      return gStart <= monthEnd && gEnd >= monthStart
    })
    const adultGroups = coachGroups.filter(g => g.level !== 'menores').length
    const minorGroups = coachGroups.filter(g => g.level === 'menores').length
    const groupsSalary = adultGroups * (salaryConfig.ratePerGroupAdults || 0) + minorGroups * (salaryConfig.ratePerGroupMinors || 0)
    const monthlyLessons = privateLessons.filter(
      pl => pl.coachId === currentCoachId &&
        new Date(pl.date).getMonth() === now.getMonth() &&
        new Date(pl.date).getFullYear() === now.getFullYear()
    )
    const lessonsSalary = monthlyLessons.reduce((acc, lesson) =>
      salaryConfig.privateLessonPaymentType === 'fixed'
        ? acc + (salaryConfig.privateLessonRate || 0)
        : acc + (lesson.price * ((salaryConfig.privateLessonRate || 0) / 100))
    , 0)
    const monthlyEvents = events.filter(
      ev => ev.coachIds.includes(currentCoachId) &&
        new Date(ev.date).getMonth() === now.getMonth() &&
        new Date(ev.date).getFullYear() === now.getFullYear()
    )
    const eventsSalary = monthlyEvents.reduce((acc, ev) => acc + calculateEventSalary(ev, eventPayments, salaryConfig), 0)
    return groupsSalary + lessonsSalary + eventsSalary + (salaryConfig.bonuses || 0)
  }, [currentCoachId, coachSalaryConfigs, groups, privateLessons, events, eventPayments])

  // -- Todas las clases de hoy --
  const todayDateStr = now.toISOString().split('T')[0]
  const todayClasses = useMemo(() => {
    if (!currentCoachId) return []
    const dayOfWeek = now.getDay()
    const todayStr = now.toDateString()
    return groups
      .filter(g => isGroupCurrentlyActive(g, now) && g.coachId === currentCoachId)
      .flatMap(group =>
        group.schedule
          .filter(s => s.dayOfWeek === dayOfWeek)
          .map(slot => {
            const [h, m] = slot.startTime.split(':').map(Number)
            const classStart = new Date(now)
            classStart.setHours(h, m, 0, 0)
            const attRecord = attendance.find(a =>
              a.groupId === group.id && new Date(a.date).toDateString() === todayStr
            )
            const enrolledCount = enrollments.filter(e => e.groupId === group.id && e.isActive).length
            const cancelledDoc = cancelledClasses.find(c => c.groupId === group.id && c.date === todayDateStr)
            return {
              group, slot, classStart, attRecord, enrolledCount,
              isMarked: !!attRecord && attRecord.records.length > 0,
              isCancelled: !!cancelledDoc,
              cancelledId: cancelledDoc?.id,
            }
          })
      )
      .sort((a, b) => a.classStart.getTime() - b.classStart.getTime())
  }, [currentCoachId, groups, attendance, enrollments, cancelledClasses, todayDateStr])

  // -- Avisos de hoy agrupados por grupo (para el héroe y los badges de la lista) --
  const todayNoticesForCoach = useMemo(() => {
    return attendanceNotices.filter(notice => {
      const noticeDate = notice.date instanceof Date ? notice.date : new Date(notice.date as unknown as string)
      const noticeLocal = new Date(noticeDate.getTime() - noticeDate.getTimezoneOffset() * 60000).toISOString().split('T')[0]
      const nowLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0]
      const coachGroupIds = groups.filter(g => g.coachId === currentCoachId).map(g => g.id)
      return noticeLocal === nowLocal && coachGroupIds.includes(notice.groupId)
    })
  }, [attendanceNotices, groups, currentCoachId, now])

  const noticesByGroupId = useMemo(() => {
    const map = new Map<string, typeof todayNoticesForCoach>()
    for (const notice of todayNoticesForCoach) {
      const list = map.get(notice.groupId) ?? []
      list.push(notice)
      map.set(notice.groupId, list)
    }
    return map
  }, [todayNoticesForCoach])

  // -- Clase destacada del héroe: la activa si existe, si no la próxima sin empezar/cancelar --
  const nextUpcomingClass = useMemo(() => {
    if (activeClass) return null
    return todayClasses.find(tc => !tc.isCancelled && tc.classStart > now) ?? null
  }, [activeClass, todayClasses, now])

  const featuredClassKey = activeClass
    ? `${activeClass.id}-${activeClass.startTime}`
    : nextUpcomingClass
      ? `${nextUpcomingClass.group.id}-${nextUpcomingClass.slot.startTime}`
      : null

  // -- Resto de clases de hoy, excluyendo la destacada del héroe --
  const remainingClasses = useMemo(
    () => todayClasses.filter(tc => `${tc.group.id}-${tc.slot.startTime}` !== featuredClassKey),
    [todayClasses, featuredClassKey]
  )

  // -- Avisos "huérfanos": grupos sin clase en todayClasses hoy (p.ej. fuera de temporada) --
  const orphanNotices = useMemo(() => {
    const knownGroupIds = new Set(todayClasses.map(tc => tc.group.id))
    return todayNoticesForCoach.filter(notice => !knownGroupIds.has(notice.groupId))
  }, [todayNoticesForCoach, todayClasses])

  // -- Lista compacta de avisos para el héroe (máx. 3 + "+N más") --
  const renderNoticesList = (notices: typeof todayNoticesForCoach) => {
    if (notices.length === 0) return null
    const visible = notices.slice(0, 3)
    const extra = notices.length - visible.length
    return (
      <div className="space-y-2">
        {visible.map(notice => (
          <div key={notice.id} className={cn(
            "flex items-center gap-3 rounded-2xl border p-3",
            notice.type === 'absent' ? "border-amber-100 bg-amber-50/40"
            : notice.type === 'uncertain' ? "border-violet-100 bg-violet-50/40"
            : "border-blue-100 bg-blue-50/40"
          )}>
            <div className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
              notice.type === 'absent' ? "bg-amber-100 text-amber-600"
              : notice.type === 'uncertain' ? "bg-violet-100 text-violet-600"
              : "bg-blue-100 text-blue-600"
            )}>
              <Bell className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black truncate text-slate-800">{notice.playerName}</p>
              <p className="text-[11px] font-medium text-slate-500 truncate">
                {notice.type === 'absent' ? 'No asistirá a clase hoy'
                : notice.type === 'uncertain' ? 'Está en duda para clase hoy'
                : 'Ha confirmado su asistencia'}
              </p>
            </div>
          </div>
        ))}
        {extra > 0 && (
          <p className="text-[11px] font-bold text-slate-400 text-center">+{extra} más</p>
        )}
      </div>
    )
  }

  if (!currentCoachId) {
    return (
      <div className="p-6">
        <Header title={`Hola, ${user?.displayName?.split(' ')[0] || 'Entrenador'} 👋`} />
        <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col items-center text-center">
          <Bell className="h-10 w-10 text-amber-500 mb-3" />
          <h3 className="text-lg font-bold text-amber-900">Perfil no vinculado</h3>
          <p className="text-sm text-amber-700 max-w-md mt-1">
            Tu cuenta de usuario no está vinculada a un perfil de entrenador en el sistema. 
            Contacta con el administrador para vincular tu email o ID.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-20 lg:pb-8">
      <Header
        title={`Hola, ${user?.displayName?.split(' ')[0] || 'Entrenador'} 👋`}
        subtitle={`Panel de Control · ${now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`}
      />

      <div className="px-5 lg:px-8 space-y-8 mt-6">

        {/* -- Héroe: clase destacada + sus avisos -- */}
        {activeClass ? (
          <Card className="border-none shadow-xl shadow-primary/5 rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-slate-100">
            <CardHeader className="pb-4 px-8 pt-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">{activeClass.name}</h3>
                  <p className="text-sm font-bold text-primary flex items-center gap-1.5 mt-0.5">
                    <Clock className="h-4 w-4" />
                    {activeClass.startTime} - {activeClass.endTime} · Pista {activeClass.courtName}
                  </p>
                </div>
                <Badge className="bg-emerald-500 text-white border-none px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse shadow-lg shadow-emerald-200">
                  En curso
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-8 pb-8 space-y-6">
              {/* Contador presentes/pendientes */}
              {(() => {
                const enrolled = enrollments.filter(e => e.groupId === activeClass.id && e.isActive);
                const record = attendance.find(a => a.groupId === activeClass.id && new Date(a.date).toDateString() === now.toDateString());
                const present = record ? record.records.filter(r => r.status === 'presente').length : 0;
                const pending = enrolled.length - (record?.records.length || 0);

                return (
                  <div className="flex gap-3">
                    <div className="flex-1 rounded-2xl bg-emerald-50 p-4 border border-emerald-100/50">
                      <div className="text-2xl font-black text-emerald-600">{present}</div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600/60">Presentes</div>
                    </div>
                    <div className="flex-1 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                      <div className="text-2xl font-black text-slate-600">{pending}</div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500/60">Pendientes</div>
                    </div>
                  </div>
                );
              })()}

              {renderNoticesList(noticesByGroupId.get(activeClass.id) ?? [])}

              <div className="space-y-4">
                {enrollments.filter(e => e.groupId === activeClass.id && e.isActive).slice(0, 5).map((enrollment) => {
                  const student = players.find(p => p.id === enrollment.playerId);
                  if (!student) return null;
                  const record = attendance.find(a => a.groupId === activeClass.id && new Date(a.date).toDateString() === now.toDateString());
                  const studentStatus = record?.records.find(r => r.playerId === student.id)?.status;

                  return (
                    <div key={student.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 font-black text-sm">
                          {student.firstName[0]}
                        </div>
                        <div>
                          <span className="text-sm font-black text-slate-800">{student.firstName} {student.lastName}</span>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{student.level}</p>
                        </div>
                      </div>
                      <div className={cn(
                        "h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all",
                        studentStatus === 'presente' ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200 text-slate-200"
                      )}>
                        <CheckCircle2 className="h-4.5 w-4.5" />
                      </div>
                    </div>
                  )
                })}
              </div>

              <Button
                className="w-full bg-slate-900 hover:bg-black text-white h-14 rounded-[1.5rem] font-black text-sm shadow-xl shadow-slate-200 transition-all active:scale-[0.98] mt-4"
                onClick={() => navigate(`/asistencia?groupId=${activeClass.id}`)}
              >
                Abrir Gestión de Lista
                <ChevronRight className="h-5 w-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        ) : nextUpcomingClass ? (
          <Card className="border-none shadow-sm rounded-[2.5rem] bg-white ring-1 ring-slate-100">
            <CardContent className="p-8 space-y-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tu próxima clase</p>
                <h3 className="text-lg font-black text-slate-900 mt-1">{nextUpcomingClass.group.name}</h3>
                <p className="text-sm font-bold text-primary flex items-center gap-1.5 mt-0.5">
                  <Clock className="h-4 w-4" />
                  {nextUpcomingClass.slot.startTime}–{nextUpcomingClass.slot.endTime} · {nextUpcomingClass.group.courtName} · {nextUpcomingClass.enrolledCount} alumnos
                </p>
              </div>

              {renderNoticesList(noticesByGroupId.get(nextUpcomingClass.group.id) ?? [])}

              <Button
                className="w-full bg-slate-900 hover:bg-black text-white h-14 rounded-[1.5rem] font-black text-sm shadow-xl shadow-slate-200 transition-all active:scale-[0.98]"
                onClick={() => navigate(`/asistencia?groupId=${nextUpcomingClass.group.id}`)}
              >
                Pasar lista
                <ChevronRight className="h-5 w-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 rounded-[2.5rem] border-2 border-dashed border-slate-100 bg-slate-50/50">
            <div className="h-16 w-16 rounded-3xl bg-white shadow-sm flex items-center justify-center mb-4">
              <CalendarCheck className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-400">Sin clases programadas hoy</p>
            <Button variant="link" onClick={() => navigate('/agenda')} className="text-xs text-primary font-black uppercase tracking-widest mt-2">Ver mi agenda</Button>
          </div>
        )}

        {/* -- Widget Pasar Lista Rápido -- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                Resto de Clases de Hoy
                {remainingClasses.length > 0 && (
                  <span className="ml-2 normal-case font-bold text-slate-300">({remainingClasses.length})</span>
                )}
              </h3>
              {remainingClasses.length > 0 && (
                <button
                  onClick={() => navigate('/asistencia')}
                  className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                >
                  Ver todas
                </button>
              )}
            </div>

            {/* Lista del resto de clases de hoy (sin la destacada del héroe) */}
            {remainingClasses.length > 0 && (
              <div className="space-y-3">
                {remainingClasses.map(({ group, slot, isMarked, enrolledCount, isCancelled, cancelledId }) => {
                  const noticeCount = noticesByGroupId.get(group.id)?.length ?? 0
                  return (
                    <div
                      key={`${group.id}-${slot.startTime}`}
                      className={cn(
                        'flex items-center gap-4 rounded-2xl border p-4 transition-all',
                        isCancelled ? 'bg-red-50 border-red-200 opacity-75'
                        : 'bg-white border-slate-100',
                      )}
                    >
                      <div className={cn(
                        'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-black',
                        isCancelled ? 'bg-red-100 text-red-400 line-through'
                        : 'bg-slate-100 text-slate-500',
                      )}>
                        {slot.startTime.slice(0, 5)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-bold truncate', isCancelled ? 'text-red-600 line-through' : 'text-slate-800')}>
                          {group.name}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {slot.startTime}–{slot.endTime} · {group.courtName} · {enrolledCount} alumnos
                        </p>
                      </div>
                      {noticeCount > 0 && (
                        <Badge className="bg-amber-50 text-amber-700 border-amber-100 text-[10px] font-bold shrink-0">
                          {noticeCount} {noticeCount === 1 ? 'aviso' : 'avisos'}
                        </Badge>
                      )}
                      {isCancelled ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-black text-red-500 uppercase tracking-wide">Cancelada</span>
                          <button
                            onClick={() => cancelledId && deleteCancelledClass(cancelledId)}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                          >
                            Reabrir
                          </button>
                        </div>
                      ) : isMarked ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                            <CheckCircle2 className="h-4 w-4" />
                            Lista
                          </div>
                          <button
                            onClick={() => setCancelDialog({ groupId: group.id, groupName: group.name, dateStr: todayDateStr })}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold text-red-400 hover:bg-red-50 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => navigate(`/asistencia?groupId=${group.id}`)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-black hover:bg-black transition-colors"
                          >
                            Pasar lista
                          </button>
                          <button
                            onClick={() => setCancelDialog({ groupId: group.id, groupName: group.name, dateStr: todayDateStr })}
                            className="px-2 py-1.5 rounded-xl text-xs font-bold text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {orphanNotices.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Otros avisos</h4>
                {renderNoticesList(orphanNotices)}
              </div>
            )}

          </div>

          <div className="lg:col-span-5 space-y-8">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Mi Rendimiento</h3>

            {/* Salario estimado */}
            {estimatedSalary !== null && (
              <div
                className="flex items-center gap-4 rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-slate-100 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/entrenadores/${currentCoachId}`)}
              >
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <Euro className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-2xl font-black text-slate-900 leading-none">{formatCurrency(estimatedSalary)}</p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">Estimación mensual · Ver detalle</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <StatCard
                title="Horas Trabajadas"
                value={`${coachHoursThisMonth}h`}
                icon={Clock}
                iconClassName="bg-blue-50 text-blue-600"
                accentColor="#3b82f6"
                className="rounded-[1.5rem] shadow-sm border-none"
              />
              <StatCard
                title="Alumnos"
                value={coachAssignedPlayers}
                icon={Users}
                iconClassName="bg-emerald-50 text-emerald-600"
                accentColor="#10b981"
                className="rounded-[1.5rem] shadow-sm border-none"
              />
              <StatCard
                title="Grupos"
                value={groups.filter(g => g.coachId === currentCoachId && isGroupCurrentlyActive(g, now)).length}
                icon={GraduationCap}
                iconClassName="bg-indigo-50 text-indigo-600"
                accentColor="#6366f1"
                className="rounded-[1.5rem] shadow-sm border-none"
              />
              <StatCard
                title="Hoy"
                value={coachClassesToday}
                icon={CalendarDays}
                iconClassName="bg-rose-50 text-rose-600"
                accentColor="#f43f5e"
                className="rounded-[1.5rem] shadow-sm border-none"
              />
            </div>

          </div>
        </div>

        {/* -- Acciones Rápidas -- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            variant="outline"
            className="h-16 rounded-2xl border-slate-100 bg-white text-slate-700 font-bold justify-between px-6 hover:bg-slate-50"
            onClick={() => navigate('/informes')}
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Plus className="h-5 w-5" />
              </div>
              Nueva Evaluación
            </div>
            <ChevronRight className="h-4 w-4 opacity-30" />
          </Button>
          <Button
            variant="outline"
            className="h-16 rounded-2xl border-slate-100 bg-white text-slate-700 font-bold justify-between px-6 hover:bg-slate-50"
            onClick={() => navigate(`/entrenadores/${currentCoachId}`)}
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Trophy className="h-5 w-5" />
              </div>
              Ver mi Perfil y Salario
            </div>
            <ChevronRight className="h-4 w-4 opacity-30" />
          </Button>
        </div>

        {/* -- Actividad Reciente (colapsable, siempre al final) -- */}
        <div className="pb-8">
          <button
            onClick={() => setActivityCollapsed((v) => !v)}
            className="flex items-center justify-between w-full mb-4 group"
          >
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Actividad Reciente</h3>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-slate-400 transition-transform duration-200',
                activityCollapsed ? '-rotate-90' : 'rotate-0'
              )}
            />
          </button>
          {!activityCollapsed && (
            <Card className="border-none shadow-sm rounded-[1.5rem] overflow-hidden bg-white">
              <ActivityFeed activities={visibleActivities} limit={5} />
            </Card>
          )}
        </div>
      </div>

      {/* Diálogo cancelar clase */}
      {cancelDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={() => { setCancelDialog(null); setCancelReason('') }}>
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-base font-black text-slate-800">Cancelar clase</h3>
              <p className="text-sm text-slate-500 mt-0.5">{cancelDialog.groupName} · hoy</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Motivo (opcional)</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
              >
                <option value="">Sin especificar</option>
                <option value="Lluvia">Lluvia</option>
                <option value="Festivo">Festivo</option>
                <option value="Pista no disponible">Pista no disponible</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                onClick={() => { setCancelDialog(null); setCancelReason('') }}
              >
                Cancelar
              </button>
              <button
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-black hover:bg-red-600 transition-colors"
                onClick={() => {
                  if (!user?.id) return
                  addCancelledClass({
                    clubId: user.clubId ?? '',
                    groupId: cancelDialog.groupId,
                    groupName: cancelDialog.groupName,
                    date: cancelDialog.dateStr,
                    reason: cancelReason || undefined,
                    cancelledBy: user.id,
                  })
                  setCancelDialog(null)
                  setCancelReason('')
                }}
              >
                Confirmar cancelación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
