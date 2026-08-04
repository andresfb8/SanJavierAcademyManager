import { useMemo, useState } from 'react'
import { Phone, Mail, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { useDataStore } from '@/stores/dataStore'
import { getPeriodStart } from '@/lib/period'

interface AtRiskPlayer {
  playerId: string
  playerName: string
  groupId: string
  groupName: string
  coachName: string
  absences: number
  daysSinceLastAttendance: number | null
  paymentStatus: 'al_dia' | 'pendiente'
  phone?: string
  email?: string
}

export function RiskTab() {
  const { attendance, players, groups, coaches, payments } = useDataStore()
  const [periodFilter, setPeriodFilter] = useState<'month' | 'quarter'>('month')

  const now = new Date()
  const currentYear = now.getFullYear()

  const periodStart = useMemo(() => getPeriodStart(periodFilter, now), [periodFilter])

  const [groupFilter, setGroupFilter] = useState<string>('all')

  const activeGroups = useMemo(() => groups.filter(g => g.isActive), [groups])

  const atRiskPlayers = useMemo((): AtRiskPlayer[] => {
    const absenceCount: Record<string, { count: number; groupId: string; groupName: string; coachId: string; lastPresent: Date | null }> = {}

    attendance.forEach(record => {
      const d = record.date instanceof Date ? record.date : new Date(record.date)
      if (d < periodStart) return
      if (groupFilter !== 'all' && record.groupId !== groupFilter) return

      record.records.forEach(entry => {
        if (!absenceCount[entry.playerId]) {
          absenceCount[entry.playerId] = { count: 0, groupId: record.groupId, groupName: record.groupName, coachId: record.coachId, lastPresent: null }
        }
        if (entry.status === 'ausente') {
          absenceCount[entry.playerId].count++
        }
        if (entry.status === 'presente') {
          const prev = absenceCount[entry.playerId].lastPresent
          if (!prev || d > prev) absenceCount[entry.playerId].lastPresent = d
        }
      })
    })

    return Object.entries(absenceCount)
      .filter(([, data]) => data.count >= 3)
      .map(([playerId, data]) => {
        const player = players.find(p => p.id === playerId)
        const coach = coaches.find(c => c.id === data.coachId)
        const daysSince = data.lastPresent
          ? Math.floor((now.getTime() - data.lastPresent.getTime()) / (1000 * 60 * 60 * 24))
          : null

        const hasPending = payments.some(
          p => p.playerId === playerId && p.status === 'pendiente' && p.billingYear === currentYear
        )

        return {
          playerId,
          playerName: player?.firstName ? `${player.firstName} ${player.lastName}` : playerId,
          groupId: data.groupId,
          groupName: data.groupName,
          coachName: coach ? `${coach.firstName} ${coach.lastName}` : 'Sin coach',
          absences: data.count,
          daysSinceLastAttendance: daysSince,
          paymentStatus: hasPending ? 'pendiente' : 'al_dia',
          phone: player?.phone,
          email: player?.email,
        } as AtRiskPlayer
      })
      .sort((a, b) => b.absences - a.absences)
  }, [attendance, players, coaches, payments, periodStart, groupFilter, currentYear])

  if (atRiskPlayers.length === 0) {
    return (
      <div className="space-y-4">
        <RiskFilters
          periodFilter={periodFilter}
          setPeriodFilter={setPeriodFilter}
          groupFilter={groupFilter}
          setGroupFilter={setGroupFilter}
          groups={activeGroups}
        />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 bg-green-50 rounded-full mb-4">
            <AlertTriangle className="h-8 w-8 text-green-400" />
          </div>
          <p className="font-semibold text-foreground">Sin alumnos en riesgo</p>
          <p className="text-sm text-muted-foreground mt-1">
            Ningún alumno tiene 3 o más faltas en el período seleccionado
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <RiskFilters
        periodFilter={periodFilter}
        setPeriodFilter={setPeriodFilter}
        groupFilter={groupFilter}
        setGroupFilter={setGroupFilter}
        groups={activeGroups}
      />

      <p className="text-sm text-muted-foreground">
        {atRiskPlayers.length} alumno{atRiskPlayers.length > 1 ? 's' : ''} con 3 o más faltas · aviso temprano antes de que cancelen.
      </p>

      <div className="space-y-3">
        {atRiskPlayers.map(player => (
          <Card key={player.playerId} className="border-amber-100">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">{player.playerName}</p>
                    <Badge variant="destructive" className="text-xs">
                      {player.absences} faltas
                    </Badge>
                    {player.paymentStatus === 'pendiente' && (
                      <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                        Pago pendiente
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {player.groupName} · {player.coachName}
                  </p>
                  {player.daysSinceLastAttendance !== null && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Última asistencia hace {player.daysSinceLastAttendance} día{player.daysSinceLastAttendance !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {player.phone && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => window.open(`tel:${player.phone}`)}
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {player.email && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => window.open(`mailto:${player.email}`)}
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function RiskFilters({
  periodFilter,
  setPeriodFilter,
  groupFilter,
  setGroupFilter,
  groups,
}: {
  periodFilter: 'month' | 'quarter'
  setPeriodFilter: (v: 'month' | 'quarter') => void
  groupFilter: string
  setGroupFilter: (v: string) => void
  groups: { id: string; name: string }[]
}) {
  return (
    <div className="flex gap-3 flex-wrap">
      <Select
        className="w-40 h-8 text-xs"
        value={periodFilter}
        onChange={e => setPeriodFilter(e.target.value as 'month' | 'quarter')}
        options={[
          { value: 'month', label: 'Este mes' },
          { value: 'quarter', label: 'Este trimestre' },
        ]}
      />
      <Select
        className="w-44 h-8 text-xs"
        value={groupFilter}
        onChange={e => setGroupFilter(e.target.value)}
        placeholder="Todos los grupos"
        options={[
          { value: 'all', label: 'Todos los grupos' },
          ...groups.map(g => ({ value: g.id, label: g.name })),
        ]}
      />
    </div>
  )
}
