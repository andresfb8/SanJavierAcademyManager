import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select as CustomSelect } from '@/components/ui/select'
import { useAuthStore } from '@/stores/authStore'
import { MethodologyParameter, TrainingTemplate, TrainingWeek, TrainingSession, ParameterWeight, ParameterCategory } from '@/types/methodology'
import { getParameters } from '@/lib/methodology-service'
import { createTrainingTemplate } from '@/lib/planning-service'
import { ParameterWeightControl } from '../methodology/ParameterWeightControl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Trash2, Save, Search, Settings } from 'lucide-react'

interface PlanningBuilderProps {
    onBack: () => void;
    onSaved: () => void;
}

export const PlanningBuilder: React.FC<PlanningBuilderProps> = ({ onBack, onSaved }) => {
    const { user } = useAuthStore()
    const [loading, setLoading] = useState(false)

    // Template Meta
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [weeksCount, setWeeksCount] = useState(4)
    const [daysPerWeek, setDaysPerWeek] = useState(2)

    // Matrix State
    const [weeks, setWeeks] = useState<TrainingWeek[]>([])

    // Catalog State
    const [catalog, setCatalog] = useState<MethodologyParameter[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<ParameterCategory | 'all'>('all')

    // Add Parameter Modal State
    const [activeSession, setActiveSession] = useState<{ weekIndex: number, dayIndex: number } | null>(null)

    useEffect(() => {
        const fetchCatalog = async () => {
            try {
                const params = await getParameters()
                setCatalog(params)
            } catch (err) {
                console.error(err)
            }
        }
        fetchCatalog()
    }, [])

    // Regenerate grid when dimensions change
    useEffect(() => {
        // Preserve existing data where possible
        const newWeeks: TrainingWeek[] = []

        for (let w = 0; w < weeksCount; w++) {
            const existingWeek = weeks[w]
            const sessions: TrainingSession[] = []

            for (let d = 0; d < daysPerWeek; d++) {
                const existingSession = existingWeek?.sessions[d]
                sessions.push(existingSession || {
                    dayNumber: d + 1,
                    parameters: []
                })
            }

            newWeeks.push({
                weekNumber: w + 1,
                focus: existingWeek?.focus || '',
                sessions
            })
        }
        setWeeks(newWeeks)
        // Only depend on dimensions, not on `weeks` itself to avoid infinite loops when we edit parameters
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weeksCount, daysPerWeek])

    const handleSave = async () => {
        if (!user?.id || !name.trim()) return

        try {
            setLoading(true)
            await createTrainingTemplate({
                name,
                description,
                weeksCount,
                daysPerWeek,
                level: 'iniciacion', // MVP default, could be added to meta
                weeks,
                createdBy: user.id,
                isGlobal: true
            })
            onSaved()
        } catch (err) {
            console.error(err)
            alert("Error al guardar la plantilla")
        } finally {
            setLoading(false)
        }
    }

    const handleAddParameter = (paramId: string) => {
        if (!activeSession) return

        const { weekIndex, dayIndex } = activeSession
        const newWeeks = [...weeks]
        const session = newWeeks[weekIndex].sessions[dayIndex]

        if (!session.parameters.some(p => p.parameterId === paramId)) {
            session.parameters.push({ parameterId: paramId, weight: 1 })
            setWeeks(newWeeks)
        }

        // We don't auto-close so they can add multiple
    }

    const handleRemoveParameter = (weekIndex: number, dayIndex: number, paramId: string) => {
        const newWeeks = [...weeks]
        const session = newWeeks[weekIndex].sessions[dayIndex]
        session.parameters = session.parameters.filter(p => p.parameterId !== paramId)
        setWeeks(newWeeks)
    }

    const handleWeightChange = (weekIndex: number, dayIndex: number, paramId: string, newWeight: number) => {
        const newWeeks = [...weeks]
        const session = newWeeks[weekIndex].sessions[dayIndex]
        const param = session.parameters.find(p => p.parameterId === paramId)
        if (param) {
            param.weight = newWeight
            setWeeks(newWeeks)
        }
    }

    const getParamDetails = (paramId: string) => catalog.find(p => p.id === paramId)

    const filteredCatalog = catalog.filter(param => {
        const inCategory = selectedCategory === 'all' || param.category === selectedCategory;
        const matchesSearch = param.name.toLowerCase().includes(searchTerm.toLowerCase())
        return inCategory && matchesSearch;
    });

    return (
        <div className="flex flex-col h-[calc(100vh-10rem)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

            {/* Top Bar Config */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-4 items-end shrink-0">
                <div className="flex-1 min-w-[200px]">
                    <Label htmlFor="plan-name">Nombre de la Plantilla *</Label>
                    <Input
                        id="plan-name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ej: Pretemporada Avanzados"
                    />
                </div>

                <div className="w-24">
                    <Label htmlFor="plan-weeks">Semanas</Label>
                    <Input
                        id="plan-weeks"
                        type="number"
                        min={1} max={52}
                        value={weeksCount}
                        onChange={e => setWeeksCount(parseInt(e.target.value) || 1)}
                    />
                </div>

                <div className="w-32">
                    <Label htmlFor="plan-days">Días / Semana</Label>
                    <Input
                        id="plan-days"
                        type="number"
                        min={1} max={7}
                        value={daysPerWeek}
                        onChange={e => setDaysPerWeek(parseInt(e.target.value) || 1)}
                    />
                </div>

                <Button
                    onClick={handleSave}
                    disabled={!name.trim() || loading}
                    className="ml-auto"
                >
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Plantilla
                </Button>
            </div>

            {/* Matrix Builder */}
            <div className="flex-1 overflow-x-auto overflow-y-auto p-4 bg-gray-100/50">
                <div className="min-w-max space-y-6">
                    {weeks.map((week, wIndex) => (
                        <div key={`w-${wIndex}`} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center gap-4 mb-4 pb-2 border-b border-gray-100">
                                <h3 className="font-semibold text-gray-800 text-lg">Semana {week.weekNumber}</h3>
                                <Input
                                    placeholder="Objetivo de la semana (opcional)..."
                                    className="max-w-md h-8 text-sm"
                                    value={week.focus || ''}
                                    onChange={e => {
                                        const newWeeks = [...weeks];
                                        newWeeks[wIndex].focus = e.target.value;
                                        setWeeks(newWeeks);
                                    }}
                                />
                            </div>

                            <div className="flex gap-4">
                                {week.sessions.map((session, dIndex) => (
                                    <div key={`w${wIndex}-d${dIndex}`} className="flex-1 min-w-[300px] border border-gray-200 rounded-md bg-gray-50 flex flex-col">
                                        <div className="p-2 bg-gray-200/50 border-b border-gray-200 flex justify-between items-center rounded-t-md">
                                            <span className="font-medium text-sm text-gray-700">Día {session.dayNumber}</span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 hover:bg-white"
                                                onClick={() => setActiveSession({ weekIndex: wIndex, dayIndex: dIndex })}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="p-3 flex-1 flex flex-col gap-2 min-h-[120px]">
                                            {session.parameters.length === 0 ? (
                                                <div className="flex-1 flex items-center justify-center text-xs text-gray-400 text-center px-4">
                                                    Click en + para añadir conceptos a este día
                                                </div>
                                            ) : (
                                                session.parameters.map(param => {
                                                    const details = getParamDetails(param.parameterId)
                                                    if (!details) return null

                                                    return (
                                                        <div key={param.parameterId} className="bg-white p-2 border border-gray-200 rounded shadow-sm flex flex-col gap-2 relative group">
                                                            <div className="flex justify-between items-start gap-2">
                                                                <p className="text-xs font-semibold text-gray-800 leading-tight pr-6">{details.name}</p>
                                                                <button
                                                                    onClick={() => handleRemoveParameter(wIndex, dIndex, param.parameterId)}
                                                                    className="absolute top-1 right-1 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded capitalize">
                                                                    {details.category}
                                                                </span>
                                                                <ParameterWeightControl
                                                                    value={param.weight}
                                                                    onChange={v => handleWeightChange(wIndex, dIndex, param.parameterId, v)}
                                                                />
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Catalog Modal */}
            <Dialog open={activeSession !== null} onOpenChange={(open) => !open && setActiveSession(null)}>
                <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0">
                    <DialogHeader className="p-4 border-b border-gray-200 shrink-0">
                        <DialogTitle>Catálogo de Conceptos</DialogTitle>
                        <p className="text-sm text-gray-500">Añadiendo a Semana {activeSession?.weekIndex !== undefined ? activeSession.weekIndex + 1 : ''} - Día {activeSession?.dayIndex !== undefined ? activeSession.dayIndex + 1 : ''}</p>
                    </DialogHeader>

                    <div className="p-4 border-b border-gray-100 shrink-0 flex gap-4 bg-gray-50">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Buscar concepto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-blue-500 shadow-sm"
                            />
                        </div>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value as ParameterCategory | 'all')}
                            className="bg-white text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 w-48"
                        >
                            <option value="all">Todas las Categorías</option>
                            <option value="tecnica">Técnica</option>
                            <option value="tactica">Táctica</option>
                            <option value="fisica">Física</option>
                            <option value="mental">Mental</option>
                            <option value="conducta">Conducta</option>
                        </select>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredCatalog.map(param => {
                                const isAlreadyInSession = activeSession &&
                                    weeks[activeSession.weekIndex] &&
                                    weeks[activeSession.weekIndex].sessions[activeSession.dayIndex] &&
                                    weeks[activeSession.weekIndex].sessions[activeSession.dayIndex].parameters.some(p => p.parameterId === param.id);

                                return (
                                    <div key={param.id} className={`bg-white p-3 rounded-md border shadow-sm transition-all flex flex-col justify-between h-full ${isAlreadyInSession ? 'border-gray-200 opacity-60' : 'border-gray-200 hover:border-blue-400'}`}>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800 leading-tight mb-1">{param.name}</p>
                                            <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded capitalize">
                                                {param.category}
                                            </span>
                                        </div>

                                        <Button
                                            variant={isAlreadyInSession ? "secondary" : "default"}
                                            size="sm"
                                            className="mt-3 w-full h-7 text-xs"
                                            disabled={!!isAlreadyInSession}
                                            onClick={() => handleAddParameter(param.id)}
                                        >
                                            {isAlreadyInSession ? 'Añadido' : 'Añadir al Día'}
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
