import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDataStore } from '@/stores/dataStore'
import type { Coach } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  coach: Coach
}

interface CoachContactForm {
  phone: string
  email: string
  address: string
  certifications: string
  notes: string
}

export function CoachSelfEditDialog({ open, onOpenChange, coach }: Props) {
  const { updateCoach } = useDataStore()
  const [form, setForm] = useState<CoachContactForm>({
    phone: '',
    email: '',
    address: '',
    certifications: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<CoachContactForm>>({})

  useEffect(() => {
    if (open) {
      setForm({
        phone: coach.phone || '',
        email: coach.email || '',
        address: coach.address || '',
        certifications: coach.certifications || '',
        notes: coach.notes || '',
      })
      setErrors({})
    }
  }, [open, coach])

  function validate(): boolean {
    const e: Partial<CoachContactForm> = {}
    if (!form.phone.trim()) e.phone = 'El teléfono es obligatorio'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Email no válido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      updateCoach(coach.id, {
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        address: form.address.trim() || undefined,
        certifications: form.certifications.trim() || undefined,
        notes: form.notes.trim() || undefined,
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  function handleChange(field: keyof CoachContactForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar mis datos de contacto</DialogTitle>
          <DialogDescription>
            Actualiza tu teléfono, email, dirección y certificaciones.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cs-phone">Teléfono</Label>
            <Input
              id="cs-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cs-email">Email</Label>
            <Input
              id="cs-email"
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cs-address">Dirección (opcional)</Label>
            <Input
              id="cs-address"
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Calle, número, ciudad..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cs-certs">Certificaciones (opcional)</Label>
            <Input
              id="cs-certs"
              value={form.certifications}
              onChange={(e) => handleChange('certifications', e.target.value)}
              placeholder="Ej: Nivel 3 FEP, CPF..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cs-notes">Notas (opcional)</Label>
            <textarea
              id="cs-notes"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={2}
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Información adicional..."
            />
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
