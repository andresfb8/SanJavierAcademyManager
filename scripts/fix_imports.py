import re
import os

hooks_import = "import { usePaymentsQuery, useEventPaymentsQuery, usePrivateLessonPaymentsQuery, useAttendanceQuery, useActivitiesQuery, useEvaluationsQuery, useMatchReportsQuery, useInvoicesQuery } from '@/hooks/useQueries'"

pages_dir = 'src/pages'
for filename in os.listdir(pages_dir):
    if not filename.endswith('.tsx') or filename in ['DashboardPage.tsx', 'ActivityLogPage.tsx']:
        continue
        
    filepath = os.path.join(pages_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # If the hooks_import is inside the file but NOT starting at the beginning of a line (or is inside JSX)
    # We will just remove any exact match of hooks_import and re-add it using a safer regex.
    if hooks_import in content:
        content = content.replace(hooks_import + '\n', '')
        content = content.replace(hooks_import, '')
        
        # Find the last real import
        imports = list(re.finditer(r'^import\s+.*$', content, re.MULTILINE))
        if imports:
            last_import = imports[-1]
            insert_pos = last_import.end()
            content = content[:insert_pos] + '\n' + hooks_import + '\n' + content[insert_pos:]
        else:
            content = hooks_import + '\n' + content
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed imports for {filename}")

