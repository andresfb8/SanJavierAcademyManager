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
    orderBy,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore'
import { MethodologyParameter, TrainingPlan, ParameterCategory, ParameterLevel } from '../types/methodology'

const PARAMETERS_COLLECTION = 'methodology_parameters'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PLANS_COLLECTION = 'training_plans'

// ==========================================
// PARAMETROS (CATALOGO GLOBAL)
// ==========================================

export const getParameters = async (
    options?: {
        category?: ParameterCategory | 'all'
        level?: ParameterLevel | 'all'
    }
): Promise<MethodologyParameter[]> => {
    try {
        let q = query(collection(db, PARAMETERS_COLLECTION), where('isGlobal', '==', true))

        if (options?.category && options.category !== 'all') {
            q = query(q, where('category', '==', options.category))
        }

        // Note: level can be an array in the document, so simple == might not work if we want "contains"
        // For a real app, if level is string[], we'd use array-contains. 
        // If it's a string, we use ==. Assuming we store it as string for simple filtering now, 
        // or we query all and filter in memory if the data structure is mixed.
        if (options?.level && options.level !== 'all') {
            q = query(q, where('level', 'array-contains', options.level))
        }

        const querySnapshot = await getDocs(q)
        return querySnapshot.docs.map(doc => {
            const data = doc.data()
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate(),
                updatedAt: data.updatedAt?.toDate(),
            } as MethodologyParameter
        })
    } catch (error) {
        console.error("Error fetching parameters:", error)
        throw new Error("No se pudieron cargar los parámetros. Verifica tu conexión e inténtalo de nuevo.")
    }
}

export const getParameterById = async (id: string): Promise<MethodologyParameter | null> => {
    try {
        const docRef = doc(db, PARAMETERS_COLLECTION, id)
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
            const data = docSnap.data()
            return {
                id: docSnap.id,
                ...data,
                createdAt: data.createdAt?.toDate(),
                updatedAt: data.updatedAt?.toDate(),
            } as MethodologyParameter
        }
        return null
    } catch (error) {
        console.error("Error fetching parameter by id:", error)
        throw new Error("No se pudo cargar el parámetro.")
    }
}

export const createParameter = async (
    parameterData: Omit<MethodologyParameter, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
    try {
        const docRef = await addDoc(collection(db, PARAMETERS_COLLECTION), {
            ...parameterData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        })
        return docRef.id
    } catch (error) {
        console.error("Error creating parameter:", error)
        throw new Error(error instanceof Error ? error.message : "No se pudo crear el parámetro.")
    }
}

export const updateParameter = async (
    id: string,
    parameterData: Partial<Omit<MethodologyParameter, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
    try {
        const docRef = doc(db, PARAMETERS_COLLECTION, id)
        await updateDoc(docRef, {
            ...parameterData,
            updatedAt: serverTimestamp(),
        })
    } catch (error) {
        console.error("Error updating parameter:", error)
        throw new Error(error instanceof Error ? error.message : "No se pudo actualizar el parámetro.")
    }
}

export const deleteParameter = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, PARAMETERS_COLLECTION, id)
        await deleteDoc(docRef)
    } catch (error) {
        console.error("Error deleting parameter:", error)
        throw new Error("No se pudo eliminar el parámetro.")
    }
}

export const duplicateParameter = async (id: string, userId: string): Promise<string> => {
    try {
        const original = await getParameterById(id);
        if (!original) throw new Error("Parámetro original no encontrado");

        const duplicatedData: Omit<MethodologyParameter, 'id' | 'createdAt' | 'updatedAt'> = {
            name: `${original.name} (Copia)`,
            category: original.category,
            level: original.level,
            description: original.description,
            videoUrl: original.videoUrl,
            documentUrl: original.documentUrl,
            tags: original.tags,
            isGlobal: true, // Asumimos que si lo duplica un director, sigue siendo global.
            createdBy: userId
        }

        return await createParameter(duplicatedData);

    } catch (error) {
        console.error("Error duplicating parameter:", error)
        throw new Error("No se pudo duplicar el parámetro.")
    }
}
