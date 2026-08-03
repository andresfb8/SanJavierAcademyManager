import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDataStore } from '@/stores/dataStore'
import { toast } from '@/hooks/use-toast'
import type { Season } from '@/types'

interface NewSeasonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (season: Season) => void
}

export function NewSeasonDialog({ open, onOpenChange, onCreated }: NewSeasonDialogProps) {
  const { addSeason } = useDataStore()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const handleCreate = () => {
    if (!name.trim() || !startDate || !endDate) {
      toast.error('Rellena nombre, fecha de inicio y fecha de fin')
      return
    }
    const season = addSeason({
      name: name.trim(),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    })
    setName('')
    setStartDate('')
    setEndDate('')
    onCreated(season)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva temporada</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="season-name">Nombre</Label>
            <Input
              id="season-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="2026-2027"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="season-start">Fecha de inicio</Label>
              <Input
                id="season-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="season-end">Fecha de fin</Label>
              <Input
                id="season-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate}>Crear temporada</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
