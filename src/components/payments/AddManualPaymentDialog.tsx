import { useState, useMemo, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/shared/SearchableSelect'
import { useDataStore } from '@/stores/dataStore'
import { PAYMENT_CATEGORIES } from '@/constants'
import type { PaymentCategory } from '@/types'
import { Plus } from 'lucide-react'

interface AddManualPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddManualPaymentDialog({ open, onOpenChange }: AddManualPaymentDialogProps) {
  const { players, addManualPayment } = useDataStore()

  const [playerId, setPlayerId] = useState('')
  const [concept, setConcept] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<PaymentCategory>('manual')
  const [notes, setNotes] = useState('')

  const activePlayers = useMemo(
    () => players.filter((p) => p.status === 'activo').sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [players]
  )

  function reset() {
    setPlayerId('')
    setConcept('')
    setAmount('')
    setCategory('manual')
    setNotes('')
  }

  useEffect(() => {
    if (open) reset()
  }, [open])

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen)
    if (!nextOpen) reset()
  }

  function handleSave() {
    if (!playerId || !concept || !amount) return
    const player = players.find((p) => p.id === playerId)
    if (!player) return
    addManualPayment({
      playerId,
      playerName: `${player.firstName} ${player.lastName}`,
      concept,
      amount: parseFloat(amount) || 0,
      category,
      notes: notes || undefined,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl sm:max-w-xl md:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo pago manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="player">Jugador *</Label>
            <SearchableSelect
              options={activePlayers.map((p) => ({
                value: p.id,
                label: `${p.lastName}, ${p.firstName}${p.dni ? ` - ${p.dni}` : ''}`
              }))}
              value={playerId}
              onChange={setPlayerId}
              placeholder="Seleccionar jugador..."
              searchPlaceholder="Buscar por nombre, apellido o DNI..."
              emptyMessage="No se encontraron jugadores"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Concepto</Label>
            <Input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej: Material deportivo, Clinica especial..." />
          </div>
          <div className="space-y-1.5">
            <Label>Importe (&euro;)</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select
              options={PAYMENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              value={category}
              onChange={(e) => setCategory(e.target.value as PaymentCategory)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionales (opcional)" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!playerId || !concept || !amount}>
            <Plus className="h-4 w-4 mr-1" />
            Crear pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
