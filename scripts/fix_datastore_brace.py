import re

with open('src/stores/dataStore.ts', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('  // --- Invoices ---\n\nconst defaultClub', '  // --- Invoices ---\n}\n\nconst defaultClub')

with open('src/stores/dataStore.ts', 'w', encoding='utf-8') as f:
    f.write(text)

print("Added }")
