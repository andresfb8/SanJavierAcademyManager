import React, { useState, useEffect } from 'react';
import { MethodologyParameter, ParameterCategory, ParameterLevel } from '../../types/methodology';
import { createParameter, updateParameter } from '../../lib/methodology-service';
import { useAuthStore } from '@/stores/authStore';
import { X, Youtube, FileText, Video } from 'lucide-react';

interface MethodologyFormDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    parameter?: MethodologyParameter;
}

const MethodologyFormDialog: React.FC<MethodologyFormDialogProps> = ({
    isOpen,
    onClose,
    onSave,
    parameter
}) => {
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [name, setName] = useState(parameter?.name || '');
    const [category, setCategory] = useState<ParameterCategory>(parameter?.category || 'tecnica');
    const [level, setLevel] = useState<ParameterLevel>(
        (Array.isArray(parameter?.level) ? parameter.level[0] : parameter?.level) || 'todos'
    );
    const [description, setDescription] = useState(parameter?.description || '');
    const [videoUrl, setVideoUrl] = useState(parameter?.videoUrl || '');
    const [documentUrl, setDocumentUrl] = useState(parameter?.documentUrl || '');
    const [tagsInput, setTagsInput] = useState(parameter?.tags?.join(', ') || '');

    // Animation state (simple fade/scale)
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            // Reset form if opening without parameter
            if (!parameter) {
                setName('');
                setCategory('tecnica');
                setLevel('todos');
                setDescription('');
                setVideoUrl('');
                setDocumentUrl('');
                setTagsInput('');
            } else {
                setName(parameter.name);
                setCategory(parameter.category);
                setLevel(Array.isArray(parameter.level) ? parameter.level[0] : parameter.level);
                setDescription(parameter.description || '');
                setVideoUrl(parameter.videoUrl || '');
                setDocumentUrl(parameter.documentUrl || '');
                setTagsInput(parameter.tags?.join(', ') || '');
            }
        } else {
            setIsVisible(false);
        }
    }, [isOpen, parameter]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('El nombre es obligatorio.');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const tagsList = tagsInput
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0);

            const parameterData = {
                name: name.trim(),
                category,
                level: [level], // Guardamos como array para que array-contains funcione
                tags: tagsList,
                isGlobal: true, // Only admins should be creating here
                ...(description.trim() ? { description: description.trim() } : {}),
                ...(videoUrl.trim() ? { videoUrl: videoUrl.trim() } : {}),
                ...(documentUrl.trim() ? { documentUrl: documentUrl.trim() } : {}),
            };

            if (parameter?.id) {
                await updateParameter(parameter.id, parameterData);
            } else {
                await createParameter({
                    ...parameterData,
                    createdBy: user?.id,
                });
            }

            onSave();
        } catch (err: any) {
            console.error("Error in MethodologyFormDialog handleSubmit:", err);
            setError(err.message || 'Error al guardar el parámetro');
        } finally {
            setLoading(false);
        }
    };

    const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">

                {/* Overlay */}
                <div
                    className={`fixed inset-0 transition-opacity bg-gray-900/75 backdrop-blur-sm ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                    onClick={onClose}
                ></div>

                {/* Modal Panel */}
                <div className={`inline-block w-full max-w-2xl px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-2xl shadow-2xl sm:my-8 sm:align-middle sm:p-6 ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95'}`}>
                    <div className="absolute top-0 right-0 pt-4 pr-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            <span className="sr-only">Cerrar</span>
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="sm:flex sm:items-start">
                        <div className="w-full mt-3 sm:mt-0 text-left">
                            <h3 className="text-xl font-bold leading-6 text-gray-900 mb-6">
                                {parameter ? 'Editar Parámetro Metodológico' : 'Nuevo Parámetro Metodológico'}
                            </h3>

                            {error && (
                                <div className="p-3 mb-6 flex text-sm text-red-800 rounded-lg bg-red-50 border border-red-200">
                                    <div className="flex-1">{error}</div>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">

                                    {/* Nombre */}
                                    <div className="col-span-2">
                                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                            Nombre del Parámetro *
                                        </label>
                                        <div className="mt-1">
                                            <input
                                                type="text"
                                                name="name"
                                                id="name"
                                                required
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                                placeholder="Ej: Empuñadura continental"
                                            />
                                        </div>
                                    </div>

                                    {/* Categoría */}
                                    <div>
                                        <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                                            Categoría *
                                        </label>
                                        <div className="mt-1">
                                            <select
                                                id="category"
                                                name="category"
                                                value={category}
                                                onChange={(e) => setCategory(e.target.value as ParameterCategory)}
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                            >
                                                <option value="tecnica">Técnica</option>
                                                <option value="tactica">Táctica</option>
                                                <option value="fisica">Física</option>
                                                <option value="mental">Mental</option>
                                                <option value="conducta">Conducta</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Nivel */}
                                    <div>
                                        <label htmlFor="level" className="block text-sm font-medium text-gray-700">
                                            Nivel Objetivo *
                                        </label>
                                        <div className="mt-1">
                                            <select
                                                id="level"
                                                name="level"
                                                value={level}
                                                onChange={(e) => setLevel(e.target.value as ParameterLevel)}
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                            >
                                                <option value="todos">General (Todos)</option>
                                                <option value="iniciacion">Iniciación</option>
                                                <option value="intermedio">Intermedio</option>
                                                <option value="avanzado">Avanzado</option>
                                                <option value="competicion">Competición</option>
                                                <option value="menores">Menores</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Etiquetas */}
                                    <div className="col-span-2">
                                        <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
                                            Etiquetas (separadas por coma)
                                        </label>
                                        <div className="mt-1">
                                            <input
                                                type="text"
                                                name="tags"
                                                id="tags"
                                                value={tagsInput}
                                                onChange={(e) => setTagsInput(e.target.value)}
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                                placeholder="ej: saque, empuñadura, basico"
                                            />
                                        </div>
                                    </div>

                                    {/* Descripción */}
                                    <div className="col-span-2">
                                        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                                            Descripción o Puntos Clave
                                        </label>
                                        <div className="mt-1">
                                            <textarea
                                                id="description"
                                                name="description"
                                                rows={3}
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                                placeholder="Explica brevemente los puntos clave a fijarse en el alumno..."
                                            />
                                        </div>
                                    </div>

                                    {/* Multimedia - Video */}
                                    <div className="col-span-2 mt-4">
                                        <h4 className="text-sm font-medium text-gray-900 border-b pb-2 mb-4">Recursos Multimedia (Opcional)</h4>

                                        <label htmlFor="videoUrl" className="block text-sm font-medium text-gray-700 mb-1">
                                            Enlace de Video Ejercicio/Muestra
                                        </label>
                                        <div className="flex rounded-md shadow-sm mb-4">
                                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                                                {isYouTube ? <Youtube className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                                            </span>
                                            <input
                                                type="url"
                                                name="videoUrl"
                                                id="videoUrl"
                                                value={videoUrl}
                                                onChange={(e) => setVideoUrl(e.target.value)}
                                                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm border-gray-300"
                                                placeholder="https://youtube.com/watch?v=..."
                                            />
                                        </div>

                                        <label htmlFor="documentUrl" className="block text-sm font-medium text-gray-700 mb-1">
                                            Enlace a Documento (PDF, Imagen)
                                        </label>
                                        <div className="flex rounded-md shadow-sm">
                                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                                                <FileText className="h-4 w-4" />
                                            </span>
                                            <input
                                                type="url"
                                                name="documentUrl"
                                                id="documentUrl"
                                                value={documentUrl}
                                                onChange={(e) => setDocumentUrl(e.target.value)}
                                                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm border-gray-300"
                                                placeholder="https://drive.google.com/..."
                                            />
                                        </div>
                                    </div>

                                </div>

                                <div className="mt-8 flex justify-end gap-3 border-t border-gray-200 pt-5">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="w-4 h-4 mr-2 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
                                                Guardando...
                                            </>
                                        ) : (
                                            'Guardar Parámetro'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MethodologyFormDialog;
