import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useDataStore } from '@/stores/dataStore'
import { toast } from '@/hooks/use-toast'
import type { Group, BillingFrequency } from '@/types'

interface RenewGroupsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  seasonId: string
  groups: Group[]
  onDone: () => void
}

interface GroupDraft {
  name: string
  defaultTariffId: string
  defaultTariffPrice: number
  billingFrequency: BillingFrequency
  billingAnchorMonth: number
  startDate: string
  endDate: string
  includeStudents: boolean
  includedPlayerIds: Set<string>
}

const BILLING_OPTIONS = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'annual', label: 'Anual' },
  { value: 'installments', label: 'Cuotas' },
]

function toDateInput(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function RenewGroupsDialog({ open, onOpenChange, seasonId, groups, onDone }: RenewGroupsDialogProps) {
  const { seasons, enrollments, renewGroups } = useDataStore()
  const season = seasons.find((s) => s.id === seasonId)

  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(groups.map((g) => [g.id, true]))
  )
  const [drafts, setDrafts] = useState<Record<string, GroupDraft>>(() =>
    Object.fromEntries(
      groups.map((g) => {
        const activePlayerIds = enrollments
          .filter((e) => e.groupId === g.id && e.isActive)
          .map((e) => e.playerId)
        return [
          g.id,
          {
            name: g.name,
            defaultTariffId: g.defaultTariffId,
            defaultTariffPrice: g.defaultTariffPrice,
            billingFrequency: g.billingFrequency,
            billingAnchorMonth: 1,
            startDate: season ? toDateInput(season.startDate) : '',
            endDate: season ? toDateInput(season.endDate) : '',
            includeStudents: true,
            includedPlayerIds: new Set(activePlayerIds),
          },
        ]
      })
    )
  )
  const [submitting, setSubmitting] = useState(false)

  const updateDraft = (groupId: string, patch: Partial<GroupDraft>) => {
    setDrafts((prev) => ({ ...prev, [groupId]: { ...prev[groupId], ...patch } }))
  }

  const togglePlayer = (groupId: string, playerId: string) => {
    setDrafts((prev) => {
      const draft = prev[groupId]
      const next = new Set(draft.includedPlayerIds)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return { ...prev, [groupId]: { ...draft, includedPlayerIds: next } }
    })
  }

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      const items = groups.map((group) => {
        const draft = drafts[group.id]
        return {
          oldGroupId: group.id,
          seasonId,
          groupData: {
            name: draft.name,
            level: group.level,
            coachId: group.coachId,
            coachName: group.coachName,
            courtId: group.courtId,
            courtName: group.courtName,
            schedule: group.schedule,
            maxCapacity: group.maxCapacity,
            defaultTariffId: draft.defaultTariffId,
            defaultTariffPrice: draft.defaultTariffPrice,
            billingFrequency: draft.billingFrequency,
            billingAnchorMonth:
              draft.billingFrequency === 'quarterly' || draft.billingFrequency === 'annual'
                ? draft.billingAnchorMonth
                : undefined,
            startDate: new Date(draft.startDate),
            endDate: new Date(draft.endDate),
          },
          includeStudents: draft.includeStudents,
          includedPlayerIds: Array.from(draft.includedPlayerIds),
        }
      })
      await renewGroups(items)
      toast.success(`${groups.length} grupo(s) traspasado(s) a ${season?.name ?? 'la nueva temporada'}`)
      onDone()
    } catch {
      // renewGroup ya muestra su propio toast de error
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Traspasar a {season?.name ?? 'temporada'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {groups.map((group) => {
            const draft = drafts[group.id]
            const activeEnrollments = enrollments.filter((e) => e.groupId === group.id && e.isActive)
            const isOpen = expanded[group.id]

            return (
              <div key={group.id} className="border rounded-lg">
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-3 text-left font-medium"
                  onClick={() => setExpanded((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                >
                  <span>{group.name}</span>
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>

                {isOpen && (
                  <div className="p-3 pt-0 space-y-3 border-t">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Precio</Label>
                        <Input
                          type="number"
                          value={draft.defaultTariffPrice}
                          onChange={(e) =>
                            updateDraft(group.id, { defaultTariffPrice: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div>
                        <Label>Frecuencia de facturación</Label>
                        <Select
                          options={BILLING_OPTIONS}
                          value={draft.billingFrequency}
                          onChange={(e) =>
                            updateDraft(group.id, { billingFrequency: e.target.value as BillingFrequency })
                          }
                        />
                      </div>
                      <div>
                        <Label>Fecha de inicio</Label>
                        <Input
                          type="date"
                          value={draft.startDate}
                          onChange={(e) => updateDraft(group.id, { startDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Fecha de fin</Label>
                        <Input
                          type="date"
                          value={draft.endDate}
                          onChange={(e) => updateDraft(group.id, { endDate: e.target.value })}
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={draft.includeStudents}
                        onCheckedChange={(checked) =>
                          updateDraft(group.id, { includeStudents: checked === true })
                        }
                      />
                      Traspasar también a los alumnos matriculados
                    </label>

                    {draft.includeStudents && (
                      <div className="space-y-1 max-h-40 overflow-y-auto border rounded p-2">
                        {activeEnrollments.map((e) => (
                          <label key={e.playerId} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={draft.includedPlayerIds.has(e.playerId)}
                              onCheckedChange={() => togglePlayer(group.id, e.playerId)}
                            />
                            {e.playerName}
                          </label>
                        ))}
                        {activeEnrollments.length === 0 && (
                          <p className="text-xs text-slate-400">Sin alumnos matriculados actualmente.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Traspasando...' : `Confirmar traspaso de ${groups.length} grupo(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
