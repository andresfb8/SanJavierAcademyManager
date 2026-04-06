import re

with open('src/lib/dataLoader.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fields to remove from dataLoader.ts
fields_to_remove = [
    "payments",
    "attendance",
    "activities",
    "eventPayments",
    "privateLessonPayments",
    "evaluations",
    "matchReports",
    "invoices"
]

for field in fields_to_remove:
    # 1. Remove from destructuring array
    content = re.sub(r'^\s*' + field + r',\s*\n', '', content, flags=re.MULTILINE)
    
    # 2. Remove from loadCollection calls
    content = re.sub(r'^\s*loadCollection<.*?>\(\'' + field + r'\', clubId\),\s*\n', '', content, flags=re.MULTILINE)
    
    # 3. Remove from collections migration array
    # { name: 'payments', items: state.payments ... },
    content = re.sub(r'^\s*\{\s*name:\s*\'' + field + r'\'.*?\n', '', content, flags=re.MULTILINE)

with open('src/lib/dataLoader.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed fields from dataLoader.ts")
