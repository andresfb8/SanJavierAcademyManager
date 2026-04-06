import re

with open('src/stores/dataStore.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# Remove addInvoice etc from interface (no semicolon assumption)
text = re.sub(r"\s*addInvoice:.*?\n", "\n", text)
text = re.sub(r"\s*updateInvoice:.*?\n", "\n", text)
text = re.sub(r"\s*deleteInvoice:.*?\n", "\n", text)
text = re.sub(r"\s*unlinkPaymentsFromInvoice:.*?\n", "\n", text)

with open('src/stores/dataStore.ts', 'w', encoding='utf-8') as f:
    f.write(text)

print("TS Cleaned")
