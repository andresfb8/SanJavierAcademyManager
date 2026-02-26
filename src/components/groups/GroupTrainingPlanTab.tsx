import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { MethodologyParameter, TrainingPlan, ParameterWeight, ParameterCategory, ParameterLevel } from '@/types/methodology';
import { getParameters } from '@/lib/methodology-service';
import { getLatestTrainingPlanForGroup, createTrainingPlan, updateTrainingPlan } from '@/lib/training-plan-service';
import { ParameterWeightControl } from '../methodology/ParameterWeightControl';
import { Search, Info, Plus, Trash2, Youtube, FileText, Video, Save } from 'lucide-react';

interface GroupTrainingPlanTabProps {
    groupId: string;
}

export const GroupTrainingPlanTab: React.FC<GroupTrainingPlanTabProps> = ({ groupId }) => {
    const { user } = useAuthStore();

    // Catalog state
    const [catalog, setCatalog] = useState<MethodologyParameter[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<ParameterCategory | 'all'>('all');

    // Plan state
    const [currentPlan, setCurrentPlan] = useState<TrainingPlan | null>(null);
    const [planParams, setPlanParams] = useState<ParameterWeight[]>([]);
    const [isDirty, setIsDirty] = useState(false);

    // UI state
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);
                // Load global catalog
                const params = await getParameters();
                setCatalog(params);

                // Load group plan if any
                const plan = await getLatestTrainingPlanForGroup(groupId);
                setCurrentPlan(plan);
                if (plan?.parameters) {
                    setPlanParams(plan.parameters);
                } else {
                    setPlanParams([]);
                }
            } catch (err: any) {
                console.error("Failed to load training plan data:", err);
                setError("Error al cargar los datos de planificación.");
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [groupId]);

    const filteredCatalog = catalog.filter(param => {
        const inCategory = selectedCategory === 'all' || param.category === selectedCategory;
        const matchesSearch = param.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            param.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

        // Filter out params that are already in the plan
        const alreadyInPlan = planParams.some(pw => pw.parameterId === param.id);

        return inCategory && matchesSearch && !alreadyInPlan;
    });

    const getParamDetails = (paramId: string) => {
        return catalog.find(p => p.id === paramId);
    };

    const handleAddParameter = (paramId: string) => {
        setPlanParams(prev => [...prev, { parameterId: paramId, weight: 1 }]);
        setIsDirty(true);
        setSaveSuccess(false);
    };

    const handleRemoveParameter = (paramId: string) => {
        setPlanParams(prev => prev.filter(p => p.parameterId !== paramId));
        setIsDirty(true);
        setSaveSuccess(false);
    };

    const handleWeightChange = (paramId: string, newWeight: number) => {
        setPlanParams(prev => prev.map(p =>
            p.parameterId === paramId ? { ...p, weight: newWeight } : p
        ));
        setIsDirty(true);
        setSaveSuccess(false);
    };

    const handleSavePlan = async () => {
        if (!user?.id) return;

        try {
            setSaving(true);
            setError(null);

            if (currentPlan) {
                // Update existing
                await updateTrainingPlan(currentPlan.id, {
                    parameters: planParams
                });
            } else {
                // Create new
                const date = new Date();
                const newPlanId = await createTrainingPlan({
                    name: `Plan Trimestral`,
                    groupId,
                    coachId: user.id,
                    startDate: date,
                    endDate: date, // Dummy end date for MVP
                    parameters: planParams
                });

                // Refresh to get the generic plan data
                const freshPlan = await getLatestTrainingPlanForGroup(groupId);
                setCurrentPlan(freshPlan);
            }

            setIsDirty(false);
            setSaveSuccess(true);

            setTimeout(() => setSaveSuccess(false), 3000);

        } catch (err: any) {
            console.error("Save plan failed:", err);
            setError("No se pudo guardar el plan de entrenamiento.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500 animate-pulse">Cargando datos del plan...</div>;
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-14rem)]">

            {/* Left Column: Global Catalog */}
            <div className="w-full lg:w-1/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 shrink-0">
                    <h3 className="font-semibold text-gray-900 mb-3">Catálogo de Conceptos</h3>

                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar parámetro..."
                                className="w-full pl-9 pr-3 py-2 text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value as ParameterCategory | 'all')}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">Todas las Categorías</option>
                            <option value="tecnica">Técnica</option>
                            <option value="tactica">Táctica</option>
                            <option value="fisica">Física</option>
                            <option value="mental">Mental</option>
                            <option value="conducta">Conducta</option>
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                    {filteredCatalog.length === 0 ? (
                        <p className="text-center text-sm text-gray-500 mt-8">No hay conceptos disponibles o todos ya están en el plan.</p>
                    ) : (
                        <div className="space-y-2">
                            {filteredCatalog.map(param => (
                                <div key={param.id} className="flex justify-between items-center bg-white p-3 rounded-md border border-gray-100 shadow-sm hover:border-blue-300 transition-colors group">
                                    <div className="min-w-0 pr-2">
                                        <p className="text-sm font-medium text-gray-900 truncate" title={param.name}>{param.name}</p>
                                        <p className="text-xs text-gray-500 capitalize">{param.category}</p>
                                    </div>
                                    <button
                                        onClick={() => handleAddParameter(param.id)}
                                        className="p-1.5 shrink-0 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 hover:text-blue-700 transition-colors"
                                        title="Añadir al plan"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Group Plan */}
            <div className="w-full lg:w-2/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-semibold text-gray-900">Plan de Entrenamiento Actual</h3>
                        <p className="text-xs text-gray-500">Asigna conceptos y su prioridad de trabajo (pelotitas).</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {saveSuccess && (
                            <span className="text-sm font-medium text-green-600 animate-fade-in-out">
                                Guardado ✓
                            </span>
                        )}
                        <button
                            onClick={handleSavePlan}
                            disabled={!isDirty || saving}
                            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm transition-colors ${!isDirty ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                        >
                            <Save className={`w-4 h-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
                            {saving ? 'Guardando...' : 'Guardar Plan'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="m-4 p-3 bg-red-50 text-red-800 text-sm rounded-md border border-red-200">
                        {error}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 bg-gray-50/20">
                    {planParams.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                            <Info className="w-12 h-12 text-gray-300" />
                            <p className="text-gray-500 max-w-sm">No hay conceptos asignados en este plan de entrenamiento.</p>
                            <p className="text-sm text-gray-400">Usa el buscador de la izquierda para añadir parámetros metodológicos.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {planParams.map((planParam) => {
                                const details = getParamDetails(planParam.parameterId);
                                if (!details) return null; // Defensive check, should not happen

                                return (
                                    <div key={planParam.parameterId} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-sm gap-4 group">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-medium text-gray-900 truncate">{details.name}</h4>

                                                {/* Media links if available */}
                                                {(details.videoUrl || details.documentUrl) && (
                                                    <div className="flex gap-1 ml-2">
                                                        {details.videoUrl && (
                                                            <a href={details.videoUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-red-500 transition-colors" title="Video">
                                                                {details.videoUrl.includes('youtube') || details.videoUrl.includes('youtu.be') ? <Youtube className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                                                            </a>
                                                        )}
                                                        {details.documentUrl && (
                                                            <a href={details.documentUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-500 transition-colors" title="Documento">
                                                                <FileText className="w-4 h-4" />
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 capitalize`}>
                                                    {details.category}
                                                </span>
                                                {details.level && (
                                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] bg-gray-50 text-gray-500 border border-gray-100`}>
                                                        {Array.isArray(details.level) ? details.level.slice(0, 2).join(', ') : details.level}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 shrink-0 sm:border-l sm:border-gray-100 sm:pl-4">
                                            <ParameterWeightControl
                                                value={planParam.weight}
                                                onChange={(val) => handleWeightChange(planParam.parameterId, val)}
                                            />

                                            <button
                                                onClick={() => handleRemoveParameter(planParam.parameterId)}
                                                className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
                                                title="Quitar del plan"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};
