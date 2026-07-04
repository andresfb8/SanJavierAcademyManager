import { useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { useDataStore } from '@/stores/dataStore'
import type { ClassReview } from '@/types'

interface ReviewsTabProps {
  classReviews: ClassReview[]
}

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < Math.round(value) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`}
        />
      ))}
    </span>
  )
}

export function ReviewsTab({ classReviews }: ReviewsTabProps) {
  const { coaches } = useDataStore()
  const [coachFilter, setCoachFilter] = useState<string>('all')
  const [periodFilter, setPeriodFilter] = useState<string>('month')

  const now = new Date()

  const filteredReviews = useMemo(() => {
    const cutoff = new Date()
    if (periodFilter === 'month') cutoff.setDate(1)
    else if (periodFilter === 'quarter') cutoff.setMonth(now.getMonth() - 3)
    else cutoff.setFullYear(now.getFullYear() - 1)

    return classReviews.filter(r => {
      const d = new Date(r.date)
      const inPeriod = d >= cutoff
      const matchesCoach = coachFilter === 'all' || r.coachId === coachFilter
      return inPeriod && matchesCoach
    })
  }, [classReviews, coachFilter, periodFilter])

  // Summary per coach
  const coachSummaries = useMemo(() => {
    const map: Record<string, { count: number; qualitySum: number; punctualCount: number; phoneCount: number }> = {}
    filteredReviews.forEach(r => {
      if (!map[r.coachId]) map[r.coachId] = { count: 0, qualitySum: 0, punctualCount: 0, phoneCount: 0 }
      map[r.coachId].count++
      map[r.coachId].qualitySum += r.quality
      if (r.punctual) map[r.coachId].punctualCount++
      if (r.usedPhone) map[r.coachId].phoneCount++
    })
    return Object.entries(map)
      .map(([coachId, data]) => {
        const coach = coaches.find(c => c.id === coachId)
        return {
          coachId,
          coachName: coach ? `${coach.firstName} ${coach.lastName}` : 'Coach desconocido',
          count: data.count,
          avgQuality: data.qualitySum / data.count,
          punctualPct: Math.round((data.punctualCount / data.count) * 100),
          phoneFreePct: Math.round(((data.count - data.phoneCount) / data.count) * 100),
        }
      })
      .sort((a, b) => b.avgQuality - a.avgQuality)
  }, [filteredReviews, coaches])

  const recentReviews = useMemo(() =>
    [...filteredReviews].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20),
    [filteredReviews]
  )

  const activeCoaches = useMemo(() =>
    coaches.filter(c => c.isActive && classReviews.some(r => r.coachId === c.id)),
    [coaches, classReviews]
  )

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select
          className="w-40 h-8 text-xs"
          value={periodFilter}
          onChange={e => setPeriodFilter(e.target.value)}
          options={[
            { value: 'month', label: 'Este mes' },
            { value: 'quarter', label: 'Últimos 3 meses' },
            { value: 'year', label: 'Último año' },
          ]}
        />
        <Select
          className="w-44 h-8 text-xs"
          value={coachFilter}
          onChange={e => setCoachFilter(e.target.value)}
          placeholder="Todos los coaches"
          options={[
            { value: 'all', label: 'Todos los coaches' },
            ...activeCoaches.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })),
          ]}
        />
      </div>

      {filteredReviews.length === 0 ? (
        <div className="text-center py-12">
          <Star className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-foreground">Sin cuestionarios aún</p>
          <p className="text-sm text-muted-foreground mt-1">
            Los alumnos podrán valorar sus clases desde su dashboard
          </p>
        </div>
      ) : (
        <>
          {/* Per-coach summary */}
          {coachSummaries.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold">Resumen por coach</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {coachSummaries.map(s => (
                    <div key={s.coachId} className="flex items-center justify-between px-5 py-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground">{s.coachName}</p>
                        <p className="text-xs text-muted-foreground">{s.count} valoración{s.count !== 1 ? 'es' : ''}</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                        <span className="hidden sm:block">Puntual: <strong className="text-foreground">{s.punctualPct}%</strong></span>
                        <span className="hidden sm:block">Sin móvil: <strong className="text-foreground">{s.phoneFreePct}%</strong></span>
                        <div className="flex items-center gap-1">
                          <StarRating value={s.avgQuality} />
                          <strong className="text-foreground">{s.avgQuality.toFixed(1)}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent reviews */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Últimas valoraciones
            </p>
            <div className="space-y-3">
              {recentReviews.map(r => {
                const coach = coaches.find(c => c.id === r.coachId)
                const coachName = coach ? `${coach.firstName} ${coach.lastName}` : 'Coach'
                return (
                  <Card key={r.id} className="border-border/60">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground">{r.playerName}</p>
                            <span className="text-xs text-muted-foreground">→ {coachName}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{r.date}</p>
                          <div className="flex gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                            <span>{r.punctual ? '✓ Puntual' : '✗ No puntual'}</span>
                            <span>{r.usedPhone ? '✗ Usó el móvil' : '✓ Sin móvil'}</span>
                          </div>
                          {r.comment && (
                            <p className="text-xs text-foreground mt-2 italic">"{r.comment}"</p>
                          )}
                        </div>
                        <StarRating value={r.quality} />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
