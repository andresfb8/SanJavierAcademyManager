import re

with open('src/pages/DashboardPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add imports
content = re.sub(
    r"import { normalizeAllPayments } from '@/lib/payment-utils'",
    "import { normalizeAllPayments } from '@/lib/payment-utils'\nimport { usePaymentsQuery, useEventPaymentsQuery, usePrivateLessonPaymentsQuery, useAttendanceQuery, useActivitiesQuery } from '@/hooks/useQueries'",
    content
)

# 2. Modify useDataStore destructuring
content = re.sub(
    r"const { players, payments, groups, activities, enrollments, attendance, eventPayments, privateLessonPayments, coaches, privateLessons, cleanupOrphanedPayments } = useDataStore\(\)",
    "const { players, groups, enrollments, coaches, privateLessons } = useDataStore()",
    content
)

# 3. Insert React Query hooks right after dataStore
hooks = """
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear

  const { data: paymentsCurrentYear = [] } = usePaymentsQuery(currentYear)
  const { data: paymentsPrevYear = [] } = usePaymentsQuery(currentYear - 1)
  const payments = [...paymentCurrentYear, ...paymentsPrevYear]
  
  const { data: eventPayments = [] } = useEventPaymentsQuery()
  const { data: privateLessonPayments = [] } = usePrivateLessonPaymentsQuery()
  const { data: attendance = [] } = useAttendanceQuery()
  const { data: activities = [] } = useActivitiesQuery(100)
"""
# Replace paymentCurrentYear with paymentsCurrentYear in the script code
hooks = hooks.replace('paymentCurrentYear', 'paymentsCurrentYear')

content = re.sub(
    r"const { players, groups, enrollments, coaches, privateLessons } = useDataStore\(\)",
    "const { players, groups, enrollments, coaches, privateLessons } = useDataStore()\n  " + hooks.strip(),
    content
)

# 4. Remove useEffect with cleanupOrphanedPayments
content = re.sub(
    r"useEffect\(\(\) => \{\n\s*cleanupOrphanedPayments\(\)\n\s*\}, \[cleanupOrphanedPayments\]\)",
    "",
    content
)

# 5. Fix now, currentMonth, currentYear redeclaration
content = re.sub(
    r"  const now = new Date\(\)\n  const currentMonth = now\.getMonth\(\) \+ 1\n  const currentYear = now\.getFullYear\(\)\n  const prevMonth = currentMonth === 1 \? 12 : currentMonth - 1\n  const prevYear = currentMonth === 1 \? currentYear - 1 : currentYear\n",
    "",  # Since we moved it up before. Wait, wait, actually I should just carefully replace the second declaration.
    content,
    count=1
)

with open('src/pages/DashboardPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated DashboardPage.tsx")
