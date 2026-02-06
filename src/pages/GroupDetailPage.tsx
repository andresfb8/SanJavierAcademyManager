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
import { useDataStore } from '@/stores/dataStore'
import { ArrowLeft, Users, Clock, MapPin, User, CreditCard, UserPlus, UserMinus, Calendar } from 'lucide-react'
import { formatDate, formatCurrency, generateId } from '@/lib/utils'
import { DAYS_OF_WEEK } from '@/constants'

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { groups, players, enrollments, tariffs, addEnrollment, deactivateEnrollment } = useDataStore()

  // Dialog state
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [removeEnrollmentId, setRemoveEnrollmentId] = useState<string | null>(null)

  // Add player form state
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [selectedTariffId, setSelectedTariffId] = useState('')
  const [customPrice, setCustomPrice] = useState('')

  // Find the group
  const group = useMemo(() => groups.find((g) => g.id === id), [groups, id])

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

  const availablePlayers = useMemo(
    () => players.filter((p) => p.status === 'activo' && !enrolledPlayerIds.has(p.id)),
    [players, enrolledPlayerIds]
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
  }

  // Handle adding a player to the group
  const handleAddPlayer = () => {
    if (!group || !selectedPlayerId || !selectedTariffId) return

    const player = players.find((p) => p.id === selectedPlayerId)
    const tariff = tariffs.find((t) => t.id === selectedTariffId)
    if (!player || !tariff) return

    const parsedCustomPrice = customPrice.trim() !== '' ? parseFloat(customPrice) : undefined

    addEnrollment({
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      groupId: group.id,
      groupName: group.name,
      tariffId: tariff.id,
      tariffName: tariff.name,
      customPrice: parsedCustomPrice,
      enrollmentDate: new Date(),
      isActive: true,
    })

    setShowAddPlayer(false)
    resetAddForm()
  }

  // Handle removing a player (deactivate enrollment)
  const handleRemovePlayer = () => {
    if (removeEnrollmentId) {
      deactivateEnrollment(removeEnrollmentId)
      setRemoveEnrollmentId(null)
    }
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
            <Button size="sm" onClick={() => { resetAddForm(); setShowAddPlayer(true) }}>
              <UserPlus className="h-4 w-4 mr-1" />
              Añadir jugador
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
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
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Tarifa
              </CardTitle>
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
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setRemoveEnrollmentId(enrollment.id)}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
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
      </div>

      {/* Add Player Dialog */}
      <Dialog open={showAddPlayer} onOpenChange={setShowAddPlayer}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir jugador al grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Select Player */}
            <div className="space-y-2">
              <Label>Jugador *</Label>
              {availablePlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No hay jugadores activos disponibles para inscribir en este grupo.
                </p>
              ) : (
                <Select
                  options={availablePlayers.map((p) => ({
                    value: p.id,
                    label: `${p.firstName} ${p.lastName}`,
                  }))}
                  placeholder="Seleccionar jugador"
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
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
                onChange={(e) => setSelectedTariffId(e.target.value)}
              />
            </div>

            {/* Custom Price */}
            <div className="space-y-2">
              <Label>Precio personalizado (opcional)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Dejar vacío para usar precio de tarifa"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
              />
              {selectedTariffId && (
                <p className="text-xs text-muted-foreground">
                  Precio de tarifa: {formatCurrency(tariffs.find((t) => t.id === selectedTariffId)?.price ?? 0)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddPlayer(false); resetAddForm() }}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddPlayer}
              disabled={!selectedPlayerId || !selectedTariffId || availablePlayers.length === 0}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Inscribir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Player Confirm Dialog */}
      <ConfirmDialog
        open={!!removeEnrollmentId}
        onOpenChange={() => setRemoveEnrollmentId(null)}
        title="Eliminar inscripción"
        description="El jugador será eliminado de este grupo. Esta acción desactivará su inscripción y liberará una plaza."
        variant="destructive"
        confirmLabel="Eliminar del grupo"
        onConfirm={handleRemovePlayer}
      />
    </div>
  )
}
