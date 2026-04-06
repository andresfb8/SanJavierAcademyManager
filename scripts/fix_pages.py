import re
import os

hooks_import = "import { usePaymentsQuery, useEventPaymentsQuery, usePrivateLessonPaymentsQuery, useAttendanceQuery, useActivitiesQuery, useEvaluationsQuery, useMatchReportsQuery, useInvoicesQuery } from '@/hooks/useQueries'"

removed_tables = {
    'payments': '  const { data: payments = [] } = usePaymentsQuery(new Date().getFullYear())\n  const { data: _prevPayments = [] } = usePaymentsQuery(new Date().getFullYear() - 1)\n  // payments.push(..._prevPayments)',
    'attendance': '  const { data: attendance = [] } = useAttendanceQuery()',
    'activities': '  const { data: activities = [] } = useActivitiesQuery(2000)',
    'eventPayments': '  const { data: eventPayments = [] } = useEventPaymentsQuery()',
    'privateLessonPayments': '  const { data: privateLessonPayments = [] } = usePrivateLessonPaymentsQuery()',
    'evaluations': '  const { data: evaluations = [] } = useEvaluationsQuery()',
    'matchReports': '  const { data: matchReports = [] } = useMatchReportsQuery()',
    'invoices': '  const { data: invoices = [] } = useInvoicesQuery()'
}

pages_dir = 'src/pages'
for filename in os.listdir(pages_dir):
    if not filename.endswith('.tsx') or filename == 'DashboardPage.tsx' or filename == 'ActivityLogPage.tsx':
        continue
        
    filepath = os.path.join(pages_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Find the dataStore call
    # Handle multiline and single line destructuring
    ds_pattern = r'const\s+\{([^}]+)\}\s*=\s*useDataStore\(\)'
    match = re.search(ds_pattern, content)
    if not match:
        continue
        
    vars_str = match.group(1)
    vars_list = [v.strip() for v in vars_str.split(',')]
    
    kept_vars = []
    removed_vars = []
    for v in vars_list:
        if v in removed_tables:
            removed_vars.append(v)
        elif v != '':
            kept_vars.append(v)
            
    if not removed_vars:
        continue
        
    # Import
    if 'useQueries' not in content:
        # Find a good place to put import - after the last import
        import_end = content.rfind('import')
        import_end = content.find('\n', import_end)
        content = content[:import_end+1] + hooks_import + '\n' + content[import_end+1:]
        
    # Rewrite datastore
    if kept_vars:
        new_ds_str = 'const { ' + ', '.join(kept_vars) + ' } = useDataStore()'
    else:
        new_ds_str = 'const __discardedDataStore = useDataStore()'
        
    hooks_to_inject = '\n' + '\n'.join([removed_tables[r] for r in removed_vars]) + '\n'
    if 'payments' in removed_vars:
        hooks_to_inject = hooks_to_inject.replace('// payments.push(..._prevPayments)', 'payments.push(..._prevPayments)')

    content = content.replace(match.group(0), new_ds_str + hooks_to_inject)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Fixed {filename}")

