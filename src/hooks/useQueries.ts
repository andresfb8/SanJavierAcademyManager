import { useQuery } from '@tanstack/react-query'
import { collection, query, where, getDocs, QueryConstraint } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { fromFirestore } from '@/lib/firestoreSync'
import { normalizeAllPayments, type NormalizedPayment } from '@/lib/payment-utils'
import type { Payment, EventPayment, PrivateLessonPayment, AttendanceRecord, Invoice, Evaluation, MatchReport, Activity } from '@/types'
import { useAuthStore } from '@/stores/authStore'

function getClubId() {
  return useAuthStore.getState().user?.clubId
}

// --- PAYMENTS & INVOICES ---

export function usePaymentsQuery(year: number, month?: number) {
  const clubId = getClubId()
  
  return useQuery({
    queryKey: ['payments', clubId, year, month],
    queryFn: async () => {
      if (!clubId) return []
      
      const constraints: QueryConstraint[] = [
        where('clubId', '==', clubId),
        where('billingYear', '==', year)
      ]
      if (month) constraints.push(where('billingMonth', '==', month))
        
      const q = query(collection(db, 'payments'), ...constraints)
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ ...fromFirestore(d.data()), id: d.id } as Payment))
    },
    enabled: !!clubId
  })
}

export function useEventPaymentsQuery() {
  const clubId = getClubId()
  return useQuery({
    queryKey: ['eventPayments', clubId],
    queryFn: async () => {
      if (!clubId) return []
      const q = query(collection(db, 'eventPayments'), where('clubId', '==', clubId))
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ ...fromFirestore(d.data()), id: d.id } as EventPayment))
    },
    enabled: !!clubId
  })
}

export function usePrivateLessonPaymentsQuery() {
  const clubId = getClubId()
  return useQuery({
    queryKey: ['privateLessonPayments', clubId],
    queryFn: async () => {
      if (!clubId) return []
      const q = query(collection(db, 'privateLessonPayments'), where('clubId', '==', clubId))
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ ...fromFirestore(d.data()), id: d.id } as PrivateLessonPayment))
    },
    enabled: !!clubId
  })
}

export function useNormalizedPaymentsQuery(year: number, month?: number) {
  const paymentsQ = usePaymentsQuery(year, month)
  const eventsQ = useEventPaymentsQuery()
  const privateQ = usePrivateLessonPaymentsQuery()
  
  const isLoading = paymentsQ.isLoading || eventsQ.isLoading || privateQ.isLoading
  const isError = paymentsQ.isError || eventsQ.isError || privateQ.isError

  const data = normalizeAllPayments(
    paymentsQ.data || [],
    eventsQ.data || [],
    privateQ.data || []
  )

  return { data, isLoading, isError, refetch: () => { paymentsQ.refetch(); eventsQ.refetch(); privateQ.refetch(); } }
}

export function useInvoicesQuery(year?: number) {
  const clubId = getClubId()
  return useQuery({
    queryKey: ['invoices', clubId, year],
    queryFn: async () => {
      if (!clubId) return []
      const q = query(collection(db, 'invoices'), where('clubId', '==', clubId))
      const snap = await getDocs(q)
      let allInvoices = snap.docs.map(d => ({ ...fromFirestore(d.data()), id: d.id } as Invoice))
      if (year) {
        allInvoices = allInvoices.filter(inv => {
           const d = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate)
           return d.getFullYear() === year
        })
      }
      return allInvoices
    },
    enabled: !!clubId
  })
}

// --- ATTENDANCE ---

export function useAttendanceQuery(groupId?: string) {
  const clubId = getClubId()
  return useQuery({
    queryKey: ['attendance', clubId, groupId],
    queryFn: async () => {
      if (!clubId) return []
      const constraints: QueryConstraint[] = [where('clubId', '==', clubId)]
      if (groupId) constraints.push(where('groupId', '==', groupId))
      
      const q = query(collection(db, 'attendance'), ...constraints)
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ ...fromFirestore(d.data()), id: d.id } as AttendanceRecord))
    },
    enabled: !!clubId
  })
}

// --- EVALUATIONS & REPORTS ---

export function useEvaluationsQuery(playerId?: string) {
  const clubId = getClubId()
  return useQuery({
    queryKey: ['evaluations', clubId, playerId],
    queryFn: async () => {
      if (!clubId) return []
      const constraints: QueryConstraint[] = [where('clubId', '==', clubId)]
      if (playerId) constraints.push(where('playerId', '==', playerId))
        
      const q = query(collection(db, 'evaluations'), ...constraints)
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ ...fromFirestore(d.data()), id: d.id } as Evaluation))
    },
    enabled: !!clubId
  })
}

export function useMatchReportsQuery(playerId?: string) {
  const clubId = getClubId()
  return useQuery({
    queryKey: ['matchReports', clubId, playerId],
    queryFn: async () => {
      if (!clubId) return []
      const q = query(collection(db, 'matchReports'), where('clubId', '==', clubId))
      const snap = await getDocs(q)
      let reports = snap.docs.map(d => ({ ...fromFirestore(d.data()), id: d.id } as MatchReport))
      if (playerId) {
        reports = reports.filter(r => r.playerIds.includes(playerId))
      }
      return reports
    },
    enabled: !!clubId
  })
}

// --- ACTIVITIES ---
export function useActivitiesQuery(limitCount = 50) {
  const clubId = getClubId()
  return useQuery({
    queryKey: ['activities', clubId, limitCount],
    queryFn: async () => {
      if (!clubId) return []
      const q = query(collection(db, 'activities'), where('clubId', '==', clubId))
      const snap = await getDocs(q)
      const acts = snap.docs.map(d => ({ ...fromFirestore(d.data()), id: d.id } as Activity))
      
      // Sort client-side for simplicity, then slice
      acts.sort((a,b) => {
        const ad = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()
        const bd = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()
        return bd - ad
      })
      return acts.slice(0, limitCount)
    },
    enabled: !!clubId
  })
}
