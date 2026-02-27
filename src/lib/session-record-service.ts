import {
    collection,
    doc,
    getDocs,
    query,
    where,
    setDoc,
    serverTimestamp,
    Timestamp,
    orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { GroupSessionRecord, TrainingTemplate, GroupPlanAssignment } from '../types/methodology';

const COLLECTION_NAME = 'group_session_records';

export const getSessionRecordsForAssignment = async (assignmentId: string): Promise<GroupSessionRecord[]> => {
    const q = query(
        collection(db, COLLECTION_NAME),
        where('assignmentId', '==', assignmentId)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            id: doc.id,
            plannedDate: data.plannedDate instanceof Timestamp ? data.plannedDate.toDate() : data.plannedDate,
            completedAt: data.completedAt instanceof Timestamp ? data.completedAt.toDate() : data.completedAt,
        } as GroupSessionRecord;
    });
};

export const markSessionCompleted = async (
    record: Omit<GroupSessionRecord, 'id' | 'status' | 'completedAt'> & { completedBy: string }
) => {
    const id = `${record.assignmentId}_W${record.weekNumber}_D${record.dayNumber}`;
    const docRef = doc(db, COLLECTION_NAME, id);

    const dataToSave = {
        ...record,
        id,
        status: 'completed',
        completedAt: serverTimestamp(),
        plannedDate: record.plannedDate instanceof Date ? Timestamp.fromDate(record.plannedDate) : record.plannedDate
    };

    await setDoc(docRef, dataToSave, { merge: true });
    return id;
};

export const skipSession = async (
    record: Omit<GroupSessionRecord, 'id' | 'status' | 'completedAt' | 'feedback'> & { completedBy: string }
) => {
    const id = `${record.assignmentId}_W${record.weekNumber}_D${record.dayNumber}`;
    const docRef = doc(db, COLLECTION_NAME, id);

    const dataToSave = {
        ...record,
        id,
        status: 'skipped',
        completedAt: serverTimestamp(),
        plannedDate: record.plannedDate instanceof Date ? Timestamp.fromDate(record.plannedDate) : record.plannedDate
    };

    await setDoc(docRef, dataToSave, { merge: true });
    return id;
};

export const rescheduleSession = async (
    record: Omit<GroupSessionRecord, 'id' | 'status' | 'completedAt' | 'feedback'> & { completedBy: string, dateToReschedule: Date }
) => {
    const id = `${record.assignmentId}_W${record.weekNumber}_D${record.dayNumber}`;
    const docRef = doc(db, COLLECTION_NAME, id);

    const rescheduled = record.rescheduledDates ? [...record.rescheduledDates] : [];
    rescheduled.push(record.dateToReschedule);

    const dataToSave = {
        ...record,
        id,
        status: 'pending', // Sigue pendiente, pero con una fecha reprogramada añadida
        rescheduledDates: rescheduled.map(d => typeof d === 'string' ? d : d instanceof Date ? Timestamp.fromDate(d) : d),
        plannedDate: record.plannedDate instanceof Date ? Timestamp.fromDate(record.plannedDate) : record.plannedDate
    };

    // Remove the temporary non-schema field before saving
    const dataWithoutDateToReschedule = { ...dataToSave } as any;
    delete dataWithoutDateToReschedule.dateToReschedule;

    await setDoc(docRef, dataWithoutDateToReschedule, { merge: true });
    return id;
};

// Nueva utilidad: dado el template, assignment, y records, calcula las fechas reales
export const calculateSessionDates = (
    template: TrainingTemplate,
    assignment: GroupPlanAssignment | null,
    records: GroupSessionRecord[],
    schedule: { dayOfWeek: number }[],
    holidays: Date[] = []
) => {
    const sessionMappings: Record<string, { date: Date, record?: GroupSessionRecord, isToday: boolean, isPast: boolean, isHoliday: boolean }> = {};
    if (!assignment?.startDate || !schedule || schedule.length === 0) return sessionMappings;

    let currentDate = new Date(assignment.startDate);
    currentDate.setHours(0, 0, 0, 0);

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const activeDays = schedule.map(s => s.dayOfWeek);
    if (activeDays.length === 0) return sessionMappings;

    const nextTrainingDay = (date: Date): Date => {
        let maxLoops = 30; // Evitar infinitos
        let current = new Date(date);
        while (maxLoops > 0) {
            if (activeDays.includes(current.getDay())) {
                return new Date(current);
            }
            current.setDate(current.getDate() + 1);
            maxLoops--;
        }
        return current;
    };

    // Fechas que fueron suspendidas explícitamente y que debemos saltar en el calendario real
    const allRescheduledDates = records.flatMap(r => r.rescheduledDates || []).map(d => {
        const date = d instanceof Timestamp ? d.toDate() : new Date(d);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    });

    // Fechas festivas
    const holidayTimes = holidays.map(d => {
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    });

    currentDate = nextTrainingDay(currentDate);

    for (const week of template.weeks) {
        for (let i = 0; i < week.sessions.length; i++) {
            const session = week.sessions[i];
            const sessionId = `W${week.weekNumber}_D${i + 1}`;
            const record = records.find(r => r.weekNumber === week.weekNumber && r.dayNumber === (i + 1));

            // Avanzar currentDate hasta encontrar un día de entrenamiento que no haya sido "rescheduled"
            let dateValidoEncontrado = false;
            while (!dateValidoEncontrado) {
                if (allRescheduledDates.includes(currentDate.getTime())) {
                    currentDate.setDate(currentDate.getDate() + 1);
                    currentDate = nextTrainingDay(currentDate);
                } else {
                    dateValidoEncontrado = true;
                }
            }

            sessionMappings[sessionId] = {
                date: new Date(currentDate),
                record,
                isToday: currentDate.getTime() === todayDate.getTime(),
                isPast: currentDate.getTime() < todayDate.getTime(),
                isHoliday: holidayTimes.includes(currentDate.getTime())
            };

            // Preparar el currentDate para el siguiente bucle del session
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate = nextTrainingDay(currentDate);
        }
    }

    return sessionMappings;
};
