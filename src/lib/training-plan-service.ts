import { db } from './firebase'
import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    query,
    where,
    serverTimestamp,
    orderBy,
    limit,
    Timestamp
} from 'firebase/firestore'
import { TrainingPlan, ParameterWeight } from '../types/methodology'

const PLANS_COLLECTION = 'training_plans'

export const getLatestTrainingPlanForGroup = async (groupId: string): Promise<TrainingPlan | null> => {
    try {
        const q = query(
            collection(db, PLANS_COLLECTION),
            where('groupId', '==', groupId),
            orderBy('createdAt', 'desc'),
            limit(1)
        )
        const querySnapshot = await getDocs(q)

        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0]
            const data = docSnap.data()
            return {
                id: docSnap.id,
                ...data,
                startDate: data.startDate?.toDate(),
                endDate: data.endDate?.toDate(),
                createdAt: data.createdAt?.toDate(),
                updatedAt: data.updatedAt?.toDate(),
            } as TrainingPlan
        }
        return null
    } catch (error) {
        console.error("Error fetching training plan for group:", error)
        throw new Error("No se pudo cargar el plan de entrenamiento del grupo.")
    }
}

export const createTrainingPlan = async (
    planData: Omit<TrainingPlan, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
    try {
        const docRef = await addDoc(collection(db, PLANS_COLLECTION), {
            ...planData,
            startDate: planData.startDate ? Timestamp.fromDate(planData.startDate) : serverTimestamp(),
            endDate: planData.endDate ? Timestamp.fromDate(planData.endDate) : serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        })
        return docRef.id
    } catch (error) {
        console.error("Error creating training plan:", error)
        throw new Error(error instanceof Error ? error.message : "No se pudo crear el plan de entrenamiento.")
    }
}

export const updateTrainingPlan = async (
    id: string,
    planData: Partial<Omit<TrainingPlan, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
    try {
        const docRef = doc(db, PLANS_COLLECTION, id)

        const updateData: any = {
            ...planData,
            updatedAt: serverTimestamp(),
        }

        if (planData.startDate) updateData.startDate = Timestamp.fromDate(planData.startDate)
        if (planData.endDate) updateData.endDate = Timestamp.fromDate(planData.endDate)

        await updateDoc(docRef, updateData)
    } catch (error) {
        console.error("Error updating training plan:", error)
        throw new Error(error instanceof Error ? error.message : "No se pudo actualizar el plan de entrenamiento.")
    }
}
