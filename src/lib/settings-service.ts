import { db } from './firebase'
import {
    collection,
    doc,
    getDocs,
    addDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp,
    Timestamp,
    where
} from 'firebase/firestore'
import { Holiday } from '../types'

const HOLIDAYS_COLLECTION = 'settings_holidays'

export const getHolidays = async (clubId: string): Promise<Holiday[]> => {
    try {
        const q = query(
            collection(db, HOLIDAYS_COLLECTION),
            where('clubId', '==', clubId),
            orderBy('date', 'asc')
        )
        const querySnapshot = await getDocs(q)
        return querySnapshot.docs.map(doc => {
            const data = doc.data()
            return {
                id: doc.id,
                ...data,
                date: data.date?.toDate(),
                createdAt: data.createdAt?.toDate(),
            } as Holiday
        })
    } catch (error) {
        console.error("Error fetching holidays:", error)
        throw new Error("No se pudieron cargar los días festivos.")
    }
}

export const checkIsHoliday = async (clubId: string, targetDate: Date): Promise<boolean> => {
    try {
        const holidays = await getHolidays(clubId)
        const targetStr = targetDate.toISOString().split('T')[0]

        return holidays.some(h => {
            const hStr = h.date.toISOString().split('T')[0]
            return hStr === targetStr
        })
    } catch (error) {
        console.error("Error checking holiday:", error)
        return false // fail safe
    }
}

export const addHoliday = async (clubId: string, date: Date, description?: string): Promise<string> => {
    try {
        const docRef = await addDoc(collection(db, HOLIDAYS_COLLECTION), {
            clubId,
            date: Timestamp.fromDate(date),
            description: description || '',
            createdAt: serverTimestamp(),
        })
        return docRef.id
    } catch (error) {
        console.error("Error adding holiday:", error)
        throw new Error("No se pudo añadir el día festivo.")
    }
}

export const deleteHoliday = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, HOLIDAYS_COLLECTION, id)
        await deleteDoc(docRef)
    } catch (error) {
        console.error("Error deleting holiday:", error)
        throw new Error("No se pudo eliminar el día festivo.")
    }
}
