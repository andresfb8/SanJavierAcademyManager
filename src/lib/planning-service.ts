import { db } from './firebase'
import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    serverTimestamp,
    orderBy,
    Timestamp,
    writeBatch
} from 'firebase/firestore'
import { TrainingTemplate, GroupPlanAssignment } from '../types/methodology'

const TEMPLATES_COLLECTION = 'training_templates'
const ASSIGNMENTS_COLLECTION = 'group_plan_assignments'

// ==========================================
// TRAINING TEMPLATES
// ==========================================

export const getTrainingTemplates = async (): Promise<TrainingTemplate[]> => {
    try {
        const q = query(
            collection(db, TEMPLATES_COLLECTION),
            where('isGlobal', '==', true)
        )
        const querySnapshot = await getDocs(q)
        const templates = querySnapshot.docs.map(doc => {
            const data = doc.data()
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate(),
                updatedAt: data.updatedAt?.toDate(),
            } as TrainingTemplate
        })

        // Sort client-side to avoid needing a composite index
        return templates.sort((a, b) => {
            const tA = a.createdAt?.getTime() || 0;
            const tB = b.createdAt?.getTime() || 0;
            return tB - tA;
        });
    } catch (error) {
        console.error("Error fetching training templates:", error)
        throw new Error("No se pudieron cargar las plantillas de entrenamiento.")
    }
}

export const getTrainingTemplateById = async (id: string): Promise<TrainingTemplate | null> => {
    try {
        const docRef = doc(db, TEMPLATES_COLLECTION, id)
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
            const data = docSnap.data()
            return {
                id: docSnap.id,
                ...data,
                createdAt: data.createdAt?.toDate(),
                updatedAt: data.updatedAt?.toDate(),
            } as TrainingTemplate
        }
        return null
    } catch (error) {
        console.error("Error fetching template by id:", error)
        throw new Error("No se pudo cargar la plantilla.")
    }
}

export const createTrainingTemplate = async (
    templateData: Omit<TrainingTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
    try {
        const docRef = await addDoc(collection(db, TEMPLATES_COLLECTION), {
            ...templateData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        })
        return docRef.id
    } catch (error) {
        console.error("Error creating training template:", error)
        throw new Error("No se pudo crear la plantilla.")
    }
}

export const updateTrainingTemplate = async (
    id: string,
    templateData: Partial<Omit<TrainingTemplate, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
    try {
        const docRef = doc(db, TEMPLATES_COLLECTION, id)
        await updateDoc(docRef, {
            ...templateData,
            updatedAt: serverTimestamp(),
        })
    } catch (error) {
        console.error("Error updating training template:", error)
        throw new Error("No se pudo actualizar la plantilla.")
    }
}

export const deleteTrainingTemplate = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, TEMPLATES_COLLECTION, id)
        await deleteDoc(docRef)

        // Bonus: Archive assignments tied to this template?
        // For MVP, we'll keep it simple and just delete the template.
    } catch (error) {
        console.error("Error deleting training template:", error)
        throw new Error("No se pudo eliminar la plantilla.")
    }
}

// ==========================================
// MULTIPLE GROUP ASSIGNMENTS
// ==========================================

export const assignTemplateToGroups = async (
    templateId: string,
    groupIds: string[],
    userId: string,
    startDate: Date
): Promise<void> => {
    try {
        const batch = writeBatch(db)

        for (const groupId of groupIds) {
            // Find existing active assignments and deactivate them
            const activeAssignmentsQuery = query(
                collection(db, ASSIGNMENTS_COLLECTION),
                where('groupId', '==', groupId),
                where('isActive', '==', true)
            )
            const activeDocs = await getDocs(activeAssignmentsQuery)
            activeDocs.forEach(d => {
                batch.update(doc(db, ASSIGNMENTS_COLLECTION, d.id), { isActive: false })
            })

            // Create new active assignment
            const assignmentRef = doc(collection(db, ASSIGNMENTS_COLLECTION))
            batch.set(assignmentRef, {
                groupId,
                templateId,
                assignedBy: userId,
                startDate: Timestamp.fromDate(startDate),
                isActive: true,
                createdAt: serverTimestamp()
            })
        }

        await batch.commit()
    } catch (error) {
        console.error("Error assigning template to groups:", error)
        throw new Error("No se pudo asignar la plantilla a los grupos.")
    }
}

export const unassignTemplateFromGroup = async (assignmentId: string): Promise<void> => {
    try {
        const docRef = doc(db, ASSIGNMENTS_COLLECTION, assignmentId)
        await updateDoc(docRef, {
            isActive: false,
            updatedAt: serverTimestamp()
        })
    } catch (error) {
        console.error("Error unassigning template:", error)
        throw new Error("No se pudo desvincular la plantilla del grupo.")
    }
}

export const getActiveAssignmentForGroup = async (groupId: string): Promise<GroupPlanAssignment | null> => {
    try {
        const q = query(
            collection(db, ASSIGNMENTS_COLLECTION),
            where('groupId', '==', groupId)
        )
        const querySnapshot = await getDocs(q)

        const assignments = querySnapshot.docs.map(doc => {
            const data = doc.data()
            return {
                id: doc.id,
                ...data,
                startDate: data.startDate?.toDate(),
                createdAt: data.createdAt?.toDate(),
            } as GroupPlanAssignment
        })

        // Filter active and sort client-side to avoid composite index
        const activeAssignments = assignments
            .filter(a => a.isActive)
            .sort((a, b) => {
                const tA = a.createdAt?.getTime() || 0;
                const tB = b.createdAt?.getTime() || 0;
                return tB - tA;
            });

        if (activeAssignments.length > 0) {
            return activeAssignments[0] // take the latest active
        }
        return null
    } catch (error) {
        console.error("Error fetching assignment for group:", error)
        return null // don't crash the UI if this fails
    }
}
