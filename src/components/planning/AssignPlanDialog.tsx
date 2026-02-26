import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Search } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { TrainingTemplate } from '@/types/methodology'
import { assignTemplateToGroups } from '@/lib/planning-service'
import { StatusBadge } from '../shared/StatusBadge'

interface AssignPlanDialogProps {
    template: TrainingTemplate | null
    isOpen: boolean
    onClose: () => void
}

export const AssignPlanDialog: React.FC<AssignPlanDialogProps> = ({ template, isOpen, onClose }) => {
    const { user } = useAuthStore()
    const { groups } = useDataStore()

    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Reset state when opened with a new template
    useEffect(() => {
        if (isOpen) {
            setSelectedGroupIds([])
            setSearchTerm('')
            setStartDate(new Date().toISOString().split('T')[0])
            setError(null)
        }
    }, [isOpen, template])

    if (!template) return null

    const activeGroups = groups.filter(g => g.isActive)

    const filteredGroups = activeGroups.filter(g =>
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.coachName.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const toggleGroup = (groupId: string) => {
        setSelectedGroupIds(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        )
    }

    const toggleAll = () => {
        if (selectedGroupIds.length === filteredGroups.length) {
            setSelectedGroupIds([])
        } else {
            setSelectedGroupIds(filteredGroups.map(g => g.id))
        }
    }

    const handleAssign = async () => {
        if (!user?.id || selectedGroupIds.length === 0) return

        try {
            setLoading(true)
            setError(null)
            const date = new Date(startDate)

            await assignTemplateToGroups(template.id, selectedGroupIds, user.id, date)

            onClose()
        } catch (err) {
            console.error(err)
            setError("Ocurrió un error al intentar asignar la planificación.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2 shrink-0 border-b border-gray-100">
                    <DialogTitle>Asignar Plantilla a Grupos</DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Plantilla: <span className="font-semibold text-gray-900">{template.name}</span> ({template.weeksCount} semanas, {template.daysPerWeek} días/sem)
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-3">
                        <Label htmlFor="start-date" className="text-base">Fecha de Inicio de la Planificación</Label>
                        <p className="text-sm text-gray-500">
                            A partir de esta fecha, el sistema adaptará la Semana 1 a los días de entrenamiento reales de cada grupo.
                        </p>
                        <Input
                            id="start-date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="max-w-md"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-end">
                            <Label className="text-base">Seleccionar Grupos ({selectedGroupIds.length} seleccionados)</Label>
                            <Button variant="ghost" size="sm" onClick={toggleAll} className="h-8 text-xs text-blue-600">
                                {selectedGroupIds.length === filteredGroups.length ? 'Desmarcar todos' : 'Marcar todos'}
                            </Button>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar grupo por nombre o entrenador..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        <div className="border border-gray-200 rounded-md max-h-[300px] overflow-y-auto divide-y divide-gray-100">
                            {filteredGroups.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 text-sm">No se encontraron grupos activos.</div>
                            ) : (
                                filteredGroups.map(group => (
                                    <label key={group.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors">
                                        <Checkbox
                                            checked={selectedGroupIds.includes(group.id)}
                                            onCheckedChange={() => toggleGroup(group.id)}
                                        />
                                        <div className="flex-1 flex justify-between items-center min-w-0">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 truncate">{group.name}</p>
                                                <p className="text-xs text-gray-500 truncate">Coach: {group.coachName}</p>
                                            </div>
                                            <StatusBadge status={group.level} className="scale-90" />
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-4 border-t border-gray-100 shrink-0 bg-gray-50 gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleAssign}
                        disabled={selectedGroupIds.length === 0 || !startDate || loading}
                    >
                        {loading ? 'Asignando...' : `Asignar a ${selectedGroupIds.length} grupo${selectedGroupIds.length !== 1 ? 's' : ''}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
