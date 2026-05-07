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

                        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
                            {sortedSchedule.length === 0 ? (
                                <p className="text-sm text-orange-500 col-span-full py-4 px-6 bg-orange-50 rounded-2xl border border-orange-100">
                                    <Info className="w-4 h-4 inline mr-2" />
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

                                    const cardStyles = cn(
                                        "relative flex flex-col rounded-[2rem] border-2 p-6 transition-all duration-200",
                                        isHoliday ? "border-red-100 bg-red-50/30 opacity-80" : 
                                        isCompleted ? "border-emerald-100 bg-emerald-50/20" : 
                                        isSkipped ? "border-slate-100 bg-slate-50 opacity-60 grayscale" : 
                                        isToday ? "border-primary/20 bg-white shadow-xl shadow-primary/5 ring-1 ring-primary/5" : 
                                        "border-slate-100 bg-slate-50/50"
                                    );

                                    return (
                                        <div key={dIndex} className={cardStyles}>
                                            <div className="flex justify-between items-start mb-5">
                                                <div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">
                                                        {getDayLabel(date)}
                                                    </span>
                                                    <h5 className="text-lg font-black text-slate-900">{formatDate(date)}</h5>
                                                </div>
                                                {isHoliday ? (
                                                    <Badge className="bg-red-100 text-red-600 border-none px-3 py-1 text-[10px] font-bold">Festivo</Badge>
                                                ) : isCompleted ? (
                                                    <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                                        <CheckCircle2 className="h-5 w-5" />
                                                    </div>
                                                ) : isSkipped ? (
                                                    <Badge variant="outline" className="text-[10px]">Omitida</Badge>
                                                ) : isToday ? (
                                                    <Badge className="bg-primary text-white border-none px-3 py-1 text-[10px] font-black animate-pulse uppercase tracking-widest">Hoy</Badge>
                                                ) : isPast ? (
                                                    <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                                                        <Clock className="h-5 w-5" />
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div className="flex-1 space-y-3">
                                                {isHoliday ? (
                                                    <div className="py-6 text-center">
                                                        <CalendarHeart className="h-10 w-10 text-red-200 mx-auto mb-2" />
                                                        <p className="text-xs font-bold text-red-300 uppercase tracking-widest">Sesión Cancelada</p>
                                                    </div>
                                                ) : (!session || session.parameters.length === 0) ? (
                                                    <div className="py-6 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                                                        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Sesión Libre</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2.5">
                                                        {session.parameters.map(param => {
                                                            const details = getParamDetails(param.parameterId);
                                                            if (!details) return null;

                                                            return (
                                                                <div key={param.parameterId} className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-slate-100 shadow-sm transition-hover hover:border-primary/20">
                                                                    <div className="flex justify-between items-center gap-3">
                                                                        <div className="min-w-0">
                                                                            <p className="text-sm font-bold text-slate-800 leading-tight truncate">
                                                                                {details.name}
                                                                            </p>
                                                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                                                {details.category}
                                                                            </span>
                                                                        </div>
                                                                        <ParameterWeightControl
                                                                            value={param.weight}
                                                                            onChange={() => { }}
                                                                            readonly
                                                                        />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {(!isHoliday && !isCompleted && !isSkipped) && (isToday || isPast) && (
                                                <div className="mt-6 grid grid-cols-1 gap-3">
                                                    <Button
                                                        onClick={() => setFeedbackDialog({ isOpen: true, sessionName: `S${week.weekNumber} - E${dIndex + 1}`, week: week.weekNumber, day: dIndex + 1, mappedDate: date })}
                                                        className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-100 active:scale-[0.97] transition-all"
                                                    >
                                                        <CheckCircle2 className="h-5 w-5 mr-2" />
                                                        Completar Sesión
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        onClick={() => setRescheduleDialog({ isOpen: true, week: week.weekNumber, day: dIndex + 1, mappedDate: date })}
                                                        className="w-full h-12 text-slate-400 hover:text-slate-600 font-bold text-xs"
                                                    >
                                                        Suspender / Omitir
                                                    </Button>
                                                </div>
                                            )}
                                            
                                            {isCompleted && record?.feedback?.notes && (
                                                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                    <p className="text-[10px] text-slate-500 italic">"{record.feedback.notes}"</p>
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
