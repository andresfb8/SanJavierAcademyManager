import React, { useState, useEffect } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { MethodologyParameter, TrainingTemplate, GroupPlanAssignment, GroupSessionRecord } from '@/types/methodology';
import { getParameters } from '@/lib/methodology-service';
import { getActiveAssignmentForGroup, getTrainingTemplateById, unassignTemplateFromGroup } from '@/lib/planning-service';
import { getSessionRecordsForAssignment, markSessionCompleted, skipSession, rescheduleSession, calculateSessionDates } from '@/lib/session-record-service';
import { Calendar, FileText, Youtube, Video, Info, CheckCircle2, AlertCircle, Clock, Trash2, CalendarHeart } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DAYS_OF_WEEK } from '@/constants';
import { formatDate } from '@/lib/utils';
import { ParameterWeightControl } from '../methodology/ParameterWeightControl';
import { SessionFeedbackDialog } from '../planning/SessionFeedbackDialog';
import { RescheduleDialog } from '../planning/RescheduleDialog';
import { useAuthStore } from '@/stores/authStore';

interface GroupTrainingPlanTabProps {
    groupId: string;
}

export const GroupTrainingPlanTab: React.FC<GroupTrainingPlanTabProps> = ({ groupId }) => {
    const { groups, holidays } = useDataStore();
    const { user } = useAuthStore();
    const group = groups.find(g => g.id === groupId);

    // State
    const [catalog, setCatalog] = useState<MethodologyParameter[]>([]);
    const [assignment, setAssignment] = useState<GroupPlanAssignment | null>(null);
    const [template, setTemplate] = useState<TrainingTemplate | null>(null);
    const [records, setRecords] = useState<GroupSessionRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const [feedbackDialog, setFeedbackDialog] = useState<{ isOpen: boolean, sessionName?: string, week: number, day: number, mappedDate?: Date }>({ isOpen: false, week: 0, day: 0 });
    const [rescheduleDialog, setRescheduleDialog] = useState<{ isOpen: boolean, week: number, day: number, mappedDate?: Date }>({ isOpen: false, week: 0, day: 0 });
    const [showUnassignConfirm, setShowUnassignConfirm] = useState(false);
    const [isUnassigning, setIsUnassigning] = useState(false);

    const loadPlanData = async () => {
        try {
            setLoading(true);
            const params = await getParameters();
            setCatalog(params);

            const activeAssignment = await getActiveAssignmentForGroup(groupId);
            setAssignment(activeAssignment);

            if (activeAssignment?.templateId) {
                const temp = await getTrainingTemplateById(activeAssignment.templateId);
                setTemplate(temp);

                const recs = await getSessionRecordsForAssignment(activeAssignment.id);
                setRecords(recs);
            }
        } catch (err) {
            console.error("Failed to load training plan data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPlanData();
    }, [groupId]);

    const handleConfirmFeedback = async (feedback?: { rating?: number; notes?: string }) => {
        if (!assignment || !user) return;
        try {
            const mappedDate = feedbackDialog.mappedDate || new Date();
            await markSessionCompleted({
                groupId,
                assignmentId: assignment.id,
                weekNumber: feedbackDialog.week,
                dayNumber: feedbackDialog.day,
                plannedDate: mappedDate,
                completedBy: user.id,
                feedback
            });
            await loadPlanData();
        } catch (error) {
            console.error(error);
        } finally {
            setFeedbackDialog({ isOpen: false, week: 0, day: 0 });
        }
    };

    const handleSkip = async () => {
        if (!assignment || !user) return;
        try {
            const mappedDate = rescheduleDialog.mappedDate || new Date();
            await skipSession({
                groupId,
                assignmentId: assignment.id,
                weekNumber: rescheduleDialog.week,
                dayNumber: rescheduleDialog.day,
                plannedDate: mappedDate,
                completedBy: user.id
            });
            await loadPlanData();
        } catch (error) {
            console.error(error);
        } finally {
            setRescheduleDialog({ isOpen: false, week: 0, day: 0 });
        }
    };

    const handleReschedule = async () => {
        if (!assignment || !user) return;
        try {
            const mappedDate = rescheduleDialog.mappedDate || new Date();
            const existingRecord = records.find(r => r.weekNumber === rescheduleDialog.week && r.dayNumber === rescheduleDialog.day);

            await rescheduleSession({
                groupId,
                assignmentId: assignment.id,
                weekNumber: rescheduleDialog.week,
                dayNumber: rescheduleDialog.day,
                plannedDate: existingRecord ? existingRecord.plannedDate : mappedDate,
                rescheduledDates: existingRecord ? existingRecord.rescheduledDates : undefined,
                completedBy: user.id,
                dateToReschedule: mappedDate
            });
            await loadPlanData();
        } catch (error) {
            console.error(error);
        } finally {
            setRescheduleDialog({ isOpen: false, week: 0, day: 0 });
        }
    };

    const handleUnassign = async () => {
        if (!assignment) return;
        try {
            setIsUnassigning(true);
            await unassignTemplateFromGroup(assignment.id);
            setAssignment(null);
            setTemplate(null);
            setRecords([]);
            setShowUnassignConfirm(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsUnassigning(false);
        }
    };

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
                </p>
            </div>
        );
    }

    const sortedSchedule = [...group.schedule].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    const sessionMappings = calculateSessionDates(template, assignment, records, sortedSchedule, holidays.map(h => h.date));

    const getDayLabel = (date: Date) => {
        const dayIdx = date.getDay();
        const day = DAYS_OF_WEEK.find((d) => d.value === dayIdx);
        return day ? day.label : `Día ${dayIdx}`;
    };

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
                    </div>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    className="text-red-500 border-red-200 hover:bg-red-50"
                    onClick={() => setShowUnassignConfirm(true)}
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Desvincular Planificación
                </Button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(100vh-22rem)] space-y-8">
                {template.weeks.map((week, wIndex) => (
                    <div key={wIndex} className="space-y-4">
                        <div className="flex items-baseline gap-3 border-b border-gray-100 pb-2">
                            <h4 className="text-lg font-semibold text-gray-800">Semana {week.weekNumber}</h4>
                            {week.focus && <span className="text-sm text-gray-500 italic">— Objetivo: {week.focus}</span>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {sortedSchedule.length === 0 ? (
                                <p className="text-sm text-orange-500 col-span-full">
                                    <Info className="w-4 h-4 inline mr-1" />
                                    El grupo no tiene un horario definido. Configura sus días de entrenamiento para ver la adaptación.
                                </p>
                            ) : (
                                week.sessions.map((session, dIndex) => {
                                    const sessionId = `W${week.weekNumber}_D${dIndex + 1}`;
                                    const mapping = sessionMappings[sessionId];
                                    if (!mapping) return null;

                                    const { date, record, isToday, isPast, isHoliday } = mapping;
                                    const isCompleted = record?.status === 'completed';
                                    const isSkipped = record?.status === 'skipped';

                                    const borderColor = isHoliday ? 'border-red-200 bg-red-50 opacity-80' : isCompleted ? 'border-green-300 bg-green-50' : isSkipped ? 'border-gray-200 bg-gray-100 opacity-60' : isToday ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100' : 'border-gray-200 bg-gray-50';

                                    return (
                                        <div key={dIndex} className={`border rounded-lg p-4 flex flex-col ${borderColor}`}>
                                            <div className="flex justify-between items-center mb-3">
                                                <div>
                                                    <h5 className="font-semibold text-gray-900">{getDayLabel(date)}</h5>
                                                    <span className="text-xs text-gray-500">{formatDate(date)}</span>
                                                </div>
                                                {isHoliday ? (
                                                    <span className="flex items-center text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded-full">
                                                        <CalendarHeart className="w-3.5 h-3.5 mr-1" /> Festivo
                                                    </span>
                                                ) : isCompleted ? (
                                                    <span className="flex items-center text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full">
                                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Completado
                                                    </span>
                                                ) : isSkipped ? (
                                                    <span className="flex items-center text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                                                        Omitida
                                                    </span>
                                                ) : isToday ? (
                                                    <span className="flex items-center text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                                        <Clock className="w-3.5 h-3.5 mr-1" /> Hoy
                                                    </span>
                                                ) : isPast ? (
                                                    <span className="flex items-center text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                                                        <AlertCircle className="w-3.5 h-3.5 mr-1" /> Pendiente
                                                    </span>
                                                ) : null}
                                            </div>

                                            <div className="flex-1">
                                                {isHoliday ? (
                                                    <div className="h-full flex flex-col items-center justify-center text-red-400 py-4">
                                                        <span className="text-xs uppercase tracking-wider font-semibold">Día Festivo - Sesión Omitida</span>
                                                    </div>
                                                ) : (!session || session.parameters.length === 0) ? (
                                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 py-4">
                                                        <span className="text-xs uppercase tracking-wider font-semibold">Sesión Libre</span>
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
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {(!isHoliday && !isCompleted && !isSkipped) && (isToday || isPast) && (
                                                <div className="mt-4 flex gap-2 pt-3 border-t border-gray-200/50">
                                                    <button
                                                        onClick={() => setFeedbackDialog({ isOpen: true, sessionName: `S${week.weekNumber} - E${dIndex + 1}`, week: week.weekNumber, day: dIndex + 1, mappedDate: date })}
                                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-1.5 rounded transition-colors"
                                                    >
                                                        Completar
                                                    </button>
                                                    <button
                                                        onClick={() => setRescheduleDialog({ isOpen: true, week: week.weekNumber, day: dIndex + 1, mappedDate: date })}
                                                        className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-medium py-1.5 rounded transition-colors"
                                                    >
                                                        Suspender
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <SessionFeedbackDialog
                isOpen={feedbackDialog.isOpen}
                onClose={() => setFeedbackDialog({ isOpen: false, week: 0, day: 0 })}
                onConfirm={handleConfirmFeedback}
                sessionName={feedbackDialog.sessionName || ''}
            />

            <RescheduleDialog
                isOpen={rescheduleDialog.isOpen}
                onClose={() => setRescheduleDialog({ isOpen: false, week: 0, day: 0 })}
                onSkip={handleSkip}
                onReschedule={handleReschedule}
            />

            <Dialog open={showUnassignConfirm} onOpenChange={setShowUnassignConfirm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Desvincular Planificación?</DialogTitle>
                        <DialogDescription>
                            Estás a punto de quitar este plan de entrenamiento del grupo. El historial de sesiones completadas se mantendrá en la base de datos, pero el calendario se vaciará.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" onClick={() => setShowUnassignConfirm(false)} disabled={isUnassigning}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={handleUnassign} disabled={isUnassigning}>
                            {isUnassigning ? "Desvinculando..." : "Desvincular"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
