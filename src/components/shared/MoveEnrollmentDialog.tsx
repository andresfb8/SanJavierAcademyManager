import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/shared/SearchableSelect'
import { useDataStore } from '@/stores/dataStore'
import { MONTHS } from '@/constants'
import { formatCurrency } from '@/lib/utils'
import { billingFrequencyLabel } from '@/lib/billing-utils'
import type { BillingFrequency } from '@/types'

interface Props {
  enrollmentId: string
  currentGroupId: string
  onClose: () => void
}

export function MoveEnrollmentDialog({ enrollmentId, currentGroupId, onClose }: Props) {
  const { groups, enrollments, tariffs, moveEnrollment } = useDataStore()

  const enrollment = enrollments.find(e => e.id === enrollmentId)

  const [destinationGroupId, setDestinationGroupId] = useState('')
  const [tariffOption, setTariffOption] = useState<'keep' | 'new'>('keep')
  const [selectedTariffId, setSelectedTariffId] = useState('')
  const [discountMode, setDiscountMode] = useState<'none' | 'percentage' | 'fixed_price'>('none')
  const [discountPercentage, setDiscountPercentage] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [selectedBillingFrequency, setSelectedBillingFrequency] = useState<BillingFrequency>('monthly')
  const [selectedAnchorMonth, setSelectedAnchorMonth] = useState<number>(9)
  const [loading, setLoading] = useState(false)

  const step = destinationGroupId ? 2 : 1

  const availableGroups = useMemo(
    () => groups.filter(g => g.isActive && g.id !== currentGroupId),
    [groups, currentGroupId]
  )

  const destinationGroup = groups.find(g => g.id === destinationGroupId)
  const tariffSelectOptions = tariffs.filter(
    t => t.isActive && (t.billingFrequency !== 'installments' || destinationGroup?.billingFrequency === 'installments')
  )
  const selectedTariff = tariffs.find(t => t.id === selectedTariffId)
  const selectedTariffPrice = selectedTariff?.price ?? 0
  // Precio de referencia del periodo completo: el precio de la tarifa ya es
  // el importe del ciclo (no se multiplica). Los descuentos operan sobre él.
  const periodBasePrice = selectedTariffPrice

  const computedFinalPrice = useMemo(() => {
    if (discountMode === 'percentage') {
      const pct = parseFloat(discountPercentage)
      if (!isNaN(pct) && pct > 0 && pct <= 100) {
        return Math.round(periodBasePrice * (1 - pct / 100) * 100) / 100
      }
    }
    if (discountMode === 'fixed_price') {
      const parsed = parseFloat(customPrice)
      if (!isNaN(parsed) && parsed >= 0) return parsed
    }
    return periodBasePrice
  }, [discountMode, discountPercentage, customPrice, periodBasePrice])

  const handleSelectDestination = (groupId: string) => {
    setDestinationGroupId(groupId)
    const destGroup = groups.find(g => g.id === groupId)
    if (destGroup) {
      setSelectedTariffId(destGroup.defaultTariffId)
      setSelectedBillingFrequency(destGroup.billingFrequency)
      setSelectedAnchorMonth(new Date(destGroup.startDate).getMonth() + 1)
    }
  }

  const handleConfirm = async () => {
    if (!enrollment || !destinationGroupId) return
    setLoading(true)
    try {
      if (tariffOption === 'keep') {
        await moveEnrollment(enrollmentId, destinationGroupId, {
          playerId: enrollment.playerId,
          playerName: enrollment.playerName,
          tariffId: enrollment.tariffId,
          tariffName: enrollment.tariffName,
          customPrice: enrollment.customPrice,
          billingFrequency: enrollment.billingFrequency ?? 'monthly',
          billingAnchorMonth: enrollment.billingAnchorMonth,
        })
      } else {
        const tariff = tariffs.find(t => t.id === selectedTariffId)
        if (!tariff) return
        const tariffPeriodPrice = tariff.price
        let finalCustomPrice: number | undefined
        // Cuotas se facturan por el calendario del grupo (group.installmentPrices),
        // nunca por un precio individual — tariff.price ahí es el total de la
        // temporada, no un importe recurrente que tenga sentido guardar aquí.
        if (tariff.billingFrequency !== 'installments') {
          if (discountMode === 'percentage') {
            const pct = parseFloat(discountPercentage)
            if (!isNaN(pct) && pct > 0 && pct <= 100) {
              finalCustomPrice = Math.round(tariffPeriodPrice * (1 - pct / 100) * 100) / 100
            }
          } else if (discountMode === 'fixed_price') {
            const parsed = parseFloat(customPrice)
            if (!isNaN(parsed) && parsed >= 0) finalCustomPrice = parsed
          }
        }
        await moveEnrollment(enrollmentId, destinationGroupId, {
          playerId: enrollment.playerId,
          playerName: enrollment.playerName,
          tariffId: tariff.id,
          tariffName: tariff.name,
          customPrice: finalCustomPrice,
          billingFrequency: selectedBillingFrequency,
          billingAnchorMonth:
            selectedBillingFrequency === 'quarterly' || selectedBillingFrequency === 'annual'
              ? selectedAnchorMonth
              : undefined,
        })
      }
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!enrollment) return null

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mover a otro grupo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">
            Alumno: <span className="font-medium text-foreground">{enrollment.playerName}</span>
          </p>

          {/* Step 1: select destination group */}
          <div className="space-y-2">
            <Label>Grupo destino *</Label>
            <SearchableSelect
              options={availableGroups.map(g => ({
                value: g.id,
                label: `${g.name} (${g.currentEnrollment}/${g.maxCapacity})`,
              }))}
              value={destinationGroupId}
              onChange={handleSelectDestination}
              placeholder="Seleccionar grupo..."
              searchPlaceholder="Buscar grupo..."
              emptyMessage="No hay otros grupos activos"
            />
          </div>

          {/* Step 2: tariff option */}
          {step === 2 && destinationGroup && (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label>Tarifa</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="tariffOption"
                      checked={tariffOption === 'keep'}
                      onChange={() => setTariffOption('keep')}
                      className="accent-primary"
                    />
                    Mantener tarifa actual ({enrollment.tariffName})
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="tariffOption"
                      checked={tariffOption === 'new'}
                      onChange={() => setTariffOption('new')}
                      className="accent-primary"
                    />
                    Usar tarifa del grupo destino
                  </label>
                </div>
              </div>

              {tariffOption === 'new' && (
                <>
                  <div className="space-y-2">
                    <Label>Tarifa *</Label>
                    <Select
                      options={tariffSelectOptions.map(t => ({
                        value: t.id,
                        label: `${t.name} (${formatCurrency(t.price)})`,
                      }))}
                      value={selectedTariffId}
                      onChange={(e) => {
                        setSelectedTariffId(e.target.value)
                        const t = tariffs.find(t => t.id === e.target.value)
                        if (t) setSelectedBillingFrequency(t.billingFrequency)
                      }}
                    />
                  </div>

                  {selectedTariffId && selectedBillingFrequency === 'installments' ? (
                    <div className="space-y-1">
                      <Label>Precio</Label>
                      <p className="text-xs text-muted-foreground">Según cuotas del grupo.</p>
                    </div>
                  ) : selectedTariffId && (
                    <div className="space-y-2">
                      <Label>Precio</Label>
                      <p className="text-xs text-muted-foreground">
                        Frecuencia: <span className="font-medium text-foreground">{billingFrequencyLabel(selectedBillingFrequency)}</span>
                      </p>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" name="dm" checked={discountMode === 'none'} onChange={() => setDiscountMode('none')} className="accent-primary" />
                          Precio tarifa ({formatCurrency(periodBasePrice)})
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" name="dm" checked={discountMode === 'percentage'} onChange={() => setDiscountMode('percentage')} className="accent-primary" />
                          Descuento %
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" name="dm" checked={discountMode === 'fixed_price'} onChange={() => setDiscountMode('fixed_price')} className="accent-primary" />
                          Precio especial
                        </label>
                      </div>
                      {discountMode === 'percentage' && (
                        <Input type="number" step="1" min="1" max="100" placeholder="% de descuento" value={discountPercentage} onChange={e => setDiscountPercentage(e.target.value)} />
                      )}
                      {discountMode === 'fixed_price' && (
                        <Input type="number" step="0.01" min="0" placeholder="Precio final (€)" value={customPrice} onChange={e => setCustomPrice(e.target.value)} />
                      )}
                      {discountMode !== 'none' && (
                        <p className="text-xs text-muted-foreground">
                          Precio final: <span className="font-medium">{formatCurrency(computedFinalPrice)}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {(selectedBillingFrequency === 'quarterly' || selectedBillingFrequency === 'annual') && (
                    <div className="space-y-2">
                      <Label>{selectedBillingFrequency === 'quarterly' ? 'Mes de inicio del ciclo trimestral' : 'Mes de pago anual'}</Label>
                      <Select
                        options={MONTHS.map(m => ({ value: String(m.value), label: m.label }))}
                        value={String(selectedAnchorMonth)}
                        onChange={e => setSelectedAnchorMonth(Number(e.target.value))}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={!destinationGroupId || loading}
          >
            {loading ? 'Moviendo...' : 'Confirmar traslado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
