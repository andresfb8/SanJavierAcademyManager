import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { useDataStore } from '@/stores/dataStore'
import { formatCurrency } from '@/lib/utils'
import { computeCourtUtilization, getUnderutilizedSlots, type CourtSlotStatus } from '@/lib/court-utilization'
import { getPeriodStart, type AnalyticsPeriod } from '@/lib/period'

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  month: 'este mes',
  quarter: 'este trimestre',
  year: 'este año',
}

interface KpiQuestionCard {
  label: string
  answer: string
  detail: string
}

/** Claves 'YYYY-M' de cada mes entre `start` y `end`, ambos incluidos. */
function monthKeysInRange(start: Date, end: Date): Set<string> {
  const keys = new Set<string>()
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const last = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cursor <= last) {
    keys.add(`${cursor.getFullYear()}-${cursor.getMonth() + 1}`)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return keys
}

export function KPIsTab() {
  const { groups, enrollments, payments, attendance, courts, privateLessons } = useDataStore()
  const [period, setPeriod] = useState<AnalyticsPeriod>('month')

  const now = new Date()
  const periodStart = useMemo(() => getPeriodStart(period, now), [period])
  const periodLabel = PERIOD_LABELS[period]

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
      .filter(p => p.status === 'pagado' && p.groupId && new Date(p.paidDate ?? p.dueDate) >= periodStart)
      .forEach(p => {
        revenueByGroup[p.groupId!] = (revenueByGroup[p.groupId!] ?? 0) + p.amount
      })

    const entries = Object.entries(revenueByGroup).sort((a, b) => b[1] - a[1])
    if (entries.length === 0) return { answer: `Sin datos ${periodLabel}`, detail: `No hay pagos registrados para grupos ${periodLabel}` }

    const [groupId, revenue] = entries[0]
    const group = groups.find(g => g.id === groupId)
    return {
      answer: group?.name ?? 'Grupo desconocido',
      detail: `${formatCurrency(revenue)} ${periodLabel} · ${group?.currentEnrollment ?? 0} alumnos`,
    }
  }, [payments, groups, periodStart, periodLabel])

  // ── Grupo con más abandonos en el periodo ──────────────────────
  const mostChurnGroup = useMemo(() => {
    const churnByGroup: Record<string, number> = {}
    enrollments.forEach(e => {
      if (!e.unenrollmentDate) return
      const d = e.unenrollmentDate instanceof Date ? e.unenrollmentDate : new Date(e.unenrollmentDate)
      if (d >= periodStart) {
        churnByGroup[e.groupId] = (churnByGroup[e.groupId] ?? 0) + 1
      }
    })

    const entries = Object.entries(churnByGroup).sort((a, b) => b[1] - a[1])
    if (entries.length === 0) return { answer: `Sin bajas ${periodLabel}`, detail: 'Excelente retención en todos los grupos' }

    const [groupId, count] = entries[0]
    const group = groups.find(g => g.id === groupId)
    return {
      answer: group?.name ?? 'Grupo desconocido',
      detail: `${count} baja${count > 1 ? 's' : ''} ${periodLabel}`,
    }
  }, [enrollments, groups, periodStart, periodLabel])

  // ── Alumnos nuevos en el periodo ────────────────────────────────────
  const newPlayers = useMemo(() => {
    const count = enrollments.filter(e => {
      const d = e.enrollmentDate instanceof Date ? e.enrollmentDate : new Date(e.enrollmentDate)
      return d >= periodStart && e.isActive
    }).length
    return count
  }, [enrollments, periodStart])

  // ── Día con más asistencia en el periodo ────────────────────────────
  const bestDay = useMemo(() => {
    const countByDay: Record<number, number> = {}
    attendance.forEach(record => {
      const d = record.date instanceof Date ? record.date : new Date(record.date)
      if (d < periodStart) return
      const dow = d.getDay()
      const presents = record.records.filter(e => e.status === 'presente').length
      countByDay[dow] = (countByDay[dow] ?? 0) + presents
    })
    const entries = Object.entries(countByDay).sort((a, b) => b[1] - a[1])
    if (entries.length === 0) return { answer: 'Sin datos', detail: `No hay registros de asistencia ${periodLabel}` }
    const dow = Number(entries[0][0])
    return {
      answer: DAY_NAMES[dow],
      detail: `${entries[0][1]} asistencias registradas ${periodLabel} · más popular de la semana`,
    }
  }, [attendance, periodStart, periodLabel])

  // ── Tasa de cobro en el periodo ──────────────────────────────────────
  const collectionRate = useMemo(() => {
    const validMonths = monthKeysInRange(periodStart, now)
    const periodPayments = payments.filter(p => validMonths.has(`${p.billingYear}-${p.billingMonth}`))
    if (periodPayments.length === 0) return { answer: 'Sin datos', detail: `No hay pagos generados ${periodLabel}` }
    const paid = periodPayments.filter(p => p.status === 'pagado').length
    const rate = Math.round((paid / periodPayments.length) * 100)
    return {
      answer: `${rate}%`,
      detail: `${paid} cobrados de ${periodPayments.length} generados ${periodLabel}`,
    }
  }, [payments, periodStart, periodLabel])

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
      label: '¿Cuántos alumnos nuevos en el periodo?',
      answer: `${newPlayers} alumno${newPlayers !== 1 ? 's' : ''}`,
      detail: newPlayers > 0 ? `Nuevas inscripciones activas ${periodLabel}` : `Sin nuevas inscripciones ${periodLabel}`,
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

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          Preguntas clave respondidas automáticamente con los datos del club.
        </p>
        <Select
          className="w-36 h-8 text-xs"
          value={period}
          onChange={e => setPeriod(e.target.value as AnalyticsPeriod)}
          options={[
            { value: 'month', label: 'Este mes' },
            { value: 'quarter', label: 'Trimestre' },
            { value: 'year', label: 'Este año' },
          ]}
        />
      </div>
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
