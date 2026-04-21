import React, { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useDataStore } from '@/stores/dataStore'
import { formatCurrency } from '@/lib/utils'
import { COURT_TYPES, COURT_SURFACES, BILLING_FREQUENCIES, MONTHS } from '@/constants'
import type { CourtType, CourtSurface, BillingFrequency, VatRate } from '@/types'
import {
  Save,
  Plus,
  Edit,
  Trash2,
  MapPin,
  CreditCard,
  Building,
  Clock,
  CalendarHeart
} from 'lucide-react'
import { HolidaysManager } from '@/components/settings/HolidaysManager'

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
    nif: club?.nif || '',
    legalName: club?.legalName || '',
    fiscalAddress: club?.fiscalAddress || '',
    defaultVatRateTariffs: club?.defaultVatRateTariffs ?? 0,
    defaultVatRateEvents: club?.defaultVatRateEvents ?? 21,
    defaultVatRatePrivateLessons: club?.defaultVatRatePrivateLessons ?? 21,
    defaultVatRateOther: club?.defaultVatRateOther ?? 21,
  })
  const [clubSaved, setClubSaved] = useState(false)

  // Court dialog
  const [showCourtDialog, setShowCourtDialog] = useState(false)
  const [editingCourtId, setEditingCourtId] = useState<string | null>(null)
  const [courtForm, setCourtForm] = useState({
    name: '', type: 'outdoor' as CourtType, surface: 'cristal' as CourtSurface,
    isActive: true, order: 0, notes: '',
  })
  const [deleteCourtId, setDeleteCourtId] = useState<string | null>(null)

  // Tariff dialog
  const [showTariffDialog, setShowTariffDialog] = useState(false)
  const [editingTariffId, setEditingTariffId] = useState<string | null>(null)
  const [tariffForm, setTariffForm] = useState({
    name: '', price: 0, billingFrequency: 'monthly' as BillingFrequency,
    installmentStartYear: new Date().getFullYear(),
    installmentStartMonth: 9,
    installmentEndYear: new Date().getFullYear() + 1,
    installmentEndMonth: 6,
    installmentPrices: {} as Record<string, number>,
    description: '', vatRate: 0 as VatRate, isActive: true,
  })
  const [deleteTariffId, setDeleteTariffId] = useState<string | null>(null)


  // Sync form with store when club data arrives (e.g. after realtimeSync or dataLoader)
  useEffect(() => {
    if (club) {
      setClubForm({
        name: club.name || '',
        address: club.address || '',
        phone: club.phone || '',
        email: club.email || '',
        openingTime: club.openingTime || '08:00',
        closingTime: club.closingTime || '22:00',
        iban: club.iban || '',
        bic: club.bic || '',
        creditorId: club.creditorId || '',
        nif: club.nif || '',
        legalName: club.legalName || '',
        fiscalAddress: club.fiscalAddress || '',
        defaultVatRateTariffs: club.defaultVatRateTariffs ?? 0,
        defaultVatRateEvents: club.defaultVatRateEvents ?? 21,
        defaultVatRatePrivateLessons: club.defaultVatRatePrivateLessons ?? 21,
        defaultVatRateOther: club.defaultVatRateOther ?? 21,
      })
    }
  }, [club])

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
    setCourtForm({ name: '', type: 'outdoor', surface: 'cristal', isActive: true, order: 0, notes: '' })
    setEditingCourtId(null)
  }

  const openEditCourt = (id: string) => {
    const court = courts.find((c) => c.id === id)
    if (!court) return
    setCourtForm({
      name: court.name, type: court.type, surface: court.surface,
      isActive: court.isActive, order: court.order ?? 0, notes: court.notes || '',
    })
    setEditingCourtId(id)
    setShowCourtDialog(true)
  }

  const handleSaveTariff = () => {
    let finalPrice = tariffForm.price
    let installmentStartDate: Date | undefined
    let installmentEndDate: Date | undefined
    let installmentPrices: Record<string, number> | undefined

    if (tariffForm.billingFrequency === 'installments') {
      installmentStartDate = new Date(tariffForm.installmentStartYear, tariffForm.installmentStartMonth - 1, 1)
      installmentEndDate = new Date(tariffForm.installmentEndYear, tariffForm.installmentEndMonth - 1, 1)
      installmentPrices = { ...tariffForm.installmentPrices }
      // Auto-calculate total price as the sum of all installment amounts
      finalPrice = Object.values(installmentPrices).reduce((sum, v) => sum + (v || 0), 0)
    }

    const data = {
      name: tariffForm.name,
      price: finalPrice,
      billingFrequency: tariffForm.billingFrequency,
      installmentStartDate: tariffForm.billingFrequency === 'installments' ? installmentStartDate : undefined,
      installmentEndDate: tariffForm.billingFrequency === 'installments' ? installmentEndDate : undefined,
      installmentPrices: tariffForm.billingFrequency === 'installments' ? installmentPrices : undefined,
      description: tariffForm.description || undefined,
      vatRate: tariffForm.vatRate,
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
    setTariffForm({
      name: '',
      price: 0,
      billingFrequency: 'monthly',
      installmentStartYear: new Date().getFullYear(),
      installmentStartMonth: 9,
      installmentEndYear: new Date().getFullYear() + 1,
      installmentEndMonth: 6,
      installmentPrices: {},
      description: '',
      vatRate: (club?.defaultVatRateTariffs ?? 0) as VatRate,
      isActive: true
    })
    setEditingTariffId(null)
  }

  const openEditTariff = (id: string) => {
    const tariff = tariffs.find((t) => t.id === id)
    if (!tariff) return
    const startDate = tariff.installmentStartDate ? new Date(tariff.installmentStartDate) : new Date()
    const endDate = tariff.installmentEndDate ? new Date(tariff.installmentEndDate) : new Date()
    setTariffForm({
      name: tariff.name, price: tariff.price,
      billingFrequency: tariff.billingFrequency,
      installmentStartYear: startDate.getFullYear(),
      installmentStartMonth: startDate.getMonth() + 1,
      installmentEndYear: endDate.getFullYear(),
      installmentEndMonth: endDate.getMonth() + 1,
      installmentPrices: tariff.installmentPrices ? { ...tariff.installmentPrices } : {},
      description: tariff.description || '', vatRate: tariff.vatRate, isActive: tariff.isActive,
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
            <TabsTrigger value="holidays">Días Festivos</TabsTrigger>
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

                {/* IVA / VAT Configuration */}
                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-sm font-medium mb-4">Configuración de IVA</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Tipos de IVA predeterminados para diferentes servicios. Se aplicarán automáticamente al crear nuevas tarifas y eventos.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>IVA para Cuotas/Tarifas</Label>
                      <Select
                        options={[
                          { value: '0', label: '0% (Exento)' },
                          { value: '10', label: '10% (Reducido)' },
                          { value: '21', label: '21% (General)' },
                        ]}
                        value={String(clubForm.defaultVatRateTariffs)}
                        onChange={(e) => setClubForm({ ...clubForm, defaultVatRateTariffs: Number(e.target.value) as VatRate })}
                      />
                      <p className="text-xs text-muted-foreground">Asociaciones sin ánimo de lucro: 0%</p>
                    </div>
                    <div className="space-y-2">
                      <Label>IVA para Eventos</Label>
                      <Select
                        options={[
                          { value: '0', label: '0% (Exento)' },
                          { value: '10', label: '10% (Reducido)' },
                          { value: '21', label: '21% (General)' },
                        ]}
                        value={String(clubForm.defaultVatRateEvents)}
                        onChange={(e) => setClubForm({ ...clubForm, defaultVatRateEvents: Number(e.target.value) as VatRate })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>IVA para Clases Particulares</Label>
                      <Select
                        options={[
                          { value: '0', label: '0% (Exento)' },
                          { value: '10', label: '10% (Reducido)' },
                          { value: '21', label: '21% (General)' },
                        ]}
                        value={String(clubForm.defaultVatRatePrivateLessons)}
                        onChange={(e) => setClubForm({ ...clubForm, defaultVatRatePrivateLessons: Number(e.target.value) as VatRate })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>IVA para Otros Servicios</Label>
                      <Select
                        options={[
                          { value: '0', label: '0% (Exento)' },
                          { value: '10', label: '10% (Reducido)' },
                          { value: '21', label: '21% (General)' },
                        ]}
                        value={String(clubForm.defaultVatRateOther)}
                        onChange={(e) => setClubForm({ ...clubForm, defaultVatRateOther: Number(e.target.value) as VatRate })}
                      />
                      <p className="text-xs text-muted-foreground">Para ventas manuales y otros conceptos</p>
                    </div>
                  </div>
                </div>

                {/* Fiscal Configuration for Invoicing */}
                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-sm font-medium mb-4">Configuración Fiscal</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Datos fiscales del club requeridos para la generación de facturas.
                  </p>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="nif">NIF del Club *</Label>
                      <Input
                        id="nif"
                        placeholder="A12345678"
                        value={clubForm.nif || ''}
                        onChange={(e) => setClubForm({ ...clubForm, nif: e.target.value })}
                        pattern="^[A-Z]\d{8}$"
                      />
                      <p className="text-xs text-muted-foreground">Formato: Letra + 8 dígitos (ej: A12345678)</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="legalName">Razón Social *</Label>
                      <Input
                        id="legalName"
                        placeholder="Club Deportivo San Javier S.L."
                        value={clubForm.legalName || ''}
                        onChange={(e) => setClubForm({ ...clubForm, legalName: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">Nombre legal completo para facturas</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fiscalAddress">Domicilio Fiscal *</Label>
                      <Textarea
                        id="fiscalAddress"
                        placeholder="Calle Principal 123, 30730 San Javier, Murcia"
                        value={clubForm.fiscalAddress || ''}
                        onChange={(e) => setClubForm({ ...clubForm, fiscalAddress: e.target.value })}
                        rows={2}
                      />
                      <p className="text-xs text-muted-foreground">Dirección fiscal completa</p>
                    </div>

                    {/* Invoice Counters Preview */}
                    <div className="mt-4 p-4 rounded-lg bg-muted/50">
                      <h4 className="text-sm font-medium mb-3">Numeración de Facturas</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Serie FC (Facturas Corrientes)</p>
                          <p className="text-sm font-mono">
                            Actual: {club?.invoiceCounters?.[new Date().getFullYear()]?.FC ?? 0}
                          </p>
                          <p className="text-xs text-primary mt-1">
                            Próxima: FC-{new Date().getFullYear()}-{String((club?.invoiceCounters?.[new Date().getFullYear()]?.FC ?? 0) + 1).padStart(3, '0')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Serie FR (Facturas Rectificativas)</p>
                          <p className="text-sm font-mono">
                            Actual: {club?.invoiceCounters?.[new Date().getFullYear()]?.FR ?? 0}
                          </p>
                          <p className="text-xs text-primary mt-1">
                            Próxima: FR-{new Date().getFullYear()}-{String((club?.invoiceCounters?.[new Date().getFullYear()]?.FR ?? 0) + 1).padStart(3, '0')}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Los contadores se incrementan automáticamente al crear facturas
                      </p>
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

          {/* Holidays settings */}
          <TabsContent value="holidays">
            <HolidaysManager />
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
                        <p>Orden visual: {court.order ?? '-'}</p>
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
                {tariffs.map((tariff) => {
                  const installmentCount = tariff.installmentPrices
                    ? Object.keys(tariff.installmentPrices).length
                    : 0
                  return (
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
                          {tariff.billingFrequency === 'monthly' ? (
                            <p className="text-2xl font-bold">{formatCurrency(tariff.price)}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
                          ) : (
                            <>
                              <p className="text-2xl font-bold">{formatCurrency(tariff.price)}<span className="text-sm font-normal text-muted-foreground"> total plan</span></p>
                              <p className="text-sm text-muted-foreground">Dividido en {installmentCount} plazos</p>
                            </>
                          )}
                          {tariff.billingFrequency === 'monthly'
                            ? <p className="text-sm text-muted-foreground">Facturación mensual</p>
                            : tariff.installmentPrices && (
                              <p className="text-xs text-muted-foreground">
                                {Object.entries(tariff.installmentPrices)
                                  .sort(([a], [b]) => a.localeCompare(b))
                                  .map(([key, amount]) => {
                                    const [y, m] = key.split('-')
                                    const monthLabel = MONTHS.find(mo => mo.value === Number(m))?.label.slice(0, 3) ?? m
                                    return `${monthLabel} ${y}: ${formatCurrency(amount)}`
                                  })
                                  .join(' · ')}
                              </p>
                            )
                          }
                          {tariff.description && <p className="text-xs text-muted-foreground">{tariff.description}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
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
              <Label>Orden de visualización</Label>
              <Input type="number" min={0} value={courtForm.order || ''} onChange={(e) => setCourtForm({ ...courtForm, order: e.target.value === '' ? 0 : Number(e.target.value) })} />
              <p className="text-xs text-muted-foreground">Posición en la que aparecerá en la agenda.</p>
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
        <DialogContent className="max-w-lg overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingTariffId ? 'Editar tarifa' : 'Nueva tarifa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={tariffForm.name} onChange={(e) => setTariffForm({ ...tariffForm, name: e.target.value })} placeholder="Ej: 2 días/semana Adultos" />
            </div>
            <div className="space-y-2">
              <Label>Frecuencia de facturación</Label>
              <Select
                options={BILLING_FREQUENCIES.map((f) => ({ value: f.value, label: f.label }))}
                value={tariffForm.billingFrequency}
                onChange={(e) => setTariffForm({ ...tariffForm, billingFrequency: e.target.value as BillingFrequency })}
              />
            </div>

            {tariffForm.billingFrequency === 'monthly' && (
              <div className="space-y-2">
                <Label>Precio mensual *</Label>
                <Input
                  type="number" min={0} step={0.01}
                  value={tariffForm.price}
                  onChange={(e) => setTariffForm({ ...tariffForm, price: Number(e.target.value) })}
                />
              </div>
            )}

            {tariffForm.billingFrequency === 'installments' && (() => {
              // Build list of YYYY-MM keys for all months in the selected range
              const months: string[] = []
              const startY = tariffForm.installmentStartYear
              const startM = tariffForm.installmentStartMonth
              const endY = tariffForm.installmentEndYear
              const endM = tariffForm.installmentEndMonth
              let y = startY, m = startM
              while (y < endY || (y === endY && m <= endM)) {
                months.push(`${y}-${String(m).padStart(2, '0')}`)
                m++
                if (m > 12) { m = 1; y++ }
                if (months.length > 36) break // safety cap
              }
              const total = months.reduce((s, key) => s + (tariffForm.installmentPrices[key] || 0), 0)
              const monthOptions = MONTHS.map(mo => ({ value: String(mo.value), label: mo.label }))
              const yearOptions = [2024, 2025, 2026, 2027, 2028].map(y => ({ value: String(y), label: String(y) }))

              return (
                <>
                  {/* Date range */}
                  <div className="space-y-2">
                    <Label>Rango del plan</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Inicio</p>
                        <div className="flex gap-1">
                          <Select
                            options={monthOptions}
                            value={String(tariffForm.installmentStartMonth)}
                            onChange={(e) => setTariffForm({ ...tariffForm, installmentStartMonth: Number(e.target.value) })}
                          />
                          <Select
                            options={yearOptions}
                            value={String(tariffForm.installmentStartYear)}
                            onChange={(e) => setTariffForm({ ...tariffForm, installmentStartYear: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Fin</p>
                        <div className="flex gap-1">
                          <Select
                            options={monthOptions}
                            value={String(tariffForm.installmentEndMonth)}
                            onChange={(e) => setTariffForm({ ...tariffForm, installmentEndMonth: Number(e.target.value) })}
                          />
                          <Select
                            options={yearOptions}
                            value={String(tariffForm.installmentEndYear)}
                            onChange={(e) => setTariffForm({ ...tariffForm, installmentEndYear: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Per-month prices */}
                  {months.length > 0 && (
                    <div className="space-y-2">
                      <Label>Importe por plazo</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {months.map((key) => {
                          const [y, mm] = key.split('-')
                          const monthLabel = MONTHS.find(mo => mo.value === Number(mm))?.label ?? mm
                          return (
                            <div key={key} className="flex items-center gap-2">
                              <span className="text-sm shrink-0 w-20">{monthLabel.slice(0, 3)} {y}</span>
                              <Input
                                type="number" min={0} step={0.01}
                                placeholder="0.00"
                                value={tariffForm.installmentPrices[key] ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value
                                  const newPrices = { ...tariffForm.installmentPrices }
                                  if (val === '' || val === '0') {
                                    delete newPrices[key]
                                  } else {
                                    newPrices[key] = Number(val)
                                  }
                                  setTariffForm({ ...tariffForm, installmentPrices: newPrices })
                                }}
                                className="h-8"
                              />
                            </div>
                          )
                        })}
                      </div>
                      {/* Auto-calculated total */}
                      <div className="mt-3 flex items-center justify-between rounded-md bg-muted/60 px-3 py-2">
                        <span className="text-sm font-medium">Total plan (autocalculado)</span>
                        <span className="text-lg font-bold text-primary">{formatCurrency(total)}</span>
                      </div>
                    </div>
                  )}
                </>
              )
            })()}

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input value={tariffForm.description} onChange={(e) => setTariffForm({ ...tariffForm, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>IVA</Label>
              <Select
                options={[
                  { value: '0', label: '0% (Exento)' },
                  { value: '10', label: '10% (Reducido)' },
                  { value: '21', label: '21% (General)' },
                ]}
                value={String(tariffForm.vatRate)}
                onChange={(e) => setTariffForm({ ...tariffForm, vatRate: Number(e.target.value) as VatRate })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTariffDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleSaveTariff}
              disabled={
                !tariffForm.name ||
                (tariffForm.billingFrequency === 'monthly' && tariffForm.price <= 0)
              }
            >
              {editingTariffId ? 'Guardar' : 'Crear'}
            </Button>
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
