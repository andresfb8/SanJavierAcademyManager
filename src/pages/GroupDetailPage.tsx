import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { MoveEnrollmentDialog } from '@/components/shared/MoveEnrollmentDialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GroupTrainingPlanTab } from '@/components/groups/GroupTrainingPlanTab'
import { SearchableSelect } from '@/components/shared/SearchableSelect'
import { useDataStore } from '@/stores/dataStore'
import { ArrowLeft, Users, Clock, MapPin, User, CreditCard, UserPlus, UserMinus, Calendar, FileDown, BookOpen, Pencil, ArrowRightLeft } from 'lucide-react'
import { formatDate, formatCurrency, generateId } from '@/lib/utils'
import { DAYS_OF_WEEK, PLAYER_LEVELS, BILLING_FREQUENCIES, MONTHS } from '@/constants'
import { generateGroupDetailReport } from '@/lib/pdf-reports'
import { useAuthStore } from '@/stores/authStore'
import type { BillingFrequency } from '@/types'
import { billingFrequencyLabel, cycleLength } from '@/lib/billing-utils'

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { groups, players, enrollments, tariffs, addEnrollment, deactivateEnrollment, addToWaitlist, promoteFromWaitlist, removeFromWaitlist } = useDataStore()
  const { user } = useAuthStore()

  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [removeEnrollmentId, setRemoveEnrollmentId] = useState<string | null>(null)
  const [moveEnrollmentId, setMoveEnrollmentId] = useState<string | null>(null)
  const [invoiceActionData, setInvoiceActionData] = useState<{ enrollmentId: string, hasPending: boolean } | null>(null)
  const [partialReceiptData, setPartialReceiptData] = useState<{ enrollmentId: string, amount: string } | null>(null)
  const [showEditTariff, setShowEditTariff] = useState(false)
  const [newTariffId, setNewTariffId] = useState('')

  // Add player form state
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [selectedTariffId, setSelectedTariffId] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [discountMode, setDiscountMode] = useState<'none' | 'percentage' | 'fixed_price'>('none')
  const [discountPercentage, setDiscountPercentage] = useState('')
  const [selectedBillingFrequency, setSelectedBillingFrequency] = useState<BillingFrequency>('monthly')
  const [selectedAnchorMonth, setSelectedAnchorMonth] = useState<number>(9)

  // Find the group
  const group = useMemo(() => groups.find((g) => g.id === id), [groups, id])

  const activeTariffs = useMemo(() => tariffs.filter((t) => t.isActive), [tariffs])

  // Active enrollments for this group
  const groupEnrollments = useMemo(
    () => enrollments.filter((e) => e.groupId === id && e.isActive),
    [enrollments, id]
  )

  // Players available to add (active, not already enrolled in this group)
  const enrolledPlayerIds = useMemo(
    () => new Set(groupEnrollments.map((e) => e.playerId)),
    [groupEnrollments]
  )

  // Cola de espera del grupo (enrollments isWaitlist ordenados por posición)
  const waitlistEntries = useMemo(
    () =>
      enrollments
        .filter((e) => e.groupId === id && e.isWaitlist && !e.isActive)
        .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0)),
    [enrollments, id]
  )

  const waitlistPlayerIds = useMemo(
    () => new Set(waitlistEntries.map((e) => e.playerId)),
    [waitlistEntries]
  )

  const availablePlayers = useMemo(
    () =>
      players.filter(
        (p) =>
          (p.status === 'activo' || p.status === 'lista_espera') &&
          !enrolledPlayerIds.has(p.id) &&
          !waitlistPlayerIds.has(p.id)
      ),
    [players, enrolledPlayerIds, waitlistPlayerIds]
  )

  const hasFreeSpot = group ? group.currentEnrollment < group.maxCapacity : false
  const isFull = group ? group.currentEnrollment >= group.maxCapacity : false

  // ===================
  // STATE - Bajas
  // ===================
  const [unenrollmentDate, setUnenrollmentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  // Occupancy calculations
  const occupancyPercentage = group
    ? Math.round((group.currentEnrollment / group.maxCapacity) * 100)
    : 0

  const occupancyColor = occupancyPercentage >= 100
    ? 'bg-red-500'
    : occupancyPercentage >= 75
      ? 'bg-yellow-500'
      : 'bg-green-500'

  // Helper: get day label from dayOfWeek number
  const getDayLabel = (dayOfWeek: number) => {
    const day = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek)
    return day ? day.label : `Día ${dayOfWeek}`
  }

  // Reset form
  const resetAddForm = () => {
    setSelectedPlayerId('')
    setSelectedTariffId('')
    setCustomPrice('')
    setDiscountMode('none')
    setDiscountPercentage('')
    setSelectedBillingFrequency('monthly')
    setSelectedAnchorMonth(group ? new Date(group.startDate).getMonth() + 1 : 9)
  }

  // Handle adding a player to the group
  // Compute final price based on discount mode
  const selectedTariffPrice = tariffs.find((t) => t.id === selectedTariffId)?.price ?? 0
  // Precio de referencia del periodo completo: cuota mensual x meses del ciclo
  // seleccionado. Los descuentos operan sobre este total, no sobre el mes.
  const periodBasePrice = selectedTariffPrice * cycleLength(selectedBillingFrequency)
  const computedFinalPrice = useMemo(() => {
    if (discountMode === 'percentage') {
      const pct = parseFloat(discountPercentage)
      if (!isNaN(pct) && pct > 0 && pct <= 100) {
        return Math.round(periodBasePrice * (1 - pct / 100) * 100) / 100
      }
      return periodBasePrice
    }
    if (discountMode === 'fixed_price') {
      const parsed = parseFloat(customPrice)
      return !isNaN(parsed) && parsed >= 0 ? parsed : periodBasePrice
    }
    return periodBasePrice
  }, [discountMode, discountPercentage, customPrice, periodBasePrice])

  const handleAddPlayer = async () => {
    if (!group || !selectedPlayerId || !selectedTariffId) return

    const player = players.find((p) => p.id === selectedPlayerId)
    const tariff = tariffs.find((t) => t.id === selectedTariffId)
    if (!player || !tariff) return

    const tariffPeriodPrice = tariff.price * cycleLength(selectedBillingFrequency)
    let finalCustomPrice: number | undefined
    if (discountMode === 'percentage') {
      const pct = parseFloat(discountPercentage)
      if (!isNaN(pct) && pct > 0 && pct <= 100) {
        finalCustomPrice = Math.round(tariffPeriodPrice * (1 - pct / 100) * 100) / 100
      }
    } else if (discountMode === 'fixed_price') {
      const parsed = parseFloat(customPrice)
      if (!isNaN(parsed) && parsed >= 0) {
        finalCustomPrice = parsed
      }
    }

    // Grupo lleno: en vez de matricular, añadir a la lista de espera.
    if (isFull) {
      addToWaitlist({
        playerId: player.id,
        playerName: `${player.firstName} ${player.lastName}`,
        groupId: group.id,
        groupName: group.name,
        tariffId: tariff.id,
        tariffName: tariff.name,
        customPrice: finalCustomPrice,
      })
      setShowAddPlayer(false)
      resetAddForm()
      return
    }

    const { needsPartialReceipt, enrollmentId } = await addEnrollment({
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      groupId: group.id,
      groupName: group.name,
      tariffId: tariff.id,
      tariffName: tariff.name,
      customPrice: finalCustomPrice,
      billingFrequency: selectedBillingFrequency,
      billingAnchorMonth: (selectedBillingFrequency === 'quarterly' || selectedBillingFrequency === 'annual')
        ? selectedAnchorMonth
        : undefined,
      enrollmentDate: new Date(),
      isActive: true,
    })

    setShowAddPlayer(false)
    resetAddForm()

    if (needsPartialReceipt) {
      setPartialReceiptData({
        enrollmentId,
        amount: (finalCustomPrice ?? tariffPeriodPrice).toString()
      })
    }
  }

  const handlePromoteWaitlist = async (enrollmentId: string) => {
    try {
      await promoteFromWaitlist(enrollmentId)
    } catch {
      // Errores gestionados en el store (toast)
    }
  }

  const handleGeneratePartialReceipt = async () => {
    if (!partialReceiptData) return
    try {
      await useDataStore.getState().generatePartialReceipt(partialReceiptData.enrollmentId, parseFloat(partialReceiptData.amount))
      setPartialReceiptData(null)
    } catch (e) {
      // Error is handled by dataStore
    }
  }

  // Handle removing a player (deactivate enrollment)
  const handleRemovePlayer = async () => {
    if (removeEnrollmentId) {
      const hasPending = await useDataStore.getState().checkPendingPaymentsForEnrollment(removeEnrollmentId)
      if (hasPending) {
        setInvoiceActionData({ enrollmentId: removeEnrollmentId, hasPending: true })
      } else {
        await deactivateEnrollment(removeEnrollmentId, new Date(unenrollmentDate + 'T00:00:00'), { deleteInvoice: false })
        setRemoveEnrollmentId(null)
        setUnenrollmentDate(new Date().toISOString().split('T')[0])
      }
    }
  }

  const confirmRemoveEnrollment = async (deleteInvoice: boolean) => {
    if (invoiceActionData) {
      await deactivateEnrollment(invoiceActionData.enrollmentId, new Date(unenrollmentDate + 'T00:00:00'), { deleteInvoice })
      setRemoveEnrollmentId(null)
      setInvoiceActionData(null)
      setUnenrollmentDate(new Date().toISOString().split('T')[0])
    }
  }

  // Handle updating group's tariff
  const handleUpdateTariff = () => {
    if (!group || !newTariffId) return
    const selectedTariff = tariffs.find(t => t.id === newTariffId)
    if (!selectedTariff) return

    useDataStore.getState().updateGroup(group.id, {
      defaultTariffId: selectedTariff.id,
      defaultTariffPrice: selectedTariff.price,
      billingFrequency: selectedTariff.billingFrequency,
      installmentPrices: selectedTariff.installmentPrices
    })
    setShowEditTariff(false)
  }

  // Handle PDF export
  const handleExportPDF = async () => {
    if (!group) return

    const clubName = user?.clubId || 'San Javier Academy'
    const levelInfo = PLAYER_LEVELS.find((l) => l.value === group.level)
    const defaultTariff = tariffs.find((t) => t.id === group.defaultTariffId)

    // Format schedule
    const scheduleText = group.schedule
      .map((slot) => {
        const day = DAYS_OF_WEEK.find((d) => d.value === slot.dayOfWeek)
        return `${day?.label || '?'} ${slot.startTime} - ${slot.endTime}`
      })
      .join(', ')

    // Get enrolled players
    const enrolledPlayers = groupEnrollments.map((enrollment) => {
      const player = players.find((p) => p.id === enrollment.playerId)
      if (!player) return null

      const playerLevel = PLAYER_LEVELS.find((l) => l.value === player.level)

      return {
        name: `${player.firstName} ${player.lastName}`,
        level: playerLevel?.label || player.level,
        email: player.email || 'Sin email',
        phone: player.phone || 'Sin telefono',
      }
    }).filter((p) => p !== null) as { name: string; level: string; email: string; phone: string }[]

    await generateGroupDetailReport({
      clubName,
      groupName: group.name,
      level: levelInfo?.label || group.level,
      coach: group.coachName,
      court: group.courtName,
      schedule: scheduleText,
      monthlyFee: defaultTariff?.price || 0,
      currentEnrollment: group.currentEnrollment,
      maxCapacity: group.maxCapacity,
      enrolledPlayers,
    })
  }

  // ===========================
  // GROUP NOT FOUND
  // ===========================
  if (!group) {
    return (
      <div>
        <Header title="Detalle del grupo" />
        <div className="p-6">
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <p className="text-lg text-muted-foreground">Grupo no encontrado</p>
            <Button variant="outline" onClick={() => navigate('/grupos')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a grupos
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Find default tariff for display
  const defaultTariff = tariffs.find((t) => t.id === group.defaultTariffId)

  return (
    <div>
      {/* Header */}
      <Header
        title={group.name}
        subtitle={`${group.coachName} · ${group.courtName}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/grupos')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileDown className="h-4 w-4 mr-1" />
              Exportar PDF
            </Button>
            <Button size="sm" onClick={() => { resetAddForm(); setShowAddPlayer(true) }}>
              <UserPlus className="h-4 w-4 mr-1" />
              Añadir jugador
            </Button>
          </div>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="informacion" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="informacion" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              General y Alumnos
            </TabsTrigger>
            <TabsTrigger value="planificacion" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Planificación
            </TabsTrigger>
          </TabsList>

          <TabsContent value="informacion" className="space-y-6 mt-0">
            {/* Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Ocupación */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Ocupación
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold">{group.currentEnrollment}</span>
                      <span className="text-sm text-muted-foreground">/ {group.maxCapacity} plazas</span>
                    </div>
                    <Progress
                      value={group.currentEnrollment}
                      max={group.maxCapacity}
                      className="h-2"
                      indicatorClassName={occupancyColor}
                    />
                    <p className="text-xs text-muted-foreground">
                      {group.maxCapacity - group.currentEnrollment > 0
                        ? `${group.maxCapacity - group.currentEnrollment} plaza${group.maxCapacity - group.currentEnrollment !== 1 ? 's' : ''} disponible${group.maxCapacity - group.currentEnrollment !== 1 ? 's' : ''}`
                        : 'Grupo completo'
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Entrenador */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Entrenador
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">{group.coachName}</p>
                  <StatusBadge status={group.level} className="mt-1" />
                </CardContent>
              </Card>

              {/* Pista */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Pista
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">{group.courtName}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {group.isActive ? 'Grupo activo' : 'Grupo inactivo'}
                  </p>
                </CardContent>
              </Card>

              {/* Tarifa */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Tarifa
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 relative -top-1" 
                      onClick={() => { setNewTariffId(group.defaultTariffId); setShowEditTariff(true) }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatCurrency(group.defaultTariffPrice)}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {defaultTariff ? defaultTariff.name : 'Tarifa por defecto'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Schedule Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Horario
                </CardTitle>
              </CardHeader>
              <CardContent>
                {group.schedule.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin horario definido</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {group.schedule.map((slot, index) => (
                      <Badge key={index} variant="secondary" className="text-sm py-1 px-3">
                        <Calendar className="h-3.5 w-3.5 mr-1.5" />
                        {getDayLabel(slot.dayOfWeek)} {slot.startTime} - {slot.endTime}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
                  <span>Inicio: {formatDate(new Date(group.startDate))}</span>
                  <span>Fin: {formatDate(new Date(group.endDate))}</span>
                </div>
              </CardContent>
            </Card>

            {/* Enrolled Players Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Jugadores inscritos ({groupEnrollments.length})
                </CardTitle>
                <Button size="sm" onClick={() => { resetAddForm(); setShowAddPlayer(true) }}>
                  <UserPlus className="h-4 w-4 mr-1" />
                  Añadir
                </Button>
              </CardHeader>
              <CardContent>
                {groupEnrollments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-3">
                    <Users className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No hay jugadores inscritos en este grupo</p>
                    <Button variant="outline" size="sm" onClick={() => { resetAddForm(); setShowAddPlayer(true) }}>
                      <UserPlus className="h-4 w-4 mr-1" />
                      Añadir jugador
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">Jugador</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Tarifa</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">Frecuencia</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden sm:table-cell">Precio</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">Fecha inscripción</th>
                          <th className="p-3 text-right text-sm font-medium text-muted-foreground w-20">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupEnrollments.map((enrollment) => {
                          const player = players.find((p) => p.id === enrollment.playerId)
                          const price = enrollment.customPrice ?? group.defaultTariffPrice
                          return (
                            <tr
                              key={enrollment.id}
                              className="border-b hover:bg-muted/30 transition-colors"
                            >
                              <td className="p-3">
                                <button
                                  className="flex items-center gap-3 text-left hover:underline"
                                  onClick={() => navigate(`/jugadores/${enrollment.playerId}`)}
                                >
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                                    {enrollment.playerName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">{enrollment.playerName}</p>
                                    {player && (
                                      <StatusBadge status={player.status} className="mt-0.5" />
                                    )}
                                  </div>
                                </button>
                              </td>
                              <td className="p-3 hidden md:table-cell">
                                <span className="text-sm">{enrollment.tariffName}</span>
                              </td>
                              <td className="p-3 hidden lg:table-cell">
                                <span className="text-sm text-muted-foreground">
                                  {billingFrequencyLabel(enrollment.billingFrequency ?? group.billingFrequency)}
                                </span>
                              </td>
                              <td className="p-3 hidden sm:table-cell">
                                <span className="text-sm font-medium">
                                  {formatCurrency(price)}
                                </span>
                                {enrollment.customPrice !== undefined && (
                                  <span className="ml-1.5 text-xs text-muted-foreground">(personalizado)</span>
                                )}
                              </td>
                              <td className="p-3 hidden lg:table-cell">
                                <span className="text-sm text-muted-foreground">
                                  {formatDate(new Date(enrollment.enrollmentDate))}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-foreground"
                                    onClick={() => setMoveEnrollmentId(enrollment.id)}
                                    title="Mover a otro grupo"
                                  >
                                    <ArrowRightLeft className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setRemoveEnrollmentId(enrollment.id)}
                                  >
                                    <UserMinus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Waitlist Section */}
            {(waitlistEntries.length > 0 || isFull) && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Lista de espera ({waitlistEntries.length})
                  </CardTitle>
                  {hasFreeSpot && waitlistEntries.length > 0 && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-none">
                      Plaza libre disponible
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  {waitlistEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      El grupo está completo. Los alumnos que añadas entrarán en lista de espera.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {waitlistEntries.map((entry, idx) => {
                        const canPromote = hasFreeSpot && idx === 0
                        return (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                          >
                            <button
                              className="flex items-center gap-3 text-left min-w-0"
                              onClick={() => navigate(`/jugadores/${entry.playerId}`)}
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold shrink-0">
                                {entry.waitlistPosition ?? idx + 1}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate hover:underline">{entry.playerName}</p>
                                <p className="text-xs text-muted-foreground truncate">{entry.tariffName}</p>
                              </div>
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant={canPromote ? 'default' : 'outline'}
                                disabled={!hasFreeSpot}
                                onClick={() => handlePromoteWaitlist(entry.id)}
                                title={hasFreeSpot ? 'Promover a matrícula activa' : 'No hay plazas libres'}
                              >
                                <UserPlus className="h-4 w-4 mr-1" />
                                Promover
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => removeFromWaitlist(entry.id)}
                                title="Quitar de la lista de espera"
                              >
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="planificacion" className="mt-0">
            <GroupTrainingPlanTab groupId={group.id} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Player Dialog */}
      <Dialog open={showAddPlayer} onOpenChange={setShowAddPlayer}>
        <DialogContent className="max-w-lg sm:max-w-lg md:max-w-xl">
          <DialogHeader>
            <DialogTitle>{isFull ? 'Añadir a lista de espera' : 'Añadir jugador al grupo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {isFull && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
                <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                <span>El grupo está completo ({group.currentEnrollment}/{group.maxCapacity}). El alumno entrará en la lista de espera y podrás promoverlo cuando se libere una plaza.</span>
              </div>
            )}
            {/* Select Player */}
            <div className="space-y-2">
              <Label htmlFor="player">Jugador *</Label>
              {availablePlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No hay jugadores activos disponibles para inscribir en este grupo.
                </p>
              ) : (
                <SearchableSelect
                  options={availablePlayers.map((p) => ({
                    value: p.id,
                    label: `${p.lastName}, ${p.firstName}${p.dni ? ` - ${p.dni}` : ''}`,
                  }))}
                  value={selectedPlayerId}
                  onChange={setSelectedPlayerId}
                  placeholder="Seleccionar jugador..."
                  searchPlaceholder="Buscar por nombre, apellido o DNI..."
                  emptyMessage="No se encontraron jugadores"
                />
              )}
            </div>

            {/* Select Tariff */}
            <div className="space-y-2">
              <Label>Tarifa *</Label>
              <Select
                options={tariffs.filter((t) => t.isActive).map((t) => ({
                  value: t.id,
                  label: `${t.name} (${formatCurrency(t.price)})`,
                }))}
                placeholder="Seleccionar tarifa"
                value={selectedTariffId}
                onChange={(e) => {
                  const tariffId = e.target.value
                  setSelectedTariffId(tariffId)
                  const tariff = tariffs.find(t => t.id === tariffId)
                  if (tariff) {
                    setSelectedBillingFrequency(tariff.billingFrequency)
                  }
                }}
              />
            </div>

            {/* Discount mode */}
            {selectedTariffId && (
              <div className="space-y-3">
                <Label>Precio</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="discountMode"
                      checked={discountMode === 'none'}
                      onChange={() => setDiscountMode('none')}
                      className="accent-primary"
                    />
                    Precio tarifa ({formatCurrency(periodBasePrice)})
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="discountMode"
                      checked={discountMode === 'percentage'}
                      onChange={() => setDiscountMode('percentage')}
                      className="accent-primary"
                    />
                    Descuento %
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="discountMode"
                      checked={discountMode === 'fixed_price'}
                      onChange={() => setDiscountMode('fixed_price')}
                      className="accent-primary"
                    />
                    Precio especial
                  </label>
                </div>

                {discountMode === 'percentage' && (
                  <div className="space-y-1">
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      max="100"
                      placeholder="Porcentaje de descuento"
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(e.target.value)}
                    />
                  </div>
                )}

                {discountMode === 'fixed_price' && (
                  <div className="space-y-1">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Precio especial"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                    />
                  </div>
                )}

                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  <span className="text-muted-foreground">Precio final: </span>
                  <span className="font-semibold">{formatCurrency(computedFinalPrice)}</span>
                  {discountMode === 'percentage' && discountPercentage && (
                    <span className="text-muted-foreground ml-1">
                      (-{discountPercentage}%)
                    </span>
                  )}
                </div>
                {(selectedBillingFrequency === 'quarterly' || selectedBillingFrequency === 'annual') && (
                  <p className="text-xs text-muted-foreground">
                    Se cobrará {formatCurrency(periodBasePrice)} por {billingFrequencyLabel(selectedBillingFrequency).toLowerCase()}
                    {' '}({cycleLength(selectedBillingFrequency)} × {formatCurrency(selectedTariffPrice)})
                  </p>
                )}
              </div>
            )}

            {/* Billing frequency */}
            <div className="space-y-2">
              <Label>Frecuencia de facturación</Label>
              <Select
                options={BILLING_FREQUENCIES.map((f) => ({ value: f.value, label: f.label }))}
                value={selectedBillingFrequency}
                onChange={(e) => setSelectedBillingFrequency(e.target.value as BillingFrequency)}
              />
            </div>

            {/* Anchor month — only for quarterly or annual */}
            {(selectedBillingFrequency === 'quarterly' || selectedBillingFrequency === 'annual') && (
              <div className="space-y-2">
                <Label>
                  {selectedBillingFrequency === 'quarterly'
                    ? 'Mes de inicio del ciclo trimestral'
                    : 'Mes de pago anual'}
                </Label>
                <Select
                  options={MONTHS.map((m) => ({ value: String(m.value), label: m.label }))}
                  value={String(selectedAnchorMonth)}
                  onChange={(e) => setSelectedAnchorMonth(Number(e.target.value))}
                />
                {selectedBillingFrequency === 'quarterly' && (
                  <p className="text-xs text-muted-foreground">
                    Los pagos se generarán en {
                      [0, 3, 6, 9]
                        .map(offset => MONTHS.find(m => m.value === ((selectedAnchorMonth - 1 + offset) % 12) + 1)?.label)
                        .join(', ')
                    }
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddPlayer(false); resetAddForm() }}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddPlayer}
              disabled={!selectedPlayerId || !selectedTariffId || availablePlayers.length === 0}
            >
              {isFull ? (
                <><Clock className="h-4 w-4 mr-1" /> Añadir a lista de espera</>
              ) : (
                <><UserPlus className="h-4 w-4 mr-1" /> Inscribir</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Player Confirm Dialog */}
      <Dialog open={!!removeEnrollmentId} onOpenChange={(open) => !open && setRemoveEnrollmentId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar inscripción</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              El jugador será dado de baja de este grupo. Esta acción desactivará su inscripción y liberará una plaza.
            </p>
            <div className="space-y-2">
              <Label>Fecha efectiva de la baja</Label>
              <Input
                type="date"
                value={unenrollmentDate}
                onChange={(e) => setUnenrollmentDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se comprobará si existen recibos pendientes para este mes.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveEnrollmentId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRemovePlayer}>
              Eliminar del grupo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Action Dialog for Unenrollment */}
      <Dialog open={!!invoiceActionData} onOpenChange={(open) => !open && setInvoiceActionData(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recibo pendiente encontrado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-foreground">
              Existe un recibo pendiente de pago para el mes actual asociado a esta inscripción.
            </p>
            <p className="text-sm text-muted-foreground">
              ¿Qué deseas hacer con este recibo pendiente?
            </p>
          </div>
          <DialogFooter className="flex-col sm:justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => confirmRemoveEnrollment(true)}>
              Eliminar el recibo
            </Button>
            <Button onClick={() => confirmRemoveEnrollment(false)}>
              Mantener el recibo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Partial Receipt Dialog */}
      <Dialog open={!!partialReceiptData} onOpenChange={(open) => !open && setPartialReceiptData(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generar recibo parcial</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Los recibos de este mes ya han sido generados para este grupo. ¿Deseas generar un recibo parcial para esta nueva inscripción?
            </p>
            <div className="space-y-2">
              <Label>Importe del recibo (€)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={partialReceiptData?.amount || ''}
                onChange={(e) => setPartialReceiptData(prev => prev ? { ...prev, amount: e.target.value } : null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartialReceiptData(null)}>
              Omitir
            </Button>
            <Button onClick={handleGeneratePartialReceipt} disabled={!partialReceiptData?.amount}>
              Generar recibo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tariff Dialog */}
      <Dialog open={showEditTariff} onOpenChange={setShowEditTariff}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar tarifa del grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Actualizar la tarifa cambiará el precio asignado por defecto a las nuevas inscripciones. Las inscripciones actuales que tengan un precio modificado a mano no se alterarán.
            </p>
            <div className="space-y-2">
              <Label>Seleccionar nueva tarifa</Label>
              <Select
                options={[
                  { value: '', label: 'Seleccionar una tarifa...' },
                  ...activeTariffs.map((t) => ({
                    value: t.id,
                    label: t.billingFrequency === 'monthly'
                      ? `${t.name} - ${t.price.toFixed(2)} €/mes`
                      : `${t.name} - ${t.price.toFixed(2)} € total`,
                  })),
                ]}
                value={newTariffId}
                onChange={(e) => setNewTariffId(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditTariff(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateTariff} disabled={!newTariffId || newTariffId === group.defaultTariffId}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move enrollment dialog */}
      {moveEnrollmentId && (
        <MoveEnrollmentDialog
          enrollmentId={moveEnrollmentId}
          currentGroupId={group.id}
          onClose={() => setMoveEnrollmentId(null)}
        />
      )}
    </div>
  )
}
