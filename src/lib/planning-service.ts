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
            where('isGlobal', '==', true),
            orderBy('createdAt', 'desc')
        )
        const querySnapshot = await getDocs(q)
        return querySnapshot.docs.map(doc => {
            const data = doc.data()
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate(),
                updatedAt: data.updatedAt?.toDate(),
            } as TrainingTemplate
        })
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

        // For each group, we create a new active assignment. 
        // We could first find existing active ones and deactivate them, but for this MVP,
        // we assume the latest active one is the current one.

        groupIds.forEach(groupId => {
            const assignmentRef = doc(collection(db, ASSIGNMENTS_COLLECTION))
            batch.set(assignmentRef, {
                groupId,
                templateId,
                assignedBy: userId,
                startDate: Timestamp.fromDate(startDate),
                isActive: true,
                createdAt: serverTimestamp()
            })
        })

        await batch.commit()
    } catch (error) {
        console.error("Error assigning template to groups:", error)
        throw new Error("No se pudo asignar la plantilla a los grupos.")
    }
}

export const getActiveAssignmentForGroup = async (groupId: string): Promise<GroupPlanAssignment | null> => {
    try {
        const q = query(
            collection(db, ASSIGNMENTS_COLLECTION),
            where('groupId', '==', groupId),
            where('isActive', '==', true),
            orderBy('createdAt', 'desc')
        )
        const querySnapshot = await getDocs(q)

        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0] // take the latest active
            const data = docSnap.data()
            return {
                id: docSnap.id,
                ...data,
                startDate: data.startDate?.toDate(),
                createdAt: data.createdAt?.toDate(),
            } as GroupPlanAssignment
        }
        return null
    } catch (error) {
        console.error("Error fetching assignment for group:", error)
        return null // don't crash the UI if this fails
    }
}
