import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { useDataStore } from '@/stores/dataStore'
import { formatCurrency } from '@/lib/utils'

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

interface KpiQuestionCard {
  label: string
  answer: string
  detail: string
}

export function KPIsTab() {
  const { groups, enrollments, payments, attendance } = useDataStore()

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)

  // ── Franjas infrautilizadas ────────────────────────────────────────
  const underutilized = useMemo(() => {
    return groups
      .filter(g => g.isActive && g.maxCapacity > 0 && g.currentEnrollment / g.maxCapacity < 0.6)
      .sort((a, b) => (a.currentEnrollment / a.maxCapacity) - (b.currentEnrollment / b.maxCapacity))
  }, [groups])

  const underutilizedAnswer = useMemo(() => {
    if (underutilized.length === 0) return 'Todos los grupos bien ocupados'
    const g = underutilized[0]
    const slot = g.schedule[0]
    if (!slot) return `${g.name}`
    return `${DAY_NAMES[slot.dayOfWeek]} ${slot.startTime}`
  }, [underutilized])

  const underutilizedDetail = useMemo(() => {
    if (underutilized.length === 0) return 'No hay franjas con menos del 60% de ocupación'
    const g = underutilized[0]
    const pct = Math.round((g.currentEnrollment / g.maxCapacity) * 100)
    return `${pct}% ocupación · ${g.currentEnrollment}/${g.maxCapacity} plazas · ${underutilized.length} grupo${underutilized.length > 1 ? 's' : ''} total`
  }, [underutilized])

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
      label: '¿Qué franja está infrautilizada?',
      answer: underutilizedAnswer,
      detail: underutilizedDetail,
    },
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
    <div className="space-y-4">
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
