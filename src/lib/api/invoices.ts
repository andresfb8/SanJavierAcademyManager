import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { fromFirestore } from '../firestoreSync'
import type { Invoice } from '@/types'

export async function fetchInvoices(clubId: string, year?: number): Promise<Invoice[]> {
  const q = query(
    collection(db, 'invoices'),
    where('clubId', '==', clubId)
  )
  const snapshot = await getDocs(q)
  const allInvoices = snapshot.docs.map(d => ({ ...fromFirestore(d.data()), id: d.id } as Invoice))
  
  if (year) {
    return allInvoices.filter(inv => {
      const date = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
      return date.getFullYear() === year;
    })
  }

  return allInvoices
}
