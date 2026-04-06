import re

with open('src/stores/authStore.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fields to remove from authStore.ts
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
    # 1. Remove from clearDataStore
    content = re.sub(r'^\s*' + field + r':\s*\[\],\s*\n', '', content, flags=re.MULTILINE)

with open('src/stores/authStore.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed fields from authStore.ts")
