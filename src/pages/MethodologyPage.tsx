import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { normalizeText } from '@/lib/utils';
import {
    MethodologyParameter,
    ParameterCategory,
    ParameterLevel
} from '../types/methodology';
import {
    getParameters,
    deleteParameter,
    duplicateParameter
} from '../lib/methodology-service';
import MethodologyFormDialog from '../components/methodology/MethodologyFormDialog';

// UI Icons (Lucide React) - Assuming these are available based on other pages
import {
    Plus,
    Search,
    Filter,
    Edit2,
    Trash2,
    Copy,
    Youtube,
    FileText,
    Video
} from 'lucide-react';

const MethodologyPage: React.FC = () => {
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'director' || user?.role === 'coordinador';

    const [parameters, setParameters] = useState<MethodologyParameter[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<ParameterCategory | 'all'>('all');
    const [selectedLevel, setSelectedLevel] = useState<ParameterLevel | 'all'>('all');

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingParameter, setEditingParameter] = useState<MethodologyParameter | null>(null);

    const fetchParameters = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getParameters({
                category: selectedCategory,
                // We handle level filtering locally for now due to array-contains complexity if mixed types
            });
            setParameters(data);
        } catch (err: any) {
            setError(err.message || 'Error al cargar los parámetros');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchParameters();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCategory]);

    const handleOpenDialog = (parameter?: MethodologyParameter) => {
        if (parameter) {
            setEditingParameter(parameter);
        } else {
            setEditingParameter(null);
        }
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setEditingParameter(null);
    };

    const handleSaveSuccess = () => {
        handleCloseDialog();
        fetchParameters();
    };

    const handleDelete = async (id: string, name: string) => {
        if (window.confirm(`¿Estás seguro de eliminar el parámetro "${name}"?\nEsta acción no se puede deshacer.`)) {
            try {
                await deleteParameter(id);
                fetchParameters();
            } catch (err: any) {
                alert(err.message || 'Error al eliminar');
            }
        }
    };

    const handleDuplicate = async (id: string) => {
        try {
            if (!user?.id) throw new Error("Usuario no autenticado");
            await duplicateParameter(id, user.id);
            fetchParameters();
        } catch (err: any) {
            alert(err.message || 'Error al duplicar');
        }
    };

    // Local filtering
    const filteredParameters = parameters.filter(param => {
        const q = normalizeText(searchTerm)
        const matchesSearch = normalizeText(param.name).includes(q) ||
            (param.tags && param.tags.some(t => normalizeText(t).includes(q)));

        let matchesLevel = true;
        if (selectedLevel !== 'all') {
            if (Array.isArray(param.level)) {
                matchesLevel = param.level.includes(selectedLevel) || param.level.includes('todos');
            } else {
                matchesLevel = param.level === selectedLevel || param.level === 'todos';
            }
        }

        return matchesSearch && matchesLevel;
    });

    const getCategoryColor = (category: ParameterCategory) => {
        switch (category) {
            case 'tecnica': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'tactica': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'fisica': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'mental': return 'bg-teal-100 text-teal-800 border-teal-200';
            case 'conducta': return 'bg-gray-100 text-gray-800 border-gray-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Metodología (Catálogo Global)</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Gestiona los conceptos técnicos, tácticos y físicos para los planes de entrenamiento.
                    </p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => handleOpenDialog()}
                        className="inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all active:scale-95"
                    >
                        <Plus className="h-5 w-5 mr-2" />
                        Nuevo Parámetro
                    </button>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6 mt-6">
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4">
                    <div className="relative flex-1 min-w-[200px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por nombre o etiqueta..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                        />
                    </div>

                    <div className="flex flex-wrap gap-4">
                        <div className="w-48">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value as ParameterCategory | 'all')}
                                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            >
                                <option value="all">Todas las Categorías</option>
                                <option value="tecnica">Técnica</option>
                                <option value="tactica">Táctica</option>
                                <option value="fisica">Física</option>
                                <option value="mental">Mental</option>
                                <option value="conducta">Conducta</option>
                            </select>
                        </div>

                        <div className="w-48">
                            <select
                                value={selectedLevel}
                                onChange={(e) => setSelectedLevel(e.target.value as ParameterLevel | 'all')}
                                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            >
                                <option value="all">Todos los Niveles</option>
                                <option value="todos">General (Todos)</option>
                                <option value="iniciacion">Iniciación</option>
                                <option value="intermedio">Intermedio</option>
                                <option value="avanzado">Avanzado</option>
                                <option value="competicion">Competición</option>
                                <option value="menores">Menores</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* List / Grid */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
                {loading ? (
                    <div className="p-8 sm:p-12 text-center text-gray-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        Cargando parámetros...
                    </div>
                ) : error ? (
                    <div className="p-8 text-center text-red-500">{error}</div>
                ) : filteredParameters.length === 0 ? (
                    <div className="p-8 sm:p-12 text-center text-gray-500">
                        No se encontraron parámetros que coincidan con los filtros.
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {filteredParameters.map((param) => (
                            <div key={param.id} className="p-5 sm:p-6 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row gap-5 items-start sm:items-center">

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-lg font-medium text-gray-900 truncate">{param.name}</h3>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getCategoryColor(param.category)}`}>
                                            {param.category.charAt(0).toUpperCase() + param.category.slice(1)}
                                        </span>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                            {Array.isArray(param.level) ? param.level.join(', ') : param.level}
                                        </span>
                                    </div>

                                    {param.description && (
                                        <p className="text-sm text-gray-500 line-clamp-2 mb-2">{param.description}</p>
                                    )}

                                    {param.tags && param.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {param.tags.map(tag => (
                                                <span key={tag} className="inline-flex text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 shrink-0 mt-4 sm:mt-0">
                                    {/* Media Links */}
                                    <div className="flex items-center gap-2 border-r border-gray-200 pr-4 mr-1">
                                        {param.videoUrl ? (
                                            <a href={param.videoUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Ver Video">
                                                {param.videoUrl.includes('youtube.com') || param.videoUrl.includes('youtu.be') ? <Youtube className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                                            </a>
                                        ) : (
                                            <div className="w-9"></div> // Spacer to keep alignment
                                        )}
                                        {param.documentUrl ? (
                                            <a href={param.documentUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Ver Documento">
                                                <FileText className="w-5 h-5" />
                                            </a>
                                        ) : (
                                            <div className="w-9"></div> // Spacer to keep alignment
                                        )}
                                    </div>

                                    {/* Actions */}
                                    {isAdmin && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleDuplicate(param.id)}
                                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                title="Duplicar"
                                            >
                                                <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleOpenDialog(param)}
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(param.id, param.name)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isDialogOpen && (
                <MethodologyFormDialog
                    isOpen={isDialogOpen}
                    onClose={handleCloseDialog}
                    onSave={handleSaveSuccess}
                    parameter={editingParameter || undefined}
                />
            )}
        </div>
    );
};

export default MethodologyPage;
