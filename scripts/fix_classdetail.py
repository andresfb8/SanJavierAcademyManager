import re

with open('src/pages/ClassDetailPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

hooks_import = "import { usePaymentsQuery, useEventPaymentsQuery, usePrivateLessonPaymentsQuery, useAttendanceQuery, useActivitiesQuery, useEvaluationsQuery, useMatchReportsQuery, useInvoicesQuery } from '@/hooks/useQueries'"

# Remove any occurrence of the hooks import
content = content.replace(hooks_import + '\n', '')
content = content.replace(hooks_import, '')

# Prepend it to the start of the file or top
content = hooks_import + '\n' + content

with open('src/pages/ClassDetailPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed ClassDetailPage")
