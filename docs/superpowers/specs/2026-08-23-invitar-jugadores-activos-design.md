# Invitar jugadores activos sin acceso al portal — Diseño

**Fecha:** 2026-08-23
**Estado:** aprobado, pendiente de plan de implementación

## Contexto

El usuario quiere una forma rápida de invitar al portal a los jugadores activos que
todavía no tienen acceso, sin tener que ir uno a uno.

Explorando el código existente se confirmó que ya hay bastante construido:

- `src/pages/PlayersPage.tsx` ya tiene selección múltiple (checkboxes) + una barra de
  acciones en lote que incluye un botón "Enviar invitaciones" (`bulkInvitePlayers`,
  `src/stores/dataStore.ts:787-839`). Pensado para selección manual puntual, no para
  "todos los que cumplan una condición" — no hay atajo que aplique el filtro y
  seleccione todo en un paso.
- `src/lib/player-portal-status.ts` (`getPlayerPortalStatus`) ya calcula, sin campo
  persistido, si un jugador está `'activo'` (tiene usuario vinculado), `'invitado'`
  (tiene invitación pendiente y vigente) o `'sin_acceso'`, cruzando `players`, `users`
  e `invitations`. Es la fuente de verdad ya usada en `PlayersPage.tsx` para su filtro
  de Portal.
- `src/components/shared/BulkTutorInviteDialog.tsx` ya resuelve el mismo problema para
  tutores de menores: detecta candidatos, muestra una lista revisable con checkboxes
  (todos marcados por defecto), y al confirmar crea la invitación y envía el correo
  uno a uno, mostrando un resultado por destinatario (enviado / sin enviar — copiar
  enlace / error). Se abre desde un botón "Invitar tutores" en la cabecera de
  `src/pages/UsersPage.tsx:421-424` ("Gestión de Usuarios"), junto a "Invitar usuario".

No existe ningún equivalente para invitar en bloque a **jugadores** (no tutores) que
ya están dados de alta y activos en la academia pero nunca han sido invitados al
portal con su propio email.

## Decisión (validada con el usuario)

Se añade un botón dedicado que abre una lista revisable de candidatos, replicando el
patrón ya validado de `BulkTutorInviteDialog.tsx` — no un atajo de filtro sobre la
tabla de `PlayersPage.tsx` (habría requerido combinar dos filtros, marcar "seleccionar
todo" y confirmar, sin vista previa dedicada ni columna de resultado).

**Candidatos** = jugadores donde:
- `status === 'activo'`
- `isMinor !== true` (los menores se invitan por la vía del tutor, con el diálogo que
  ya existe; incluirlos aquí arriesgaría mandar una invitación de rol `jugador` al
  email de un menor en vez de al de su tutor)
- `email` no vacío (sin email no hay a quién invitar)
- `getPlayerPortalStatus(player, users, invitations) === 'sin_acceso'`

**Ubicación del botón**: cabecera de `UsersPage.tsx`, junto a "Invitar tutores" —  es
donde ya viven las acciones de invitación masiva de esta app, no en `PlayersPage.tsx`.

## Arquitectura

### 1. Nuevo componente: `src/components/shared/InvitePlayersDialog.tsx`

Mismo esqueleto que `BulkTutorInviteDialog.tsx`, adaptado a jugadores individuales en
vez de familias agrupadas por email de tutor:

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
import { getPlayerPortalStatus } from '@/lib/player-portal-status'
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

export function InvitePlayersDialog({ open, onOpenChange }: InvitePlayersDialogProps) {
  const { players, users, invitations } = useDataStore()
  const { user } = useAuthStore()

  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<InviteResult[] | null>(null)
  const [copiedId, setCopiedId] = useState('')

  const candidates = useMemo<PlayerCandidate[]>(() => {
    const now = new Date()
    return players
      .filter((p) =>
        p.status === 'activo' &&
        !p.isMinor &&
        !!p.email &&
        getPlayerPortalStatus(p, users, invitations, now) === 'sin_acceso'
      )
      .map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, email: p.email! }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [players, users, invitations])

  const effectiveSelection = selectedIds ?? new Set(candidates.map((c) => c.id))

  function toggle(id: string) {
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

  // Render: mismo layout que BulkTutorInviteDialog (results / empty state / lista de
  // checkboxes), sustituyendo "familia" por "jugador" y sin la insignia de "N hijos".
  // ...
}
```

Diferencias deliberadas frente a `BulkTutorInviteDialog.tsx`:
- No hay agrupación por email (cada jugador es su propia fila — dos jugadores nunca
  comparten email de acceso propio).
- `role: 'jugador'` y `linkedPlayerId` (singular) en vez de `role: 'tutor'` y
  `linkedPlayerIds`.
- El chequeo de "ya invitado o con cuenta" se delega enteramente en
  `getPlayerPortalStatus`, en vez de construir un `Set` de emails ocupados a mano
  (evita duplicar lógica que ya existe y ya se usa en `PlayersPage.tsx`).

### 2. `src/pages/UsersPage.tsx`

- Añadir `const [showInvitePlayersDialog, setShowInvitePlayersDialog] = useState(false)`
  junto a `showBulkTutorDialog` (línea 55).
- Añadir `import { InvitePlayersDialog } from '@/components/shared/InvitePlayersDialog'`
  junto al import de `BulkTutorInviteDialog` (línea 12).
- En la cabecera (líneas 420-424), añadir un tercer botón entre "Invitar tutores" y
  "Invitar usuario":
  ```tsx
  <Button variant="outline" onClick={() => setShowInvitePlayersDialog(true)}>
    <Gamepad2 className="h-4 w-4 mr-2" />
    Invitar jugadores
  </Button>
  ```
  (`Gamepad2` ya está importado en este archivo — línea 19 — es el mismo icono que usa
  `PlayersPage.tsx` para "Invitar al portal".)
- Montar el diálogo junto a `BulkTutorInviteDialog` (línea 754-757):
  ```tsx
  <InvitePlayersDialog
    open={showInvitePlayersDialog}
    onOpenChange={setShowInvitePlayersDialog}
  />
  ```

## Fuera de alcance

- No se toca `PlayersPage.tsx`, `dataStore.ts` (`invitePlayer`/`bulkInvitePlayers`),
  ni el flujo de invitación individual desde la fila de cada jugador — siguen
  funcionando igual, para el caso de invitar a alguien concreto fuera de este atajo.
- No se toca `BulkTutorInviteDialog.tsx` — el nuevo componente es un hermano, no una
  generalización del existente. Unificarlos en un componente genérico compartido no se
  plantea aquí: agrupar por email de tutor y no agrupar son formas de listar
  suficientemente distintas como para que forzar una abstracción común no ahorre
  complejidad real.
- No se añade ningún indicador nuevo en la pestaña "Portal" de `UsersPage.tsx` (el
  contador "Sin acceso" ya existe ahí) — queda como posible mejora futura hacerlo
  clicable para abrir este mismo diálogo, pero no es necesario para resolver lo
  pedido.
- No se cambia el criterio de qué cuenta como "menor" (`Player.isMinor`) ni cómo se
  calcula — se usa el campo tal cual existe hoy.

## Verificación manual

1. `npm run build` y `npm test` en verde.
2. En "Gestión de Usuarios", con al menos un jugador activo, no menor, con email y sin
   invitación ni cuenta: el botón "Invitar jugadores" abre el diálogo y lo lista.
3. Un jugador menor de edad en las mismas condiciones **no** aparece en la lista.
4. Un jugador activo que ya tiene una invitación pendiente (columna "Invitado" en el
   filtro de Portal de `PlayersPage.tsx`) **no** aparece en la lista.
5. Un jugador activo que ya tiene cuenta de portal (`portalStatus === 'activo'`) **no**
   aparece en la lista.
6. Un jugador dado de baja o en lista de espera **no** aparece en la lista.
7. Desmarcar un jugador de la lista y confirmar: solo se invita a los que quedaron
   marcados.
8. Tras confirmar, la pantalla de resultado muestra el estado real por jugador
   (enviado / sin enviar con botón de copiar enlace / error), igual que en
   "Invitar tutores".
9. Volver a abrir el diálogo tras invitar a alguien: ese jugador ya no aparece en la
   lista de candidatos (su `portalStatus` pasa a `'invitado'`).
