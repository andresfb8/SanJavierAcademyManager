import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, AlertTriangle, Star, Trophy, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useDataStore } from '@/stores/dataStore'
import { formatCurrency } from '@/lib/utils'
import { computeCourtUtilization, getUnderutilizedSlots } from '@/lib/court-utilization'
import { computeCoachStats } from '@/lib/coach-stats'
import type { ClassReview } from '@/types'

interface IntelligenceCardsProps {
  classReviews: ClassReview[]
}

export function IntelligenceCards({ classReviews }: IntelligenceCardsProps) {
  const navigate = useNavigate()
  const { groups, attendance, payments, coaches, enrollments, courts, privateLessons } = useDataStore()

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  // ── KPIs: Franjas infrautilizadas ────────────────────────────────
  const underutilizedCount = useMemo(() => {
    const utilization = computeCourtUtilization(courts, groups, privateLessons)
    return getUnderutilizedSlots(utilization).length
  }, [courts, groups, privateLessons])

  // ── Riesgo: Alumnos con 3+ faltas este mes ────────────────────────
  const atRiskPlayers = useMemo(() => {
    const absenceCount: Record<string, number> = {}
    attendance.forEach(record => {
      const d = record.date instanceof Date ? record.date : new Date(record.date)
      if (d.getMonth() + 1 !== currentMonth || d.getFullYear() !== currentYear) return
      record.records.forEach(entry => {
        if (entry.status === 'ausente') {
          absenceCount[entry.playerId] = (absenceCount[entry.playerId] ?? 0) + 1
        }
      })
    })
    return Object.values(absenceCount).filter(count => count >= 3).length
  }, [attendance, currentMonth, currentYear])

  // ── Cuestionarios: Media de calidad este mes ──────────────────────
  const reviewsThisMonth = useMemo(() => {
    const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`
    return classReviews.filter(r => r.date.startsWith(monthStr))
  }, [classReviews, currentMonth, currentYear])

  const avgQuality = useMemo(() => {
    if (reviewsThisMonth.length === 0) return null
    const sum = reviewsThisMonth.reduce((acc, r) => acc + r.quality, 0)
    return (sum / reviewsThisMonth.length).toFixed(1)
  }, [reviewsThisMonth])

  // ── Ranking: Coach top por €/h ────────────────────────────────────
  const topCoach = useMemo(() => {
    const monthStart = new Date(currentYear, currentMonth - 1, 1)
    const stats = computeCoachStats(coaches, groups, payments, enrollments, attendance, monthStart, 4)
    if (stats.length === 0) return null
    const best = [...stats].sort((a, b) => b.rph - a.rph)[0]
    if (best.rph === 0) return null
    return { name: best.coachName, rph: best.rph, retentionPct: best.retentionPct }
  }, [coaches, groups, payments, enrollments, attendance, currentMonth, currentYear])

  const cards = [
    {
      tab: 'kpis',
      icon: TrendingUp,
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
      border: 'border-cyan-100',
      title: 'KPIs del Club',
      value: underutilizedCount > 0
        ? `${underutilizedCount} franja${underutilizedCount > 1 ? 's' : ''} infrautilizada${underutilizedCount > 1 ? 's' : ''}`
        : 'Ocupación óptima',
      sub: underutilizedCount > 0 ? 'Revisa el mapa de ocupación de pistas' : 'Todas las franjas bien aprovechadas',
    },
    {
      tab: 'riesgo',
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      title: 'Alumnos en riesgo',
      value: atRiskPlayers > 0 ? `${atRiskPlayers} alumno${atRiskPlayers > 1 ? 's' : ''}` : 'Sin alertas',
      sub: atRiskPlayers > 0 ? '3+ faltas este mes · aviso temprano' : 'Ningún alumno con 3+ faltas',
    },
    {
      tab: 'cuestionarios',
      icon: Star,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-100',
      title: 'Cuestionarios',
      value: avgQuality ? `${avgQuality}/5` : 'Sin datos aún',
      sub: reviewsThisMonth.length > 0
        ? `${reviewsThisMonth.length} valoración${reviewsThisMonth.length > 1 ? 'es' : ''} este mes`
        : 'Los alumnos podrán valorar sus clases',
    },
    {
      tab: 'ranking',
      icon: Trophy,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-100',
      title: 'Ranking coaches',
      value: topCoach ? topCoach.name : 'Sin datos',
      sub: topCoach
        ? `${formatCurrency(topCoach.rph)}/h${topCoach.retentionPct !== null ? ` · ${topCoach.retentionPct}% retención` : ''}`
        : 'Aún sin pagos registrados este mes',
    },
  ]

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground px-0.5">
        Inteligencia del Club
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(card => {
          const Icon = card.icon
          return (
            <Card
              key={card.tab}
              className={`border ${card.border} shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
              onClick={() => navigate(`/analitica?tab=${card.tab}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className={`p-2 rounded-lg ${card.bg} shrink-0`}>
                    <Icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                </div>
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground font-medium">{card.title}</p>
                  <p className="text-lg font-bold text-foreground mt-0.5 leading-tight">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">{card.sub}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`mt-3 h-7 px-2 text-xs ${card.color} hover:${card.bg} w-full justify-between`}
                  onClick={e => { e.stopPropagation(); navigate(`/analitica?tab=${card.tab}`) }}
                >
                  Ver detalles
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
