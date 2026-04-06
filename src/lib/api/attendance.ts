import { collection, query, where, getDocs, QueryConstraint } from 'firebase/firestore'
import { db } from '../firebase'
import { fromFirestore } from '../firestoreSync'
import type { AttendanceRecord } from '@/types'

export async function fetchAttendance(clubId: string, groupId?: string): Promise<AttendanceRecord[]> {
  const constraints: QueryConstraint[] = [
    where('clubId', '==', clubId)
  ]
  if (groupId) {
    constraints.push(where('groupId', '==', groupId))
  }
  
  const q = query(collection(db, 'attendance'), ...constraints)
  const snapshot = await getDocs(q)
  
  return snapshot.docs.map(d => ({ ...fromFirestore(d.data()), id: d.id } as AttendanceRecord))
}
