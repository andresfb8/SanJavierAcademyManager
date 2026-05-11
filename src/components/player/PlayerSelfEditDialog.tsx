import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDataStore } from '@/stores/dataStore'
import type { Player } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  player: Player
}

interface ContactForm {
  phone: string
  email: string
  address: string
  city: string
  postalCode: string
}

export function PlayerSelfEditDialog({ open, onOpenChange, player }: Props) {
  const { updatePlayer } = useDataStore()
  const [form, setForm] = useState<ContactForm>({
    phone: '',
    email: '',
    address: '',
    city: '',
    postalCode: '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<ContactForm>>({})

  useEffect(() => {
    if (open) {
      setForm({
        phone: player.phone || '',
        email: player.email || '',
        address: player.address || '',
        city: player.city || '',
        postalCode: player.postalCode || '',
      })
      setErrors({})
    }
  }, [open, player])

  function validate(): boolean {
    const e: Partial<ContactForm> = {}
    if (!form.phone.trim()) e.phone = 'El teléfono es obligatorio'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Email no válido'
    if (!form.address.trim()) e.address = 'La dirección es obligatoria'
    if (!form.city.trim()) e.city = 'La ciudad es obligatoria'
    if (!form.postalCode.trim()) e.postalCode = 'El código postal es obligatorio'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      updatePlayer(player.id, {
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        address: form.address.trim(),
        city: form.city.trim(),
        postalCode: form.postalCode.trim(),
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  function handleChange(field: keyof ContactForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar mis datos de contacto</DialogTitle>
          <DialogDescription>
            Puedes actualizar tu teléfono, email y dirección postal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="se-phone">Teléfono</Label>
            <Input
              id="se-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="se-email">Email</Label>
            <Input
              id="se-email"
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="se-address">Dirección</Label>
            <Input
              id="se-address"
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
            />
            {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="se-city">Ciudad</Label>
              <Input
                id="se-city"
                value={form.city}
                onChange={(e) => handleChange('city', e.target.value)}
              />
              {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="se-postal">Código postal</Label>
              <Input
                id="se-postal"
                value={form.postalCode}
                onChange={(e) => handleChange('postalCode', e.target.value)}
              />
              {errors.postalCode && <p className="text-xs text-destructive">{errors.postalCode}</p>}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
