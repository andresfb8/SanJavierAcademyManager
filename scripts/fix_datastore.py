import re

file_path = "src/stores/dataStore.ts"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Instead of complex regex, we can replace the specific `set` calls for the removed arrays.
# For example: set((state) => ({ payments: [...state.payments, newPayment] }))
# We want to remove the set() call if it updates only historical arrays, or strip those properties if mixed.

collections_to_remove = ["payments", "attendance", "activities", "eventPayments", "privateLessonPayments", "evaluations", "matchReports", "invoices"]

# A more robust way to handle it is just doing manual regex replacements for each specific CRUD function body.
# Let's define the regexes for `set((state) => ({ payments: ... }))`
for col in collections_to_remove:
    # Match: set((state) => ({ payments: [...state.payments, x] }))
    content = re.sub(r"set\(\(\w+\)\s*=>\s*\(\{\s*" + col + r":\s*\[\.\.\.\w+\." + col + r",[^\]]+\]\s*\}\)\)", r"", content)
    # Match: set((state) => ({ payments: state.payments.map(...) }))
    content = re.sub(r"set\(\(.*?\)\s*=>\s*\(\{\s*" + col + r":[^}]+\}\)\)", r"", content, flags=re.DOTALL)
    # Match: set((state) => ({ payments: state.payments.filter(...) }))
    content = re.sub(r"set\(\(\w+\)\s*=>\s*\(\{\s*" + col + r":\s*\w+\." + col + r"\.filter\([^}]+\}\)\)", r"", content, flags=re.DOTALL)

# Now, we must add `queryClient.invalidateQueries({ queryKey: ['col'] })` where syncDoc was called for these.
for col in collections_to_remove:
    # If we see: syncDoc('payments', ...
    content = re.sub(r"(syncDoc(?:WithRetry)?\('" + col + r"',.*?\))", r"\1\n      queryClient.invalidateQueries({ queryKey: ['" + col + r"'] })", content)
    content = re.sub(r"(deleteFirestoreDoc\('" + col + r"',.*?\))", r"\1\n      queryClient.invalidateQueries({ queryKey: ['" + col + r"'] })", content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Regex replacements done.")
