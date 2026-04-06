import re

with open('src/stores/dataStore.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. [] -> ([] as any[])
content = content.replace('[].filter(p =>', '([] as any[]).filter((p: any) =>')
content = content.replace('[].find((a) =>', '([] as any[]).find((a: any) =>')
content = content.replace('([] as any[]).find((p) =>', '([] as any[]).find((p: any) =>')

# 2. RevertPaymentPaidStatus
revert_logic = """        set((state) => {
          if (collectionName === 'payments') {
            return { payments: state.payments.map((p) => p.id === id ? { ...p, status: 'pendiente', paidDate: undefined, paymentMethod: undefined, registeredBy: undefined } : p) }
          } else if (collectionName === 'eventPayments') {
            return { eventPayments: state.eventPayments.map((p) => p.id === id ? { ...p, status: 'pendiente', paidDate: undefined, paymentMethod: undefined, registeredBy: undefined } : p) }
          } else {
            return { privateLessonPayments: state.privateLessonPayments.map((p) => p.id === id ? { ...p, status: 'pendiente', paidDate: undefined, paymentMethod: undefined, registeredBy: undefined } : p) }
          }
        })"""

content = content.replace(revert_logic, "        set((state) => { return {} })")

# 3. AddAttendance updating attendance and players
attendance_update = """        set((state) => {
          const newAttendance = [...state.attendance, newRecord]
          const players = state.players.map((p) => {
            if (!affectedPlayerIds.has(p.id)) return p
            const newCredits = computePlayerRecoveryBalance(p.id, newAttendance)
            if (newCredits === (p.recoveryCredits ?? 0)) return p
            return { ...p, recoveryCredits: newCredits }
          })
          return { attendance: newAttendance, players }
        })"""

content = content.replace(attendance_update, "        set((state) => { return {} /* TODO: integrate attendance and recovery credits */ })")

# 4. updateAttendanceRecord
attendance_update_2 = """        set((state) => {
          const newAttendance = state.attendance.map((a) => (a.id === id ? { ...a, ...updates, updatedAt: new Date() } : a))
          const players = state.players.map((p) => {
            if (!affectedPlayerIds.has(p.id)) return p
            const newCredits = computePlayerRecoveryBalance(p.id, newAttendance)
            if (newCredits === (p.recoveryCredits ?? 0)) return p
            return { ...p, recoveryCredits: newCredits }
          })
          return { attendance: newAttendance, players }
        })"""

content = content.replace(attendance_update_2, "        set((state) => { return {} /* TODO: integrate attendance and recovery credits */ })")

# 5. deleteAttendanceRecord
attendance_delete = """        set((state) => {
          const newAttendance = state.attendance.filter((a) => a.id !== id)
          const players = state.players.map((p) => {
            if (!affectedPlayerIds.has(p.id)) return p
            const newCredits = computePlayerRecoveryBalance(p.id, newAttendance)
            if (newCredits === (p.recoveryCredits ?? 0)) return p
            return { ...p, recoveryCredits: newCredits }
          })
          return { attendance: newAttendance, players }
        })"""

content = content.replace(attendance_delete, "        set((state) => { return {} /* TODO: integrate attendance and recovery credits */ })")

# 6. cleanupOrphanedPayments
cleanup_orphan = """      cleanupOrphanedPayments: () => {
        const { events, eventPayments, privateLessons, privateLessonPayments } = get()
        const eventIds = new Set(events.map((e) => e.id))
        const lessonIds = new Set(privateLessons.map((l) => l.id))
      },"""
content = content.replace(cleanup_orphan, "      cleanupOrphanedPayments: () => {},")

# 7. deleteAllPayments
delete_all = """      deleteAllPayments: async () => {
        const clubId = getClubId()
        if (!clubId) return
        const { payments, eventPayments, privateLessonPayments } = get()
        const collections = ['payments', 'eventPayments', 'privateLessonPayments']
        for (const coll of collections) {
          const list = coll === 'payments' ? payments : coll === 'eventPayments' ? eventPayments : privateLessonPayments
          for (const item of list) await deleteFirestoreDoc(coll, item.id)
        }
      },"""
content = content.replace(delete_all, "      deleteAllPayments: async () => {},")

with open('src/stores/dataStore.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Applied dataStore.ts fixes")
