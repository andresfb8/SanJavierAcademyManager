import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { useDataStore } from '@/stores/dataStore'
import { formatCurrency } from '@/lib/utils'
import { computeCourtUtilization, getUnderutilizedSlots, type CourtSlotStatus } from '@/lib/court-utilization'

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

interface KpiQuestionCard {
  label: string
  answer: string
  detail: string
}

export function KPIsTab() {
  const { groups, enrollments, payments, attendance, courts, privateLessons } = useDataStore()

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)

  // ── Ocupación real de pistas ────────────────────────────────────────
  const utilization = useMemo(
    () => computeCourtUtilization(courts, groups, privateLessons),
    [courts, groups, privateLessons]
  )
  const underutilizedSlots = useMemo(() => getUnderutilizedSlots(utilization), [utilization])
  const activeCourts = useMemo(() => courts.filter(c => c.isActive), [courts])
  const heatmapRows = useMemo(() => {
    const seen = new Map<string, { dayOfWeek: number; startTime: string; endTime: string }>()
    utilization.forEach(s => {
      const key = `${s.dayOfWeek}|${s.startTime}|${s.endTime}`
      if (!seen.has(key)) seen.set(key, { dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })
    })
    return Array.from(seen.values()).sort((a, b) =>
      a.dayOfWeek !== b.dayOfWeek ? a.dayOfWeek - b.dayOfWeek : a.startTime.localeCompare(b.startTime)
    )
  }, [utilization])

  const STATUS_STYLES: Record<CourtSlotStatus['status'], string> = {
    vacio: 'bg-red-500 text-white',
    bajo: 'bg-red-500 text-white',
    ocasional: 'bg-slate-300 text-slate-700',
    medio: 'bg-amber-400 text-slate-900',
    lleno: 'bg-emerald-500 text-white',
  }

  const slotLabel = (slot: CourtSlotStatus): string => {
    if (slot.status === 'vacio') return 'Vacío'
    if (slot.status === 'ocasional') return 'Ocasional'
    return `${slot.occupancyPct}%`
  }

  const slotCell = (courtId: string, row: { dayOfWeek: number; startTime: string; endTime: string }) =>
    utilization.find(
      s => s.courtId === courtId && s.dayOfWeek === row.dayOfWeek && s.startTime === row.startTime && s.endTime === row.endTime
    )

  // ── Grupo más rentable ─────────────────────────────────────────────
  const mostProfitableGroup = useMemo(() => {
    const revenueByGroup: Record<string, number> = {}
    payments
      .filter(p => p.status === 'pagado' && p.billingMonth === currentMonth && p.billingYear === currentYear && p.groupId)
      .forEach(p => {
        revenueByGroup[p.groupId!] = (revenueByGroup[p.groupId!] ?? 0) + p.amount
      })

    const entries = Object.entries(revenueByGroup).sort((a, b) => b[1] - a[1])
    if (entries.length === 0) return { answer: 'Sin datos este mes', detail: 'No hay pagos registrados para grupos este mes' }

    const [groupId, revenue] = entries[0]
    const group = groups.find(g => g.id === groupId)
    return {
      answer: group?.name ?? 'Grupo desconocido',
      detail: `${formatCurrency(revenue)}/mes · ${group?.currentEnrollment ?? 0} alumnos`,
    }
  }, [payments, groups, currentMonth, currentYear])

  // ── Grupo con más abandonos este trimestre ──────────────────────
  const mostChurnGroup = useMemo(() => {
    const churnByGroup: Record<string, number> = {}
    enrollments.forEach(e => {
      if (!e.unenrollmentDate) return
      const d = e.unenrollmentDate instanceof Date ? e.unenrollmentDate : new Date(e.unenrollmentDate)
      if (d >= quarterStart) {
        churnByGroup[e.groupId] = (churnByGroup[e.groupId] ?? 0) + 1
      }
    })

    const entries = Object.entries(churnByGroup).sort((a, b) => b[1] - a[1])
    if (entries.length === 0) return { answer: 'Sin bajas este trimestre', detail: 'Excelente retención en todos los grupos' }

    const [groupId, count] = entries[0]
    const group = groups.find(g => g.id === groupId)
    return {
      answer: group?.name ?? 'Grupo desconocido',
      detail: `${count} baja${count > 1 ? 's' : ''} este trimestre`,
    }
  }, [enrollments, groups, quarterStart])

  // ── Alumnos nuevos este mes ────────────────────────────────────────
  const newPlayers = useMemo(() => {
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1)
    const count = enrollments.filter(e => {
      const d = e.enrollmentDate instanceof Date ? e.enrollmentDate : new Date(e.enrollmentDate)
      return d >= startOfMonth && e.isActive
    }).length
    return count
  }, [enrollments, currentMonth, currentYear])

  // ── Día con más asistencia ─────────────────────────────────────────
  const bestDay = useMemo(() => {
    const countByDay: Record<number, number> = {}
    attendance.forEach(record => {
      const d = record.date instanceof Date ? record.date : new Date(record.date)
      const dow = d.getDay()
      const presents = record.records.filter(e => e.status === 'presente').length
      countByDay[dow] = (countByDay[dow] ?? 0) + presents
    })
    const entries = Object.entries(countByDay).sort((a, b) => b[1] - a[1])
    if (entries.length === 0) return { answer: 'Sin datos', detail: 'No hay registros de asistencia aún' }
    const dow = Number(entries[0][0])
    return {
      answer: DAY_NAMES[dow],
      detail: `${entries[0][1]} asistencias registradas · más popular de la semana`,
    }
  }, [attendance])

  // ── Tasa de cobro ──────────────────────────────────────────────────
  const collectionRate = useMemo(() => {
    const monthPayments = payments.filter(
      p => p.billingMonth === currentMonth && p.billingYear === currentYear
    )
    if (monthPayments.length === 0) return { answer: 'Sin datos', detail: 'No hay pagos generados este mes' }
    const paid = monthPayments.filter(p => p.status === 'pagado').length
    const rate = Math.round((paid / monthPayments.length) * 100)
    return {
      answer: `${rate}%`,
      detail: `${paid} cobrados de ${monthPayments.length} generados este mes`,
    }
  }, [payments, currentMonth, currentYear])

  const cards: KpiQuestionCard[] = [
    {
      label: '¿Cuál es el grupo más rentable?',
      answer: mostProfitableGroup.answer,
      detail: mostProfitableGroup.detail,
    },
    {
      label: '¿Qué grupo tiene más abandonos?',
      answer: mostChurnGroup.answer,
      detail: mostChurnGroup.detail,
    },
    {
      label: '¿Cuántos alumnos nuevos este mes?',
      answer: `${newPlayers} alumno${newPlayers !== 1 ? 's' : ''}`,
      detail: newPlayers > 0 ? 'Nuevas inscripciones activas este mes' : 'Sin nuevas inscripciones este mes',
    },
    {
      label: '¿Qué día tiene más asistencia?',
      answer: bestDay.answer,
      detail: bestDay.detail,
    },
    {
      label: '¿Cuál es la tasa de cobro?',
      answer: collectionRate.answer,
      detail: collectionRate.detail,
    },
  ]

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardContent className="p-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">Ocupación de pistas por franja</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {underutilizedSlots.length > 0
                ? `${underutilizedSlots.length} franja${underutilizedSlots.length > 1 ? 's' : ''} infrautilizada${underutilizedSlots.length > 1 ? 's' : ''}`
                : 'Todas las franjas bien aprovechadas'}
            </p>
          </div>

          {activeCourts.length > 0 && heatmapRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="text-left p-1 text-muted-foreground font-medium">Franja</th>
                    {activeCourts.map(court => (
                      <th key={court.id} className="p-1 text-muted-foreground font-medium">{court.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapRows.map((row, i) => (
                    <tr key={i}>
                      <td className="p-1 text-left whitespace-nowrap">{DAY_NAMES[row.dayOfWeek]} {row.startTime}</td>
                      {activeCourts.map(court => {
                        const slot = slotCell(court.id, row)
                        return (
                          <td key={court.id} className="p-1">
                            {slot && (
                              <div className={`rounded px-1.5 py-1 text-center font-semibold ${STATUS_STYLES[slot.status]}`}>
                                {slotLabel(slot)}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {underutilizedSlots.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Peores franjas</p>
              {underutilizedSlots.slice(0, 10).map((slot, i) => (
                <p key={i} className="text-xs text-foreground">
                  <span className="font-medium">{slot.courtName} · {DAY_NAMES[slot.dayOfWeek]} {slot.startTime}</span>
                  {' — '}
                  {slot.status === 'vacio'
                    ? 'Vacío, sin nada agendado'
                    : `Grupo "${slot.groupName}" al ${slot.occupancyPct}% de aforo`}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Preguntas clave respondidas automáticamente con los datos del club.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <Card key={i} className="border-border/60">
            <CardContent className="p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Q · {String(i + 1).padStart(2, '0')}
              </p>
              <p className="text-sm font-medium text-foreground mb-3 leading-snug">{card.label}</p>
              <p className="text-xl font-bold text-foreground">{card.answer}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
