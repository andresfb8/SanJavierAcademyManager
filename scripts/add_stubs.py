import re

missing_funcs = [
    "addAttendanceRecord", "updateAttendanceRecord",
    "addInvoice", "updateInvoice", "unlinkPaymentsFromInvoice", "deleteInvoice",
    "addHolidayStore", "deleteHolidayStore",
    "updateInvitation", "addInvitation", "deleteInvitation",
    "addPrivateLesson", "updatePrivateLesson", "deletePrivateLesson",
    "addPrivateLessonPayment", "updatePrivateLessonPayment",
    "addEvent", "updateEvent", "deleteEvent", "addEventPayment", "updateEventPayment",
    "updateCoachSalaryConfig",
    "addEvaluation", "deleteEvaluation",
    "addMatchReport", "deleteMatchReport",
    "addActivity"
]

with open('src/stores/dataStore.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add to DataState interface
interface_addition = "\n".join([f"  {fn}: (...args: any[]) => any" for fn in missing_funcs])
content = content.replace("  // --- Invoices ---\n}", f"  // --- Invoices ---\n{interface_addition}\n}}")

# Add to create()
impl_addition = "\n".join([f"      {fn}: (...args: any[]) => {{}}," for fn in missing_funcs])
content = content.replace("      deleteAllPayments: async () => {},", f"      deleteAllPayments: async () => {{}},\n{impl_addition}")

with open('src/stores/dataStore.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Stubs added")
