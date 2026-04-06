import re

with open('src/stores/dataStore.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix attendance errors:
# 1. 
# const duplicate = false; // 
# ([] as any[]).find((a: any) => {
# ... returning a.groupId === recordData.groupId && d === recordDateStr
# })
# if (duplicate) { ... duplicate.id } -> duplicate could be type boolean from the `false` if the next array was comma-separated or missing a variable assignment!
# Let's just remove that duplicate logic!
duplicate_logic = r"        const duplicate = false;.*?if \(duplicate\) \{.*?return\n\s*\}"
content = re.sub(duplicate_logic, "", content, flags=re.MULTILINE | re.DOTALL)

# 2. AddAttendance updating attendance and players
# Wait, let's just make the entire addAttendanceRecord, updateAttendanceRecord, deleteAttendanceRecord empty bodies, or at least just syncDoc and return!
# Because attendance is fetched directly directly from Firebase via React Query, we only need to sync it to Firebase and returning.
add_attn = r"      addAttendanceRecord: \(recordData\) => \{.*?\n      updateAttendanceRecord:"
add_attn_new = """      addAttendanceRecord: (recordData) => {
        const clubId = getClubId()
        const newRecord: AttendanceRecord = { ...recordData, id: generateId(), createdAt: new Date() }
        if (clubId) syncDoc('attendance', newRecord.id, newRecord as any, clubId)
        queryClient.invalidateQueries({ queryKey: ['attendance'] })
      },
      updateAttendanceRecord:"""
content = re.sub(add_attn, add_attn_new, content, flags=re.MULTILINE | re.DOTALL)

upd_attn = r"      updateAttendanceRecord: \(id, updates\) => \{.*?\n      deleteAttendanceRecord:"
upd_attn_new = """      updateAttendanceRecord: (id, updates) => {
        const clubId = getClubId()
        if (clubId) syncDoc('attendance', id, { ...updates, updatedAt: new Date() } as any, clubId)
        queryClient.invalidateQueries({ queryKey: ['attendance'] })
      },
      deleteAttendanceRecord:"""
content = re.sub(upd_attn, upd_attn_new, content, flags=re.MULTILINE | re.DOTALL)

del_attn = r"      deleteAttendanceRecord: \(id\) => \{.*?\n      addActivity:"
del_attn_new = """      deleteAttendanceRecord: (id) => {
        deleteFirestoreDoc('attendance', id)
        queryClient.invalidateQueries({ queryKey: ['attendance'] })
      },
      addActivity:"""
content = re.sub(del_attn, del_attn_new, content, flags=re.MULTILINE | re.DOTALL)

with open('src/stores/dataStore.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Applied dataStore.ts fixes")
