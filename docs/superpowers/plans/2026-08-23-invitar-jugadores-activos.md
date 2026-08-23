# Invitar jugadores activos sin acceso al portal — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un botón "Invitar jugadores" en Gestión de Usuarios que abre una lista revisable de jugadores activos, no menores, sin acceso al portal ni invitación pendiente, y los invita en bloque con un solo clic de confirmación.

**Architecture:** Un helper puro y testeado (`getInvitablePlayers`) calcula la lista de candidatos reutilizando `getPlayerPortalStatus` ya existente. Un nuevo componente `InvitePlayersDialog.tsx`, calcado de `BulkTutorInviteDialog.tsx`, consume ese helper y gestiona la selección, el envío y la pantalla de resultado. `UsersPage.tsx` solo añade el botón que lo abre.

**Tech Stack:** React 19 + TypeScript, Zustand (`useDataStore`), Vitest para el helper puro.

---

### Task 1: Helper `getInvitablePlayers` (TDD)

**Files:**
- Modify: `src/lib/player-portal-status.ts`
- Test: `src/lib/player-portal-status.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Añade este `describe` al final de `src/lib/player-portal-status.test.ts` (después del `describe('getPlayerPortalStatus', ...)` existente, antes del cierre del archivo), y añade `getInvitablePlayers` al import de la línea 2:

```ts
import { getPlayerPortalStatus, getInvitablePlayers } from '@/lib/player-portal-status'
```

```ts
describe('getInvitablePlayers', () => {
  it('incluye a un jugador activo, no menor, con email, sin acceso al portal', () => {
    const player = makePlayer({ status: 'activo', isMinor: false })
    expect(getInvitablePlayers([player], [], [], NOW)).toEqual([player])
  })

  it('excluye a un jugador que no está activo (baja o lista de espera)', () => {
    const player = makePlayer({ status: 'baja', isMinor: false })
    expect(getInvitablePlayers([player], [], [], NOW)).toEqual([])
  })

  it('excluye a un menor de edad', () => {
    const player = makePlayer({ status: 'activo', isMinor: true })
    expect(getInvitablePlayers([player], [], [], NOW)).toEqual([])
  })

  it('excluye a un jugador sin email', () => {
    const player = makePlayer({ status: 'activo', isMinor: false, email: '' })
    expect(getInvitablePlayers([player], [], [], NOW)).toEqual([])
  })

  it('excluye a un jugador que ya tiene cuenta de portal', () => {
    const player = makePlayer({ status: 'activo', isMinor: false })
    const users = [makeUser({ linkedPlayerId: 'p1' })]
    expect(getInvitablePlayers([player], users, [], NOW)).toEqual([])
  })

  it('excluye a un jugador con invitación pendiente y vigente', () => {
    const player = makePlayer({ status: 'activo', isMinor: false })
    const invitations = [makeInvitation()]
    expect(getInvitablePlayers([player], [], invitations, NOW)).toEqual([])
  })

  it('filtra dentro de una lista con varios jugadores', () => {
    const eligible = makePlayer({ id: 'p1', status: 'activo', isMinor: false })
    const minor = makePlayer({ id: 'p2', status: 'activo', isMinor: true })
    const inactive = makePlayer({ id: 'p3', status: 'baja', isMinor: false })
    expect(getInvitablePlayers([eligible, minor, inactive], [], [], NOW)).toEqual([eligible])
  })
})
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

Run: `npm test -- player-portal-status`
Expected: FAIL — `getInvitablePlayers` no está exportado por `@/lib/player-portal-status` (error de tipo/import, o `TypeError: getInvitablePlayers is not a function`).

- [ ] **Step 3: Implementar `getInvitablePlayers`**

Añade esta función al final de `src/lib/player-portal-status.ts`:

```ts
/**
 * Jugadores candidatos a una invitación en bloque al portal: activos, no
 * menores de edad (los menores se invitan por la vía del tutor, con su
 * propio email, no por aquí), con email propio, y sin cuenta ni invitación
 * pendiente todavía.
 */
export function getInvitablePlayers(
  players: Player[],
  users: AppUser[],
  invitations: Invitation[],
  now: Date = new Date()
): Player[] {
  return players.filter(
    (p) =>
      p.status === 'activo' &&
      !p.isMinor &&
      p.email !== '' &&
      getPlayerPortalStatus(p, users, invitations, now) === 'sin_acceso'
  )
}
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

Run: `npm test -- player-portal-status`
Expected: PASS — todos los tests de `getPlayerPortalStatus` (ya existentes) y `getInvitablePlayers` (nuevos) en verde.

- [ ] **Step 5: Commit**

```bash
git add src/lib/player-portal-status.ts src/lib/player-portal-status.test.ts
git commit -m "feat: añadir getInvitablePlayers para invitación masiva de jugadores"
```

---

### Task 2: Componente `InvitePlayersDialog`

**Files:**
- Create: `src/components/shared/InvitePlayersDialog.tsx`

- [ ] **Step 1: Crear el componente**

Crea `src/components/shared/InvitePlayersDialog.tsx` con este contenido completo:

```tsx
import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import { createInvitation } from '@/lib/invitations'
import { sendInvitationEmail } from '@/lib/emailService'
import { getInvitablePlayers } from '@/lib/player-portal-status'
import { Copy, Check, Gamepad2, AlertCircle } from 'lucide-react'

interface PlayerCandidate {
  id: string
  name: string
  email: string
}

interface InviteResult {
  id: string
  name: string
  email: string
  activationUrl?: string
  emailed?: boolean
  error?: boolean
}

interface InvitePlayersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Invitación masiva de jugadores: detecta jugadores activos, no menores, con
 * email propio, que todavía no tienen acceso al portal ni invitación
 * pendiente, y crea las invitaciones en bloque con rol 'jugador'.
 */
export function InvitePlayersDialog({ open, onOpenChange }: InvitePlayersDialogProps) {
  const { players, invitations, users } = useDataStore()
  const { user } = useAuthStore()

  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<InviteResult[] | null>(null)
  const [copiedId, setCopiedId] = useState('')

  const candidates = useMemo<PlayerCandidate[]>(() => {
    return getInvitablePlayers(players, users, invitations)
      .map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, email: p.email }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [players, users, invitations])

  // Por defecto todos los candidatos están seleccionados
  const effectiveSelection = selectedIds ?? new Set(candidates.map((c) => c.id))

  function toggleCandidate(id: string) {
    const next = new Set(effectiveSelection)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  function handleClose() {
    onOpenChange(false)
    setSelectedIds(null)
    setResults(null)
    setSubmitting(false)
    setCopiedId('')
  }

  async function handleSubmit() {
    const selected = candidates.filter((c) => effectiveSelection.has(c.id))
    if (selected.length === 0) return
    setSubmitting(true)

    const outcome: InviteResult[] = []
    for (const candidate of selected) {
      try {
        const { activationUrl } = await createInvitation({
          email: candidate.email,
          role: 'jugador',
          clubId: user?.clubId ?? 'club-001',
          createdBy: user?.id ?? 'unknown',
          linkedPlayerId: candidate.id,
        })

        let emailed = false
        try {
          await sendInvitationEmail({ name: candidate.name, email: candidate.email }, activationUrl, 'jugador')
          emailed = true
        } catch (emailErr) {
          console.error(`No se pudo enviar el correo a ${candidate.email}:`, emailErr)
        }

        outcome.push({ id: candidate.id, name: candidate.name, email: candidate.email, activationUrl, emailed })
      } catch (err) {
        console.error(`Error creando la invitación para ${candidate.email}:`, err)
        outcome.push({ id: candidate.id, name: candidate.name, email: candidate.email, error: true })
      }
    }

    setResults(outcome)
    setSubmitting(false)
  }

  function handleCopyLink(result: InviteResult) {
    if (!result.activationUrl) return
    navigator.clipboard.writeText(result.activationUrl).then(() => {
      setCopiedId(result.id)
      setTimeout(() => setCopiedId(''), 2000)
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-primary" />
            Invitar jugadores
          </DialogTitle>
          <DialogDescription>
            Jugadores activos, no menores de edad, con email propio, sin cuenta ni invitación pendiente.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {results.filter((r) => r.emailed).length} de {results.length} correos enviados
            </p>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {results.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                  {!r.error && (
                    r.emailed ? (
                      <p className="text-[11px] font-medium text-emerald-600">Correo enviado</p>
                    ) : (
                      <p className="text-[11px] font-medium text-amber-600">Sin enviar — copia el enlace</p>
                    )
                  )}
                </div>
                {r.error ? (
                  <Badge variant="destructive" className="shrink-0">
                    <AlertCircle className="h-3 w-3 mr-1" /> Error
                  </Badge>
                ) : (
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => handleCopyLink(r)}>
                    {copiedId === r.id ? (
                      <><Check className="h-4 w-4 mr-1 text-emerald-600" /> Copiado</>
                    ) : (
                      <><Copy className="h-4 w-4 mr-1" /> Copiar enlace</>
                    )}
                  </Button>
                )}
              </div>
            ))}
            </div>
          </div>
        ) : candidates.length === 0 ? (
          <div className="py-8 text-center">
            <Gamepad2 className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              No hay jugadores pendientes de invitar
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Todos los jugadores activos ya tienen cuenta o invitación pendiente.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {candidates.map((candidate) => (
              <label
                key={candidate.id}
                className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/40 transition-colors"
              >
                <Checkbox
                  checked={effectiveSelection.has(candidate.id)}
                  onCheckedChange={() => toggleCandidate(candidate.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{candidate.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{candidate.email}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          {results ? (
            <Button onClick={handleClose}>Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={submitting}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || candidates.length === 0 || effectiveSelection.size === 0}
              >
                {submitting
                  ? 'Creando invitaciones...'
                  : `Invitar ${effectiveSelection.size} jugador${effectiveSelection.size !== 1 ? 'es' : ''}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: éxito, sin errores de TypeScript. El componente no lo importa nadie todavía, así que no cambia el resultado del bundle salvo por el nuevo archivo.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/InvitePlayersDialog.tsx
git commit -m "feat: añadir InvitePlayersDialog para invitar jugadores en bloque"
```

---

### Task 3: Conectar el botón en Gestión de Usuarios

**Files:**
- Modify: `src/pages/UsersPage.tsx`

- [ ] **Step 1: Añadir el import**

En `src/pages/UsersPage.tsx:12`, justo debajo del import de `BulkTutorInviteDialog`:

```tsx
import { BulkTutorInviteDialog } from '@/components/shared/BulkTutorInviteDialog'
import { InvitePlayersDialog } from '@/components/shared/InvitePlayersDialog'
```

- [ ] **Step 2: Añadir el estado del diálogo**

En `src/pages/UsersPage.tsx:55`, justo debajo de `showBulkTutorDialog`:

```tsx
  const [showBulkTutorDialog, setShowBulkTutorDialog] = useState(false)
  const [showInvitePlayersDialog, setShowInvitePlayersDialog] = useState(false)
```

- [ ] **Step 3: Añadir el botón en la cabecera**

En `src/pages/UsersPage.tsx:420-424`, el bloque actual es:

```tsx
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowBulkTutorDialog(true)}>
            <Users className="h-4 w-4 mr-2" />
            Invitar tutores
          </Button>
          <Button onClick={handleOpenDialog}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invitar usuario
          </Button>
        </div>
```

Cámbialo a (nuevo botón entre los dos existentes):

```tsx
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowBulkTutorDialog(true)}>
            <Users className="h-4 w-4 mr-2" />
            Invitar tutores
          </Button>
          <Button variant="outline" onClick={() => setShowInvitePlayersDialog(true)}>
            <Gamepad2 className="h-4 w-4 mr-2" />
            Invitar jugadores
          </Button>
          <Button onClick={handleOpenDialog}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invitar usuario
          </Button>
        </div>
```

`Gamepad2` ya está importado en la línea 19 de este archivo — no hace falta añadirlo.

- [ ] **Step 4: Montar el diálogo**

En `src/pages/UsersPage.tsx:754-757`, el bloque actual es:

```tsx
      <BulkTutorInviteDialog
        open={showBulkTutorDialog}
        onOpenChange={setShowBulkTutorDialog}
      />
```

Cámbialo a:

```tsx
      <BulkTutorInviteDialog
        open={showBulkTutorDialog}
        onOpenChange={setShowBulkTutorDialog}
      />

      <InvitePlayersDialog
        open={showInvitePlayersDialog}
        onOpenChange={setShowInvitePlayersDialog}
      />
```

- [ ] **Step 5: Verificar que compila y que los tests siguen en verde**

Run: `npm run build`
Expected: éxito, sin errores de TypeScript.

Run: `npm test`
Expected: todos los test files en verde, incluyendo los nuevos de `getInvitablePlayers` (Task 1). Nota: en este entorno Windows, si justo después de un build `npm test` muestra "Tests: no tests" con 0 ejecutados, es un glitch transitorio conocido — repite `npm test` una vez más antes de asumir que algo está roto de verdad.

- [ ] **Step 6: Commit**

```bash
git add src/pages/UsersPage.tsx
git commit -m "feat: conectar el boton de invitar jugadores en Gestion de Usuarios"
```

---

### Task 4: Verificación manual

**Files:** ninguno (solo prueba en el navegador con el servidor de desarrollo)

- [ ] **Step 1: Arrancar el servidor de desarrollo**

Run: `npm run dev`
Expected: `VITE ... ready`, servidor en `http://localhost:5173/`.

- [ ] **Step 2: Recorrer el checklist de la spec**

Con sesión de `director` o `coordinador`, entrar en "Gestión de Usuarios" y comprobar, en este orden (usando datos reales o de prueba del club):

1. El botón "Invitar jugadores" aparece entre "Invitar tutores" e "Invitar usuario".
2. Con al menos un jugador activo, no menor, con email, sin invitación ni cuenta: al abrir el diálogo aparece en la lista, marcado por defecto.
3. Un jugador menor de edad en las mismas condiciones NO aparece en la lista.
4. Un jugador activo con invitación pendiente (visible como "Invitado" en el filtro de Portal de la página Jugadores) NO aparece en la lista.
5. Un jugador activo que ya tiene cuenta de portal NO aparece en la lista.
6. Un jugador de baja o en lista de espera NO aparece en la lista.
7. Desmarcar un jugador de la lista y confirmar: solo se invita a los que quedaron marcados (comprobar en la pestaña "Invitaciones" de esta misma página que solo hay invitación nueva para los marcados).
8. Tras confirmar, la pantalla de resultado muestra el estado real por jugador (enviado / sin enviar con botón de copiar enlace / error).
9. Cerrar y volver a abrir el diálogo: los jugadores recién invitados ya no aparecen como candidatos (su estado pasó a "invitado").

Si algún punto falla, anotar cuál y no continuar con el `finishing-a-development-branch` hasta resolverlo.

- [ ] **Step 3: Parar el servidor de desarrollo**

Detener el proceso de `npm run dev` una vez terminada la verificación.
