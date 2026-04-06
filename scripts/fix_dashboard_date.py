import re

with open('src/pages/DashboardPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add standard date vars before usePaymentsQuery
date_vars = """
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
"""
content = re.sub(
    r"(\s*const \{\s*data:\s*paymentsCurrentYear = \[\] \} = usePaymentsQuery\(currentYear\))",
    date_vars + r"\1",
    content
)

with open('src/pages/DashboardPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed Dashboard dates")
