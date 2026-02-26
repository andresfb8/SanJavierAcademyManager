import React, { useState, useEffect } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { MethodologyParameter, TrainingTemplate, GroupPlanAssignment } from '@/types/methodology';
import { getParameters } from '@/lib/methodology-service';
import { getActiveAssignmentForGroup, getTrainingTemplateById } from '@/lib/planning-service';
import { Calendar, FileText, Youtube, Video, Info } from 'lucide-react';
import { DAYS_OF_WEEK } from '@/constants';
import { formatDate } from '@/lib/utils';
import { ParameterWeightControl } from '../methodology/ParameterWeightControl';

interface GroupTrainingPlanTabProps {
    groupId: string;
}

export const GroupTrainingPlanTab: React.FC<GroupTrainingPlanTabProps> = ({ groupId }) => {
    const { groups } = useDataStore();
    const group = groups.find(g => g.id === groupId);

    // State
    const [catalog, setCatalog] = useState<MethodologyParameter[]>([]);
    const [assignment, setAssignment] = useState<GroupPlanAssignment | null>(null);
    const [template, setTemplate] = useState<TrainingTemplate | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadPlanData = async () => {
            try {
                setLoading(true);
                // 1. Get Global Catalog
                const params = await getParameters();
                setCatalog(params);

                // 2. Get active assignment for this group
                const activeAssignment = await getActiveAssignmentForGroup(groupId);
                setAssignment(activeAssignment);

                // 3. If there is an assignment, fetch the template details
                if (activeAssignment?.templateId) {
                    const temp = await getTrainingTemplateById(activeAssignment.templateId);
                    setTemplate(temp);
                }
            } catch (err) {
                console.error("Failed to load training plan data:", err);
            } finally {
                setLoading(false);
            }
        };

        loadPlanData();
    }, [groupId]);

    if (loading) {
        return <div className="p-8 text-center text-gray-500 animate-pulse">Cargando planificación...</div>;
    }

    if (!group) return null;

    if (!assignment || !template) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Calendar className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">Sin Planificación Asignada</h3>
                <p className="text-gray-500 text-sm max-w-md text-center">
                    Este grupo no tiene ninguna plantilla de entrenamiento activa.
                    Un coordinador o director puede asignar una desde el módulo de "Planificación".
                </p>
            </div>
        );
    }

    // Adapt logic: Match Group's schedule with Template's sessions
    // Sort group schedule chronologically
    const sortedSchedule = [...group.schedule].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

    const getDayLabel = (dayOfWeek: number) => {
        const day = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek)
        return day ? day.label : `Día ${dayOfWeek}`
    }

    const getParamDetails = (paramId: string) => catalog.find(p => p.id === paramId);

    return (
        <div className="flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-start">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{template.name}</h3>
                    {template.description && <p className="text-sm text-gray-600 mb-2">{template.description}</p>}
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            Inicio: <strong className="ml-1 text-gray-700">{formatDate(assignment.startDate)}</strong>
                        </span>
                        <span className="bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded text-xs">
                            {template.weeksCount} Semanas
                        </span>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Rutina del Grupo</p>
                    <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                        {sortedSchedule.map((slot, i) => (
                            <span key={i} className="text-xs font-semibold bg-white border border-gray-200 px-1.5 py-0.5 rounded shadow-sm">
                                {getDayLabel(slot.dayOfWeek)}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(100vh-22rem)] space-y-8">
                {template.weeks.map((week, wIndex) => (
                    <div key={wIndex} className="space-y-4">
                        <div className="flex items-baseline gap-3 border-b border-gray-100 pb-2">
                            <h4 className="text-lg font-semibold text-gray-800">Semana {week.weekNumber}</h4>
                            {week.focus && <span className="text-sm text-gray-500 italic">— Objetivo: {week.focus}</span>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* We iterate over the group's real schedule to show exactly what they do each day */}
                            {sortedSchedule.length === 0 ? (
                                <p className="text-sm text-orange-500 col-span-full">
                                    <Info className="w-4 h-4 inline mr-1" />
                                    El grupo no tiene un horario definido. Configura sus días de entrenamiento para ver la adaptación.
                                </p>
                            ) : (
                                sortedSchedule.map((slot, dIndex) => {
                                    // Try to find the corresponding session in the template for this day index.
                                    // Normally, first chronological training day matches session index 0.
                                    const session = week.sessions[dIndex];

                                    return (
                                        <div key={dIndex} className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="flex justify-between items-center mb-3">
                                                <h5 className="font-medium text-gray-900">{getDayLabel(slot.dayOfWeek)}</h5>
                                                <span className="text-xs text-gray-500">{slot.startTime}</span>
                                            </div>

                                            <div className="flex-1">
                                                {!session || session.parameters.length === 0 ? (
                                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 py-4">
                                                        <span className="text-xs uppercase tracking-wider font-semibold">Sesión Libre</span>
                                                        <span className="text-[10px] mt-1 text-center">No hay conceptos metodológicos para este día.</span>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2.5">
                                                        {session.parameters.map(param => {
                                                            const details = getParamDetails(param.parameterId);
                                                            if (!details) return null;

                                                            return (
                                                                <div key={param.parameterId} className="bg-white p-2.5 rounded border border-gray-100 shadow-sm flex flex-col">
                                                                    <div className="flex justify-between items-start gap-2 mb-1.5">
                                                                        <span className="text-sm font-semibold text-gray-800 leading-tight">
                                                                            {details.name}
                                                                        </span>
                                                                        <ParameterWeightControl
                                                                            value={param.weight}
                                                                            onChange={() => { }}
                                                                            readonly
                                                                        />
                                                                    </div>

                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded capitalize">
                                                                            {details.category}
                                                                        </span>

                                                                        {(details.videoUrl || details.documentUrl) && (
                                                                            <div className="flex gap-1.5">
                                                                                {details.videoUrl && (
                                                                                    <a href={details.videoUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-red-500" title="Ver Video">
                                                                                        {details.videoUrl.includes('youtube') || details.videoUrl.includes('youtu.be') ? <Youtube className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                                                                                    </a>
                                                                                )}
                                                                                {details.documentUrl && (
                                                                                    <a href={details.documentUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-500" title="Ver Documento">
                                                                                        <FileText className="w-3.5 h-3.5" />
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
