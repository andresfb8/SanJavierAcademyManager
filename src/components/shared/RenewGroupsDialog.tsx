import { useState, useMemo } from 'react'
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
import { formatCurrency, cn } from '@/lib/utils'
import { billingFrequencyLabel } from '@/lib/billing-utils'
import { MONTHS } from '@/constants'

interface RenewGroupsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  seasonId: string
  groups: Group[]
  onDone: () => void
}

interface StudentDraft {
  playerId: string
  playerName: string
  included: boolean
  tariffId: string
  customPrice?: number
  billingFrequency: BillingFrequency
  billingAnchorMonth: number
}

interface GroupDraft {
  name: string
  defaultTariffId: string
  defaultTariffPrice: number
  billingFrequency: BillingFrequency
  installmentPrices?: Record<string, number>
  startDate: string
  endDate: string
  includeStudents: boolean
  students: StudentDraft[]
}

function toDateInput(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function RenewGroupsDialog({ open, onOpenChange, seasonId, groups, onDone }: RenewGroupsDialogProps) {
  const { seasons, enrollments, tariffs, renewGroups } = useDataStore()
  const season = seasons.find((s) => s.id === seasonId)
  const activeTariffs = useMemo(() => tariffs.filter((t) => t.isActive), [tariffs])

  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(groups.map((g) => [g.id, true]))
  )
  const [drafts, setDrafts] = useState<Record<string, GroupDraft>>(() =>
    Object.fromEntries(
      groups.map((g) => {
        const activeEnrollmentsForGroup = enrollments.filter((e) => e.groupId === g.id && e.isActive)
        const students: StudentDraft[] = activeEnrollmentsForGroup.map((e) => {
          const freq = e.billingFrequency ?? g.billingFrequency
          const tariff = tariffs.find((t) => t.id === e.tariffId)
          const computedPrice = tariff?.price ?? g.defaultTariffPrice
          // Para cuotas, tariff.price es el total de la temporada, no un
          // importe recurrente — nunca se materializa como customPrice a
          // partir de la tarifa. Solo se conserva un customPrice que el
          // alumno ya tuviera explícitamente; si no tenía ninguno, se deja
          // sin definir para que la facturación use el calendario de
          // cuotas del grupo (group.installmentPrices) mes a mes.
          const customPrice = freq === 'installments' ? e.customPrice : (e.customPrice ?? computedPrice)
          return {
            playerId: e.playerId,
            playerName: e.playerName,
            included: true,
            tariffId: e.tariffId,
            customPrice,
            billingFrequency: freq,
            billingAnchorMonth: e.billingAnchorMonth ?? 1,
          }
        })
        return [
          g.id,
          {
            name: g.name,
            defaultTariffId: g.defaultTariffId,
            defaultTariffPrice: g.defaultTariffPrice,
            billingFrequency: g.billingFrequency,
            installmentPrices: g.installmentPrices,
            startDate: season ? toDateInput(season.startDate) : '',
            endDate: season ? toDateInput(season.endDate) : '',
            includeStudents: true,
            students,
          },
        ]
      })
    )
  )
  const [submitting, setSubmitting] = useState(false)

  const validationSummary = useMemo(() => {
    let invalidStudentCount = 0
    let invalidGroupCount = 0
    for (const group of groups) {
      const draft = drafts[group.id]
      const defaultTariffInvalid = !tariffs.some((t) => t.id === draft.defaultTariffId)
      const groupInvalidStudents = draft.includeStudents
        ? draft.students.filter((s) => s.included && !tariffs.some((t) => t.id === s.tariffId)).length
        : 0
      invalidStudentCount += groupInvalidStudents
      if (defaultTariffInvalid || groupInvalidStudents > 0) invalidGroupCount += 1
    }
    return { invalidStudentCount, invalidGroupCount, hasBlockingIssues: invalidGroupCount > 0 }
  }, [groups, drafts, tariffs])

  const updateDraft = (groupId: string, patch: Partial<GroupDraft>) => {
    setDrafts((prev) => ({ ...prev, [groupId]: { ...prev[groupId], ...patch } }))
  }

  const updateStudent = (groupId: string, playerId: string, patch: Partial<StudentDraft>) => {
    setDrafts((prev) => {
      const draft = prev[groupId]
      return {
        ...prev,
        [groupId]: {
          ...draft,
          students: draft.students.map((s) => (s.playerId === playerId ? { ...s, ...patch } : s)),
        },
      }
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
            installmentPrices: draft.installmentPrices,
            startDate: new Date(draft.startDate),
            endDate: new Date(draft.endDate),
          },
          includeStudents: draft.includeStudents,
          includedStudents: draft.students
            .filter((s) => s.included)
            .map((s) => ({
              playerId: s.playerId,
              tariffId: s.tariffId,
              customPrice: s.customPrice,
              billingFrequency: s.billingFrequency,
              billingAnchorMonth:
                s.billingFrequency === 'quarterly' || s.billingFrequency === 'annual'
                  ? s.billingAnchorMonth
                  : undefined,
            })),
        }
      })
      const { succeeded, failed } = await renewGroups(items)

      if (failed.length === 0) {
        toast.success(`${succeeded.length} grupo(s) traspasado(s) a ${season?.name ?? 'la nueva temporada'}`)
        onDone()
      } else {
        // No cerramos el diálogo: los grupos con error siguen pendientes aquí
        // (los que sí se traspasaron desaparecen solos de la lista) para que
        // se puedan corregir y reintentar sin tener que rehacer todo desde
        // cero (aunque si el motivo requiere crear una tarifa nueva, sí habrá
        // que cerrar el asistente para hacerlo y volver a empezar ese grupo).
        const names = failed
          .slice(0, 5)
          .map((f) => groups.find((g) => g.id === f.oldGroupId)?.name ?? f.oldGroupId)
        const namesLabel = names.join(', ') + (failed.length > 5 ? ` y ${failed.length - 5} más` : '')
        const reasons = [...new Set(failed.map((f) => f.message))].slice(0, 3).join(' / ')
        toast.warning(
          `${succeeded.length} grupo(s) traspasado(s). ${failed.length} no se pudieron traspasar (${namesLabel}): ${reasons}`,
          9000
        )
      }
    } catch {
      // renewGroups ya no debería lanzar (captura cada fallo por grupo), esto
      // es solo un cortafuegos por si acaso.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Traspasar a {season?.name ?? 'temporada'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {groups.map((group) => {
            const draft = drafts[group.id]
            const isOpen = expanded[group.id]
            const defaultTariffInvalid = !tariffs.some((t) => t.id === draft.defaultTariffId)
            const invalidStudentIds = new Set(
              draft.includeStudents
                ? draft.students
                    .filter((s) => s.included && !tariffs.some((t) => t.id === s.tariffId))
                    .map((s) => s.playerId)
                : []
            )
            const groupHasIssue = defaultTariffInvalid || invalidStudentIds.size > 0

            return (
              <div key={group.id} className={cn('border rounded-lg', groupHasIssue && 'border-red-300')}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 p-3 text-left font-medium"
                  onClick={() => setExpanded((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                >
                  <span className="min-w-0 truncate flex items-center gap-2">
                    {group.name}
                    {groupHasIssue && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 shrink-0">
                        {defaultTariffInvalid
                          ? 'Tarifa por defecto no válida'
                          : `${invalidStudentIds.size} alumno(s) con tarifa no válida`}
                      </span>
                    )}
                  </span>
                  {isOpen ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                </button>

                {isOpen && (
                  <div className="p-3 pt-0 space-y-3 border-t">
                    <div className="space-y-3">
                      <div>
                        <Label>Tarifa por defecto</Label>
                        <Select
                          className={cn(defaultTariffInvalid && 'border-red-400 ring-1 ring-red-300')}
                          options={activeTariffs.map((t) => ({
                            value: t.id,
                            label: `${t.name} (${formatCurrency(t.price)})`,
                          }))}
                          value={draft.defaultTariffId}
                          onChange={(e) => {
                            const tariffId = e.target.value
                            const tariff = tariffs.find((t) => t.id === tariffId)
                            updateDraft(group.id, {
                              defaultTariffId: tariffId,
                              defaultTariffPrice: tariff?.price ?? 0,
                              billingFrequency: tariff?.billingFrequency ?? 'monthly',
                              installmentPrices: tariff?.installmentPrices,
                            })
                          }}
                        />
                        {defaultTariffInvalid && (
                          <p className="text-xs text-red-600 mt-1">Esta tarifa ya no existe — elige otra.</p>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <div className="max-h-64 overflow-auto border rounded">
                        {draft.students.length === 0 ? (
                          <p className="text-xs text-slate-400 p-2">Sin alumnos matriculados actualmente.</p>
                        ) : (
                          <table className="w-full min-w-[660px] text-xs">
                            <thead className="bg-slate-50 sticky top-0">
                              <tr className="text-left text-slate-500">
                                <th className="p-1.5 w-6"></th>
                                <th className="p-1.5 min-w-[100px]">Alumno</th>
                                <th className="p-1.5 min-w-[180px]">Tarifa</th>
                                <th className="p-1.5 min-w-[70px]">Precio</th>
                                <th className="p-1.5 min-w-[90px]">Frecuencia</th>
                                <th className="p-1.5 min-w-[120px]">Anclaje</th>
                              </tr>
                            </thead>
                            <tbody>
                              {draft.students.map((student) => {
                                const studentInvalid = invalidStudentIds.has(student.playerId)
                                return (
                                <tr key={student.playerId} className={cn('border-t', studentInvalid && 'bg-red-50')}>
                                  <td className="p-1.5">
                                    <Checkbox
                                      checked={student.included}
                                      onCheckedChange={(checked) =>
                                        updateStudent(group.id, student.playerId, { included: checked === true })
                                      }
                                    />
                                  </td>
                                  <td className="p-1.5">{student.playerName}</td>
                                  <td className="p-1.5">
                                    <Select
                                      className={cn('h-7 min-w-[170px] text-xs', studentInvalid && 'border-red-400 ring-1 ring-red-300')}
                                      value={student.tariffId}
                                      onChange={(e) => {
                                        const tariffId = e.target.value
                                        const tariff = tariffs.find((t) => t.id === tariffId)
                                        const freq = tariff?.billingFrequency ?? 'monthly'
                                        updateStudent(group.id, student.playerId, {
                                          tariffId,
                                          customPrice: freq === 'installments' ? undefined : (tariff?.price ?? 0),
                                          billingFrequency: freq,
                                        })
                                      }}
                                      options={activeTariffs.map((t) => ({ value: t.id, label: t.name }))}
                                      disabled={!student.included}
                                    />
                                    {studentInvalid && (
                                      <p className="text-[10px] text-red-600 mt-0.5">Tarifa no disponible — elige otra o desmárcalo.</p>
                                    )}
                                  </td>
                                  <td className="p-1.5">
                                    {student.billingFrequency === 'installments' ? (
                                      <span className="text-slate-400 text-[11px]">Según cuotas del grupo</span>
                                    ) : (
                                      <Input
                                        type="number"
                                        className="h-7 min-w-[70px] text-xs"
                                        value={student.customPrice ?? ''}
                                        onChange={(e) => {
                                          const raw = e.target.value
                                          updateStudent(group.id, student.playerId, {
                                            customPrice: raw === '' ? undefined : (parseFloat(raw) || 0),
                                          })
                                        }}
                                        disabled={!student.included}
                                      />
                                    )}
                                  </td>
                                  <td className="p-1.5 whitespace-nowrap text-slate-600">
                                    {billingFrequencyLabel(student.billingFrequency)}
                                  </td>
                                  <td className="p-1.5">
                                    {(student.billingFrequency === 'quarterly' || student.billingFrequency === 'annual') ? (
                                      <Select
                                        className="h-7 min-w-[110px] text-xs"
                                        value={String(student.billingAnchorMonth)}
                                        onChange={(e) =>
                                          updateStudent(group.id, student.playerId, { billingAnchorMonth: parseInt(e.target.value, 10) })
                                        }
                                        options={MONTHS.map((m) => ({ value: String(m.value), label: m.label }))}
                                        disabled={!student.included}
                                      />
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
                                </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {validationSummary.hasBlockingIssues && (
          <p className="text-xs text-red-600 -mb-1">
            {validationSummary.invalidStudentCount > 0
              ? `Resuelve ${validationSummary.invalidStudentCount} alumno(s) con tarifa no válida antes de continuar: elige otra tarifa o desmárcalos.`
              : 'Alguno de los grupos tiene una tarifa por defecto no válida — elige otra antes de continuar.'}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || validationSummary.hasBlockingIssues}>
            {submitting ? 'Traspasando...' : `Confirmar traspaso de ${groups.length} grupo(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
