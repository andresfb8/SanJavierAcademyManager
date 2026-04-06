with open('src/stores/dataStore.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(r"\n", "\n")

with open('src/stores/dataStore.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Fix applied.")
