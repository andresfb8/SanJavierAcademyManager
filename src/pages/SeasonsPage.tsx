import { useEffect, useMemo, useRef, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useDataStore } from '@/stores/dataStore'
import { NewSeasonDialog } from '@/components/shared/NewSeasonDialog'
import { RenewGroupsDialog } from '@/components/shared/RenewGroupsDialog'
import type { Group } from '@/types'

const NO_SEASON = '__none__'

export default function SeasonsPage() {
  const { seasons, groups, enrollments, club } = useDataStore()

  const [originSeasonId, setOriginSeasonId] = useState<string>(club?.activeSeasonId ?? NO_SEASON)
  const hasAutoSelectedOrigin = useRef(!!club?.activeSeasonId)

  useEffect(() => {
    if (!hasAutoSelectedOrigin.current && club?.activeSeasonId) {
      setOriginSeasonId(club.activeSeasonId)
      hasAutoSelectedOrigin.current = true
    }
  }, [club?.activeSeasonId])

  const [destinationSeasonId, setDestinationSeasonId] = useState<string>('')
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set())
  const [showNewSeason, setShowNewSeason] = useState<'origin' | 'destination' | null>(null)
  const [showWizard, setShowWizard] = useState(false)

  const seasonOptions = [
    { value: NO_SEASON, label: 'Sin temporada asignada' },
    ...seasons.map((s) => ({ value: s.id, label: s.name })),
  ]

  const originGroups = useMemo(() => {
    return groups.filter((g) =>
      g.isActive && (originSeasonId === NO_SEASON ? !g.seasonId : g.seasonId === originSeasonId)
    )
  }, [groups, originSeasonId])

  const studentCount = (group: Group) =>
    enrollments.filter((e) => e.groupId === group.id && e.isActive).length

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const selectableGroups = originGroups.filter((g) => !g.renewedToGroupId)

  return (
    <div>
      <Header title="Temporadas" subtitle="Traspasa grupos y sus alumnos a una nueva temporada" />
      <div className="p-6 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">Temporada de origen:</span>
                <Select
                  options={seasonOptions}
                  value={originSeasonId}
                  onChange={(e) => {
                    setOriginSeasonId(e.target.value)
                    setSelectedGroupIds(new Set())
                    hasAutoSelectedOrigin.current = true
                  }}
                  className="w-auto"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">Traspasar a:</span>
                <Select
                  options={seasons.map((s) => ({ value: s.id, label: s.name }))}
                  value={destinationSeasonId}
                  onChange={(e) => setDestinationSeasonId(e.target.value)}
                  placeholder="Elegir temporada destino"
                  className="w-auto"
                />
                <Button variant="outline" size="sm" onClick={() => setShowNewSeason('destination')}>
                  + Nueva temporada
                </Button>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-2 w-8"></th>
                  <th className="py-2 pr-2">Grupo</th>
                  <th className="py-2 pr-2">Nivel</th>
                  <th className="py-2 pr-2">Alumnos</th>
                  <th className="py-2 pr-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {originGroups.map((group) => (
                  <tr key={group.id} className="border-b last:border-0">
                    <td className="py-2 pr-2">
                      {!group.renewedToGroupId && (
                        <Checkbox
                          checked={selectedGroupIds.has(group.id)}
                          onCheckedChange={() => toggleGroup(group.id)}
                        />
                      )}
                    </td>
                    <td className="py-2 pr-2 font-medium">{group.name}</td>
                    <td className="py-2 pr-2">{group.level}</td>
                    <td className="py-2 pr-2">{studentCount(group)}</td>
                    <td className="py-2 pr-2">
                      {group.renewedToGroupId ? (
                        <Badge variant="secondary" className="text-emerald-700">
                          ✓ Traspasado a{' '}
                          {seasons.find((s) => s.id === groups.find((g) => g.id === group.renewedToGroupId)?.seasonId)?.name ?? '—'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-700">Pendiente</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {originGroups.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No hay grupos en esta temporada de origen.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="flex justify-end">
              <Button
                disabled={selectedGroupIds.size === 0 || !destinationSeasonId}
                onClick={() => setShowWizard(true)}
              >
                Traspasar seleccionados ({selectedGroupIds.size}) →
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {showNewSeason && (
        <NewSeasonDialog
          open
          onOpenChange={(open) => !open && setShowNewSeason(null)}
          onCreated={(season) => {
            if (showNewSeason === 'destination') setDestinationSeasonId(season.id)
            setShowNewSeason(null)
          }}
        />
      )}

      {showWizard && destinationSeasonId && (
        <RenewGroupsDialog
          open
          onOpenChange={setShowWizard}
          seasonId={destinationSeasonId}
          groups={selectableGroups.filter((g) => selectedGroupIds.has(g.id))}
          onDone={() => {
            setShowWizard(false)
            setSelectedGroupIds(new Set())
          }}
        />
      )}
    </div>
  )
}
