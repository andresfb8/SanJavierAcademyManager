with open('src/stores/dataStore.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the map syntax error
old_syntax = """              await Promise.all(
                paymentsToDelete.map(p => deleteFirestoreDoc('payments', p.id)
        queryClient.invalidateQueries({ queryKey: ['payments'] });)
              )"""

new_syntax = """              await Promise.all(
                paymentsToDelete.map(p => deleteFirestoreDoc('payments', p.id))
              )
              queryClient.invalidateQueries({ queryKey: ['payments'] });"""

content = content.replace(old_syntax, new_syntax)

# Also fix the partialize section, replacing the whole partialize body
import re
# We just need to find `partialize: (state) => ({` and extract everything until `} as unknown as DataState)`
pattern = re.compile(r'partialize:\s*\(state\)\s*=>\s*\(\{(.*?)\}\s*as\s*unknown\s*as\s*DataState\)', re.DOTALL)
new_partialize = """partialize: (state) => ({
        club: state.club,
        courts: state.courts,
        tariffs: state.tariffs,
        players: state.players,
        coaches: state.coaches,
        groups: state.groups,
        enrollments: state.enrollments,
        privateLessons: state.privateLessons,
        invitations: state.invitations,
        events: state.events,
        coachSalaryConfigs: state.coachSalaryConfigs,
        users: state.users,
        holidays: state.holidays,
      } as unknown as DataState)"""

content = pattern.sub(new_partialize, content)

with open('src/stores/dataStore.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Syntax fixes applied.")
