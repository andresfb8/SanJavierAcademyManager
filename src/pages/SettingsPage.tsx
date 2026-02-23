import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Checkbox } from '@/components/ui/checkbox'
import { useDataStore } from '@/stores/dataStore'
import { formatCurrency } from '@/lib/utils'
import { COURT_TYPES, COURT_SURFACES, BILLING_FREQUENCIES, MONTHS } from '@/constants'
import type { CourtType, CourtSurface, BillingFrequency } from '@/types'
import {
  Save,
  Plus,
  Edit,
  Trash2,
  MapPin,
  CreditCard,
  Building,
  Clock,
} from 'lucide-react'

export default function SettingsPage() {
  const {
    club, courts, tariffs,
    updateClub, addCourt, updateCourt, deleteCourt,
    addTariff, updateTariff, deleteTariff,
  } = useDataStore()

  // Club form
  const [clubForm, setClubForm] = useState({
    name: club?.name || '',
    address: club?.address || '',
    phone: club?.phone || '',
    email: club?.email || '',
    openingTime: club?.openingTime || '08:00',
    closingTime: club?.closingTime || '22:00',
    iban: club?.iban || '',
    bic: club?.bic || '',
    creditorId: club?.creditorId || '',
  })
  const [clubSaved, setClubSaved] = useState(false)

  // Court dialog
  const [showCourtDialog, setShowCourtDialog] = useState(false)
  const [editingCourtId, setEditingCourtId] = useState<string | null>(null)
  const [courtForm, setCourtForm] = useState({
    name: '', type: 'outdoor' as CourtType, surface: 'cristal' as CourtSurface,
    isActive: true, notes: '',
  })
  const [deleteCourtId, setDeleteCourtId] = useState<string | null>(null)

  // Tariff dialog
  const [showTariffDialog, setShowTariffDialog] = useState(false)
  const [editingTariffId, setEditingTariffId] = useState<string | null>(null)
  const [tariffForm, setTariffForm] = useState({
    name: '', price: 0, billingFrequency: 'monthly' as BillingFrequency,
    installmentMonths: [] as number[], installmentPrices: {} as Record<number, number>,
    description: '', isActive: true,
  })
  const [deleteTariffId, setDeleteTariffId] = useState<string | null>(null)



  const handleSaveClub = () => {
    updateClub(clubForm)
    setClubSaved(true)
    setTimeout(() => setClubSaved(false), 2000)
  }

  const handleSaveCourt = () => {
    if (editingCourtId) {
      updateCourt(editingCourtId, courtForm)
    } else {
      addCourt(courtForm)
    }
    setShowCourtDialog(false)
    resetCourtForm()
  }

  const resetCourtForm = () => {
    setCourtForm({ name: '', type: 'outdoor', surface: 'cristal', isActive: true, notes: '' })
    setEditingCourtId(null)
  }

  const openEditCourt = (id: string) => {
    const court = courts.find((c) => c.id === id)
    if (!court) return
    setCourtForm({
      name: court.name, type: court.type, surface: court.surface,
      isActive: court.isActive, notes: court.notes || '',
    })
    setEditingCourtId(id)
    setShowCourtDialog(true)
  }

  const handleSaveTariff = () => {
    // Build installmentPrices only with months that have a custom price
    const cleanPrices: Record<number, number> = {}
    if (tariffForm.billingFrequency === 'installments') {
      for (const month of tariffForm.installmentMonths) {
        if (tariffForm.installmentPrices[month] && tariffForm.installmentPrices[month] !== tariffForm.price) {
          cleanPrices[month] = tariffForm.installmentPrices[month]
        }
      }
    }
    const hasCustomPrices = Object.keys(cleanPrices).length > 0

    const data = {
      name: tariffForm.name,
      price: tariffForm.price,
      billingFrequency: tariffForm.billingFrequency,
      installmentMonths: tariffForm.billingFrequency === 'installments' ? tariffForm.installmentMonths : undefined,
      installmentPrices: hasCustomPrices ? cleanPrices : undefined,
      description: tariffForm.description || undefined,
      isActive: tariffForm.isActive,
    }
    if (editingTariffId) {
      updateTariff(editingTariffId, data)
    } else {
      addTariff(data)
    }
    setShowTariffDialog(false)
    resetTariffForm()
  }

  const resetTariffForm = () => {
    setTariffForm({ name: '', price: 0, billingFrequency: 'monthly', installmentMonths: [], installmentPrices: {}, description: '', isActive: true })
    setEditingTariffId(null)
  }

  const openEditTariff = (id: string) => {
    const tariff = tariffs.find((t) => t.id === id)
    if (!tariff) return
    setTariffForm({
      name: tariff.name, price: tariff.price,
      billingFrequency: tariff.billingFrequency,
      installmentMonths: tariff.installmentMonths || [],
      installmentPrices: tariff.installmentPrices ? { ...tariff.installmentPrices } : {},
      description: tariff.description || '', isActive: tariff.isActive,
    })
    setEditingTariffId(id)
    setShowTariffDialog(true)
  }

  return (
    <div>
      <Header title="Configuración" subtitle="Ajustes del club y tarifas" />
      <div className="p-6">
        <Tabs defaultValue="club">
          <TabsList>
            <TabsTrigger value="club">Datos del club</TabsTrigger>
            <TabsTrigger value="courts">Pistas</TabsTrigger>
            <TabsTrigger value="tariffs">Tarifas</TabsTrigger>
          </TabsList>

          {/* Club settings */}
          <TabsContent value="club">
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building className="h-5 w-5" /> Información del club
                </CardTitle>
                <CardDescription>Datos generales de la escuela</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre del club</Label>
                    <Input value={clubForm.name} onChange={(e) => setClubForm({ ...clubForm, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={clubForm.email} onChange={(e) => setClubForm({ ...clubForm, email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input value={clubForm.phone} onChange={(e) => setClubForm({ ...clubForm, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Dirección</Label>
                    <Input value={clubForm.address} onChange={(e) => setClubForm({ ...clubForm, address: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora de apertura</Label>
                    <Input type="time" value={clubForm.openingTime} onChange={(e) => setClubForm({ ...clubForm, openingTime: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora de cierre</Label>
                    <Input type="time" value={clubForm.closingTime} onChange={(e) => setClubForm({ ...clubForm, closingTime: e.target.value })} />
                  </div>
                </div>

                {/* SEPA Direct Debit Configuration */}
                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-sm font-medium mb-4">Configuración SEPA (Domiciliación Bancaria)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>IBAN del club</Label>
                      <Input
                        placeholder="ES91 2100 0418 4502 0005 1332"
                        value={clubForm.iban}
                        onChange={(e) => setClubForm({ ...clubForm, iban: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">Cuenta desde la que se cobrarán las domiciliaciones</p>
                    </div>
                    <div className="space-y-2">
                      <Label>BIC/SWIFT (opcional)</Label>
                      <Input
                        placeholder="CAIXESBBXXX"
                        value={clubForm.bic}
                        onChange={(e) => setClubForm({ ...clubForm, bic: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">Código del banco</p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Identificador de Acreedor SEPA</Label>
                      <Input
                        placeholder="ES12ZZZ12345678"
                        value={clubForm.creditorId}
                        onChange={(e) => setClubForm({ ...clubForm, creditorId: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">Identificador único proporcionado por tu banco para domiciliaciones SEPA</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <Button onClick={handleSaveClub}>
                    <Save className="h-4 w-4 mr-1" />
                    {clubSaved ? 'Guardado' : 'Guardar cambios'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Courts */}
          <TabsContent value="courts">
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Pistas ({courts.length})</h3>
                <Button size="sm" onClick={() => { resetCourtForm(); setShowCourtDialog(true) }}>
                  <Plus className="h-4 w-4 mr-1" /> Añadir pista
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courts.map((court) => (
                  <Card key={court.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-semibold">{court.name}</p>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${court.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {court.isActive ? 'Activa' : 'Inactiva'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCourt(court.id)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteCourtId(court.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Tipo: {court.type === 'indoor' ? 'Cubierta' : 'Exterior'}</p>
                        <p>Superficie: {court.surface === 'cristal' ? 'Cristal' : court.surface === 'muro' ? 'Muro' : 'Césped'}</p>
                        {court.notes && <p className="text-xs italic">{court.notes}</p>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Tariffs */}
          <TabsContent value="tariffs">
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Tarifas ({tariffs.length})</h3>
                <Button size="sm" onClick={() => { resetTariffForm(); setShowTariffDialog(true) }}>
                  <Plus className="h-4 w-4 mr-1" /> Añadir tarifa
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tariffs.map((tariff) => (
                  <Card key={tariff.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-semibold">{tariff.name}</p>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tariff.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                              {tariff.isActive ? 'Activa' : 'Inactiva'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTariff(tariff.id)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTariffId(tariff.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-2xl font-bold">{formatCurrency(tariff.price)}<span className="text-sm font-normal text-muted-foreground">{tariff.billingFrequency === 'monthly' ? '/mes' : ' base'}</span></p>
                        <p className="text-sm text-muted-foreground">
                          {tariff.billingFrequency === 'monthly' ? 'Facturación mensual' : `Plazos: ${tariff.installmentMonths?.map((m) => MONTHS.find((mo) => mo.value === m)?.label.slice(0, 3)).join(', ')}`}
                        </p>
                        {tariff.billingFrequency === 'installments' && tariff.installmentPrices && Object.keys(tariff.installmentPrices).length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {tariff.installmentMonths
                              ?.filter((m) => tariff.installmentPrices?.[m])
                              .map((m) => `${MONTHS.find((mo) => mo.value === m)?.label.slice(0, 3)}: ${formatCurrency(tariff.installmentPrices![m])}`)
                              .join(', ')}
                          </p>
                        )}
                        {tariff.description && <p className="text-xs text-muted-foreground">{tariff.description}</p>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

      </div>

      {/* Court Dialog */}
      <Dialog open={showCourtDialog} onOpenChange={setShowCourtDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCourtId ? 'Editar pista' : 'Nueva pista'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={courtForm.name} onChange={(e) => setCourtForm({ ...courtForm, name: e.target.value })} placeholder="Ej: Pista 1" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select options={COURT_TYPES.map((t) => ({ value: t.value, label: t.label }))} value={courtForm.type} onChange={(e) => setCourtForm({ ...courtForm, type: e.target.value as CourtType })} />
            </div>
            <div className="space-y-2">
              <Label>Superficie</Label>
              <Select options={COURT_SURFACES.map((s) => ({ value: s.value, label: s.label }))} value={courtForm.surface} onChange={(e) => setCourtForm({ ...courtForm, surface: e.target.value as CourtSurface })} />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Input value={courtForm.notes} onChange={(e) => setCourtForm({ ...courtForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCourtDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveCourt} disabled={!courtForm.name}>{editingCourtId ? 'Guardar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tariff Dialog */}
      <Dialog open={showTariffDialog} onOpenChange={setShowTariffDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTariffId ? 'Editar tarifa' : 'Nueva tarifa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={tariffForm.name} onChange={(e) => setTariffForm({ ...tariffForm, name: e.target.value })} placeholder="Ej: 2 días/semana Adultos" />
            </div>
            <div className="space-y-2">
              <Label>Precio mensual *</Label>
              <Input type="number" min={0} step={0.01} value={tariffForm.price} onChange={(e) => setTariffForm({ ...tariffForm, price: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Frecuencia de facturación</Label>
              <Select options={BILLING_FREQUENCIES.map((f) => ({ value: f.value, label: f.label }))} value={tariffForm.billingFrequency} onChange={(e) => setTariffForm({ ...tariffForm, billingFrequency: e.target.value as BillingFrequency })} />
            </div>
            {tariffForm.billingFrequency === 'installments' && (
              <>
                <div className="space-y-2">
                  <Label>Meses de facturación</Label>
                  <div className="flex flex-wrap gap-2">
                    {MONTHS.map((m) => (
                      <label key={m.value} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={tariffForm.installmentMonths.includes(m.value)}
                          onCheckedChange={(checked) => {
                            const newMonths = checked
                              ? [...tariffForm.installmentMonths, m.value]
                              : tariffForm.installmentMonths.filter((v) => v !== m.value)
                            const newPrices = { ...tariffForm.installmentPrices }
                            if (!checked) delete newPrices[m.value]
                            setTariffForm({
                              ...tariffForm,
                              installmentMonths: newMonths,
                              installmentPrices: newPrices,
                            })
                          }}
                        />
                        {m.label.slice(0, 3)}
                      </label>
                    ))}
                  </div>
                </div>
                {tariffForm.installmentMonths.length > 0 && (
                  <div className="space-y-2">
                    <Label>Precio por plazo</Label>
                    <p className="text-xs text-muted-foreground">Deja en blanco para usar el precio base ({formatCurrency(tariffForm.price)})</p>
                    <div className="grid grid-cols-2 gap-2">
                      {tariffForm.installmentMonths
                        .slice()
                        .sort((a, b) => a - b)
                        .map((month) => {
                          const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? `Mes ${month}`
                          return (
                            <div key={month} className="flex items-center gap-2">
                              <span className="text-sm w-12 shrink-0">{monthLabel.slice(0, 3)}</span>
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                placeholder={String(tariffForm.price)}
                                value={tariffForm.installmentPrices[month] ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value
                                  const newPrices = { ...tariffForm.installmentPrices }
                                  if (val === '' || val === '0') {
                                    delete newPrices[month]
                                  } else {
                                    newPrices[month] = Number(val)
                                  }
                                  setTariffForm({ ...tariffForm, installmentPrices: newPrices })
                                }}
                                className="h-8"
                              />
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input value={tariffForm.description} onChange={(e) => setTariffForm({ ...tariffForm, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTariffDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveTariff} disabled={!tariffForm.name || tariffForm.price <= 0}>{editingTariffId ? 'Guardar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirms */}
      <ConfirmDialog
        open={!!deleteCourtId}
        onOpenChange={() => setDeleteCourtId(null)}
        title="Eliminar pista"
        description="Los grupos asignados a esta pista deberán reasignarse."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={() => { if (deleteCourtId) deleteCourt(deleteCourtId); setDeleteCourtId(null) }}
      />
      <ConfirmDialog
        open={!!deleteTariffId}
        onOpenChange={() => setDeleteTariffId(null)}
        title="Eliminar tarifa"
        description="Esta tarifa dejará de estar disponible para nuevas asignaciones."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={() => { if (deleteTariffId) deleteTariff(deleteTariffId); setDeleteTariffId(null) }}
      />

    </div>
  )
}
