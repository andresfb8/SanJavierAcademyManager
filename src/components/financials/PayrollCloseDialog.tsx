import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useDataStore } from '@/stores/dataStore'
import { useEventPaymentsQuery, usePrivateLessonPaymentsQuery, useClubTransactionsQuery } from '@/hooks/useQueries'
import { formatCurrency } from '@/lib/utils'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { queryClient } from '@/lib/queryClient'

interface PayrollCloseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  year: number
  month: number
  onSuccess?: () => void
}

export function PayrollCloseDialog({ open, onOpenChange, year, month, onSuccess }: PayrollCloseDialogProps) {
  const { coaches, groups, events, privateLessons, coachSalaryConfigs, addTransaction } = useDataStore()
  const { success, error, warning } = useToast()
  
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Payments / Transactions
  const { data: eventPayments = [] } = useEventPaymentsQuery()
  const { data: privateLessonPayments = [] } = usePrivateLessonPaymentsQuery()
  const { data: transactions = [] } = useClubTransactionsQuery(year, month)

  // Check if we already have payrolls closed for this month
  const alreadyClosed = useMemo(() => {
    return transactions.some(t => t.type === 'gasto' && t.category === 'nomina')
  }, [transactions])

  const nominasEstimadas = useMemo(() => {
    // -- Ingresos y Gastos de eventos del mes --
    const eventosDelMes = events.filter((ev) => {
      const d = ev.date instanceof Date ? ev.date : new Date(ev.date)
      return d.getMonth() + 1 === month && d.getFullYear() === year
    })

    // -- Ingresos de clases particulares del mes --
    const clasesDelMes = privateLessons.filter((pl) => {
      const d = pl.date instanceof Date ? pl.date : new Date(pl.date)
      return d.getMonth() + 1 === month && d.getFullYear() === year
    })

    return coaches
      .filter((c) => c.isActive)
      .map((coach) => {
        const config = coachSalaryConfigs.find((c) => c.coachId === coach.id)
        if (!config) return { coach, total: 0, grupos: 0, clases: 0, eventosTotal: 0, bonuses: 0 }

        const coachGroups = groups.filter((g) => g.coachId === coach.id)
        const adultGroups = coachGroups.filter((g) => g.level !== 'menores').length
        const minorGroups = coachGroups.filter((g) => g.level === 'menores').length
        const gruposTotal = adultGroups * (config.ratePerGroupAdults || 0) + minorGroups * (config.ratePerGroupMinors || 0)

        const monthLessons = clasesDelMes.filter((pl) => pl.coachId === coach.id)
        const clasesTotal = monthLessons.reduce((acc, lesson) => {
          if (config.privateLessonPaymentType === 'fixed') return acc + (config.privateLessonRate || 0)
          return acc + lesson.price * ((config.privateLessonRate || 0) / 100)
        }, 0)

        const eventosTotal = eventosDelMes.reduce((acc, ev) => {
          if (!ev.coachIds.includes(coach.id)) return acc
          const totalIngs = eventPayments
            .filter((ep) => ep.eventId === ev.id && ep.status === 'pagado')
            .reduce((s, ep) => s + ep.amount, 0)
          const totalGsts = (ev.expenses ?? []).reduce((s, ex) => s + ex.amount, 0)
          const neto = Math.max(0, totalIngs - totalGsts)
          const n = ev.coachIds.length || 1
          if (config.eventPaymentType === 'percentage') return acc + (neto * ((config.eventRate || 0) / 100)) / n
          return acc + (config.eventRate || 0) / n
        }, 0)

        const bonuses = config.bonuses || 0
        return { coach, total: gruposTotal + clasesTotal + eventosTotal + bonuses, grupos: gruposTotal, clases: clasesTotal, eventosTotal, bonuses }
      })
      .filter((n) => n.total > 0 || coachSalaryConfigs.find((c) => c.coachId === n.coach.id))
  }, [coaches, coachSalaryConfigs, groups, events, privateLessons, month, year, eventPayments])

  const totalNóminas = nominasEstimadas.reduce((s, n) => s + n.total, 0)

  const handleCloseMonth = async () => {
    if (alreadyClosed) {
      error('El mes ya ha sido cerrado previamente.')
      return
    }

    if (nominasEstimadas.length === 0 || totalNóminas === 0) {
      warning('No hay nóminas estimadas que cerrar.')
      return
    }

    setIsSubmitting(true)
    try {
      // Creamos una fecha (el último día del mes es ideal)
      const dateToSave = new Date(year, month, 0) // El último día del mes

      for (const nomina of nominasEstimadas) {
        if (nomina.total > 0) {
          await addTransaction({
            type: 'gasto',
            category: 'nomina',
            concept: `Nómina - ${nomina.coach.firstName} ${nomina.coach.lastName}`,
            amount: nomina.total,
            date: dateToSave
          })
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['clubTransactions'] })

      success('Nóminas cerradas exitosamente')
      if (onSuccess) onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      error(err.message || 'Error al cerrar el mes')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cierre de Nóminas - {month}/{year}</DialogTitle>
          <DialogDescription>
            Revisa las nóminas estimadas de este mes. Al cerrar el mes, se generarán los gastos correspondientes en el balance del club.
          </DialogDescription>
        </DialogHeader>

        {alreadyClosed ? (
          <div className="rounded-lg border p-4 border-amber-200 bg-amber-50 text-amber-800 flex gap-4 mt-2">
            <AlertCircle className="h-5 w-5 stroke-amber-800 shrink-0" />
            <div>
              <h5 className="mb-1 font-medium leading-none tracking-tight">Mes ya cerrado</h5>
              <div className="text-sm [&_p]:leading-relaxed">
                Ya se han contabilizado nóminas como gastos reales en este mes. No puedes volver a cerrarlo aquí.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-md border mt-4 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Monitor</TableHead>
                    <TableHead className="text-right">Grupos</TableHead>
                    <TableHead className="text-right">Clases Part.</TableHead>
                    <TableHead className="text-right">Eventos</TableHead>
                    <TableHead className="text-right">Bonus</TableHead>
                    <TableHead className="text-right font-bold">TOTAL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nominasEstimadas.map((n) => (
                    <TableRow key={n.coach.id}>
                      <TableCell className="font-medium">{n.coach.firstName} {n.coach.lastName}</TableCell>
                      <TableCell className="text-right">{formatCurrency(n.grupos)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(n.clases)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(n.eventosTotal)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(n.bonuses)}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{formatCurrency(n.total)}</TableCell>
                    </TableRow>
                  ))}
                  {nominasEstimadas.length === 0 && (
                     <TableRow>
                       <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                         No hay entrenadores con nóminas.
                       </TableCell>
                     </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex justify-between items-center bg-muted/50 p-4 rounded-lg mt-2 font-semibold">
              <span className="text-lg">TOTAL A CONSOLIDAR:</span>
              <span className="text-2xl text-primary">{formatCurrency(totalNóminas)}</span>
            </div>
          </>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cerrar
          </Button>
          {!alreadyClosed && (
            <Button onClick={handleCloseMonth} disabled={isSubmitting || totalNóminas === 0} className="bg-primary hover:bg-primary/90">
              {isSubmitting ? 'Procesando...' : 'Proceder al Cierre'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
