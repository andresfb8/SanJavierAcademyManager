import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { isMinor as checkIsMinor } from '@/lib/utils'
import {
  PLAYER_LEVELS,
  PLAYER_STATUSES,
  DOMINANT_HANDS,
  PLAYER_POSITIONS,
  CLOTHING_SIZES,
  GUARDIAN_RELATIONSHIPS,
} from '@/constants'
import type { Player, PlayerLevel, PlayerStatus, DominantHand, PlayerPosition, GuardianRelationship, ClothingSize } from '@/types'

interface PlayerFormData {
  firstName: string
  lastName: string
  dni: string
  birthDate: string
  email: string
  phone: string
  address: string
  city: string
  postalCode: string
  level: PlayerLevel
  dominantHand: DominantHand
  position: PlayerPosition
  clothingSize: ClothingSize | ''
  licenseNumber: string
  previousExperience: string
  medicalNotes: string
  bankAccountHolder: string
  iban: string
  status: PlayerStatus
  notes: string
  guardianFirstName: string
  guardianLastName: string
  guardianDni: string
  guardianPhone: string
  guardianEmail: string
  guardianRelationship: GuardianRelationship
}

interface PlayerFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  player?: Player | null
  onSubmit: (data: PlayerFormData) => void
}

const defaultForm: PlayerFormData = {
  firstName: '', lastName: '', dni: '', birthDate: '',
  email: '', phone: '', address: '', city: 'San Javier', postalCode: '30730',
  level: 'iniciacion', dominantHand: 'derecha', position: 'ambos',
  clothingSize: '',
  licenseNumber: '', previousExperience: '', medicalNotes: '',
  bankAccountHolder: '', iban: '',
  status: 'activo', notes: '',
  guardianFirstName: '', guardianLastName: '', guardianDni: '',
  guardianPhone: '', guardianEmail: '', guardianRelationship: 'padre',
}

function PlayerFormDialog({ open, onOpenChange, player, onSubmit }: PlayerFormDialogProps) {
  const [form, setForm] = useState<PlayerFormData>({ ...defaultForm })

  const isMinorForm = form.birthDate ? checkIsMinor(new Date(form.birthDate)) : false

  useEffect(() => {
    if (open && player) {
      setForm({
        firstName: player.firstName,
        lastName: player.lastName,
        dni: player.dni,
        birthDate: player.birthDate instanceof Date
          ? player.birthDate.toISOString().split('T')[0]
          : String(player.birthDate).split('T')[0],
        email: player.email,
        phone: player.phone,
        address: player.address,
        city: player.city,
        postalCode: player.postalCode,
        level: player.level,
        dominantHand: player.dominantHand,
        position: player.position,
        clothingSize: player.clothingSize || '',
        licenseNumber: player.licenseNumber || '',
        previousExperience: player.previousExperience || '',
        medicalNotes: player.medicalNotes || '',
        bankAccountHolder: player.bankAccountHolder,
        iban: player.iban,
        status: player.status,
        notes: player.notes || '',
        guardianFirstName: player.guardian?.firstName || '',
        guardianLastName: player.guardian?.lastName || '',
        guardianDni: player.guardian?.dni || '',
        guardianPhone: player.guardian?.phone || '',
        guardianEmail: player.guardian?.email || '',
        guardianRelationship: player.guardian?.relationship || 'padre',
      })
    } else if (open) {
      setForm({ ...defaultForm })
    }
  }, [open, player])

  const handleSubmit = () => {
    onSubmit(form)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{player ? 'Editar jugador' : 'Nuevo jugador'}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="personal">
          <TabsList className="w-full">
            <TabsTrigger value="personal" className="flex-1">Datos personales</TabsTrigger>
            <TabsTrigger value="deportivos" className="flex-1">Datos deportivos</TabsTrigger>
            <TabsTrigger value="bancarios" className="flex-1">Datos bancarios</TabsTrigger>
            {isMinorForm && <TabsTrigger value="tutor" className="flex-1">Tutor</TabsTrigger>}
          </TabsList>

          <TabsContent value="personal">
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Apellidos *</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>DNI</Label>
                <Input value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Fecha de nacimiento *</Label>
                <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
                {isMinorForm && (
                  <p className="text-xs text-yellow-600 font-medium">Este jugador es menor de edad. Completa los datos del tutor.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono *</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Dirección</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Ciudad</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Código postal</Label>
                <Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="deportivos">
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Nivel *</Label>
                <Select
                  options={PLAYER_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value as PlayerLevel })}
                />
              </div>
              <div className="space-y-2">
                <Label>Mano dominante</Label>
                <Select
                  options={DOMINANT_HANDS.map((h) => ({ value: h.value, label: h.label }))}
                  value={form.dominantHand}
                  onChange={(e) => setForm({ ...form, dominantHand: e.target.value as DominantHand })}
                />
              </div>
              <div className="space-y-2">
                <Label>Posición</Label>
                <Select
                  options={PLAYER_POSITIONS.map((p) => ({ value: p.value, label: p.label }))}
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value as PlayerPosition })}
                />
              </div>
              <div className="space-y-2">
                <Label>Talla de ropa</Label>
                <Select
                  options={[
                    { value: '', label: 'Sin especificar' },
                    ...CLOTHING_SIZES.map((s) => ({ value: s.value, label: s.label })),
                  ]}
                  value={form.clothingSize}
                  onChange={(e) => setForm({ ...form, clothingSize: e.target.value as ClothingSize | '' })}
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  options={PLAYER_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as PlayerStatus })}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Numero de licencia</Label>
                <Input value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} placeholder="Ej: MU-12345" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Experiencia previa</Label>
                <Input value={form.previousExperience} onChange={(e) => setForm({ ...form, previousExperience: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Notas médicas</Label>
                <Input value={form.medicalNotes} onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bancarios">
            <div className="grid grid-cols-1 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Titular de la cuenta *</Label>
                <Input value={form.bankAccountHolder} onChange={(e) => setForm({ ...form, bankAccountHolder: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>IBAN *</Label>
                <Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} placeholder="ES00 0000 0000 0000 0000 0000" />
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          </TabsContent>

          {isMinorForm && (
            <TabsContent value="tutor">
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 col-span-2">
                  <p className="text-sm text-yellow-800 font-medium">
                    Datos del padre, madre o tutor legal del menor
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Parentesco *</Label>
                  <Select
                    options={GUARDIAN_RELATIONSHIPS.map((r) => ({ value: r.value, label: r.label }))}
                    value={form.guardianRelationship}
                    onChange={(e) => setForm({ ...form, guardianRelationship: e.target.value as GuardianRelationship })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>DNI *</Label>
                  <Input value={form.guardianDni} onChange={(e) => setForm({ ...form, guardianDni: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input value={form.guardianFirstName} onChange={(e) => setForm({ ...form, guardianFirstName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Apellidos *</Label>
                  <Input value={form.guardianLastName} onChange={(e) => setForm({ ...form, guardianLastName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono *</Label>
                  <Input value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={form.guardianEmail} onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })} />
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!form.firstName || !form.lastName || !form.birthDate}>
            {player ? 'Guardar cambios' : 'Crear jugador'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { PlayerFormDialog, type PlayerFormData }
