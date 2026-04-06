import { collection, query, where, getDocs, QueryConstraint } from 'firebase/firestore'
import { db } from '../firebase'
import { fromFirestore } from '../firestoreSync'
import type { Payment, EventPayment, PrivateLessonPayment } from '@/types'

export type FetchParams = {
  clubId: string
  year: number
  month?: number // if not provided, fetches whole year (e.g. for annual view)
}

export async function fetchPayments({ clubId, year, month }: FetchParams): Promise<Payment[]> {
  const constraints: QueryConstraint[] = [
    where('clubId', '==', clubId),
    where('billingYear', '==', year)
  ]
  if (month) {
    constraints.push(where('billingMonth', '==', month))
  }
  
  const q = query(collection(db, 'payments'), ...constraints)
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ ...fromFirestore(d.data()), id: d.id } as Payment))
}

export async function fetchEventPayments({ clubId, year, month }: FetchParams): Promise<EventPayment[]> {
  const constraints: QueryConstraint[] = [
    where('clubId', '==', clubId),
    // Event payments usually have an eventDate, so we might need a workaround for month/year unless they also have billingMonth/billingYear
    // But normalized queries rely on eventDate generally? Let's check the type.
  ]
  
  // NOTE: eventPayments might not have billingYear. If not, we just fetch all for the club for now, or filter client-side.
  // Actually, 'normalizeAllPayments' expects `eventPayments` and normalizes them. Let's fetch them based on clubId.
  // Since eventPayments are smaller in volume per month, we can fetch year.
  // We'll rely on clubId and filter locally for now to avoid breaking schema.
  const q = query(collection(db, 'eventPayments'), ...constraints)
  const snapshot = await getDocs(q)
  
  const allEvents = snapshot.docs.map(d => ({ ...fromFirestore(d.data()), id: d.id } as EventPayment))
  
  // Client-side filter to avoid complex index creation right now
  return allEvents.filter(p => {
    const d = new Date(p.createdAt) // fallback if no specific date
    const dYear = d.getFullYear()
    const dMonth = d.getMonth() + 1
    if (year && dYear !== year) return false
    if (month && dMonth !== month) return false
    return true
  })
}

export async function fetchPrivateLessonPayments({ clubId, year, month }: FetchParams): Promise<PrivateLessonPayment[]> {
  const q = query(collection(db, 'privateLessonPayments'), where('clubId', '==', clubId))
  const snapshot = await getDocs(q)
  
  const allLessons = snapshot.docs.map(d => ({ ...fromFirestore(d.data()), id: d.id } as PrivateLessonPayment))
  
  // Client-side filter
  return allLessons.filter(p => {
    const d = new Date(p.createdAt)
    const dYear = d.getFullYear()
    const dMonth = d.getMonth() + 1
    if (year && dYear !== year) return false
    if (month && dMonth !== month) return false
    return true
  })
}
