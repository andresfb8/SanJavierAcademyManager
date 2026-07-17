# Unificar la activación de cuentas — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los dos puntos de entrada de invitación (ficha del jugador y Usuarios) funcionen bien, ambos con email automático, usando un único mecanismo (`invitations`).

**Architecture:** Se conserva la colección `invitations` como único mecanismo (lectura pública por token, caducidad 7 días, roles). El flujo roto (`player.invitationToken` + `/activar-cuenta` + `signupPlayer`) se reconvierte para usar esa tubería y su página queda como aviso de enlace no válido. El estado del portal de la lista de Jugadores pasa a deducirse de `users` + `invitations` mediante una función pura testeada.

**Tech Stack:** React 19 + TypeScript, Zustand, Firebase (Firestore + Auth), Vite 7, Brevo (email), Vitest (nuevo).

**Spec:** `docs/superpowers/specs/2026-07-16-unificar-activacion-cuentas-design.md`

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `vitest.config.ts` | Crear | Configuración del runner de tests |
| `package.json` | Modificar | Dependencia `vitest` + scripts `test` |
| `src/lib/player-portal-status.ts` | Crear | Función pura: estado del portal de un jugador |
| `src/lib/player-portal-status.test.ts` | Crear | Tests de la función pura |
| `src/lib/emailService.ts` | Modificar | `sendEmail` falla de forma observable; `sendInvitationEmail` genérico |
| `src/stores/dataStore.ts` | Modificar | `invitePlayer` / `bulkInvitePlayers` sobre `createInvitation` |
| `src/pages/UsersPage.tsx` | Modificar | Enviar email además del enlace copiable |
| `src/components/shared/BulkTutorInviteDialog.tsx` | Modificar | Ídem para tutores |
| `src/pages/PlayersPage.tsx` | Modificar | Estado del portal deducido; columna/acción solo admin |
| `src/pages/ActivateAccountPage.tsx` | Modificar | Aviso de enlace no válido |
| `src/stores/authStore.ts` | Modificar | Eliminar `signupPlayer` |
| `src/types/index.ts` | Modificar | Deprecar `invitationToken` / `invitationStatus` |

### Nota crítica: dependencia circular

`src/lib/invitations.ts` importa `useDataStore` desde `src/stores/dataStore.ts`. Por tanto **dataStore NO puede importar `createInvitation` de forma estática**: crearía un ciclo. Se usa `await import(...)` dentro de las acciones async, patrón ya establecido en el propio dataStore (ver `bulkGenerateInvoices`).

---

### Task 1: Vitest + `getPlayerPortalStatus` (TDD)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/player-portal-status.test.ts`
- Create: `src/lib/player-portal-status.ts`

- [ ] **Step 1: Instalar Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Crear `vitest.config.ts`**

Config propia (no reusa `vite.config.ts` para no cargar el plugin PWA en los tests). La función es pura, así que basta `environment: 'node'`.

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Añadir los scripts de test a `package.json`**

En `"scripts"`, dejar el bloque así:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 4: Escribir los tests que fallan**

Crear `src/lib/player-portal-status.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getPlayerPortalStatus } from '@/lib/player-portal-status'
import type { AppUser, Invitation, Player } from '@/types'

const NOW = new Date('2026-07-16T12:00:00Z')

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    firstName: 'Hugo',
    lastName: 'García',
    email: 'hugo@example.com',
    ...overrides,
  } as Player
}

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: 'u1',
    email: 'hugo@example.com',
    isActive: true,
    ...overrides,
  } as AppUser
}

function makeInvitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: 'i1',
    email: 'hugo@example.com',
    status: 'pendiente',
    expiresAt: new Date('2026-07-20T12:00:00Z'),
    ...overrides,
  } as Invitation
}

describe('getPlayerPortalStatus', () => {
  it('devuelve activo cuando existe un usuario vinculado por linkedPlayerId', () => {
    const users = [makeUser({ linkedPlayerId: 'p1' })]
    expect(getPlayerPortalStatus(makePlayer(), users, [], NOW)).toBe('activo')
  })

  it('devuelve activo cuando un tutor lo tiene en linkedPlayerIds', () => {
    const users = [makeUser({ id: 'u2', linkedPlayerIds: ['p9', 'p1'] })]
    expect(getPlayerPortalStatus(makePlayer(), users, [], NOW)).toBe('activo')
  })

  it('no cuenta como activo un usuario vinculado pero desactivado', () => {
    const users = [makeUser({ linkedPlayerId: 'p1', isActive: false })]
    expect(getPlayerPortalStatus(makePlayer(), users, [], NOW)).toBe('sin_acceso')
  })

  it('devuelve invitado con una invitación pendiente y vigente', () => {
    expect(getPlayerPortalStatus(makePlayer(), [], [makeInvitation()], NOW)).toBe('invitado')
  })

  it('devuelve sin_acceso si la invitación pendiente ha caducado', () => {
    const invitations = [makeInvitation({ expiresAt: new Date('2026-07-10T12:00:00Z') })]
    expect(getPlayerPortalStatus(makePlayer(), [], invitations, NOW)).toBe('sin_acceso')
  })

  it('devuelve sin_acceso si la invitación ya fue aceptada y no hay usuario', () => {
    const invitations = [makeInvitation({ status: 'aceptada' })]
    expect(getPlayerPortalStatus(makePlayer(), [], invitations, NOW)).toBe('sin_acceso')
  })

  it('activo tiene precedencia sobre invitado', () => {
    const users = [makeUser({ linkedPlayerId: 'p1' })]
    expect(getPlayerPortalStatus(makePlayer(), users, [makeInvitation()], NOW)).toBe('activo')
  })

  it('compara emails ignorando mayúsculas y espacios', () => {
    const player = makePlayer({ email: '  Hugo@Example.COM ' })
    const invitations = [makeInvitation({ email: 'hugo@example.com' })]
    expect(getPlayerPortalStatus(player, [], invitations, NOW)).toBe('invitado')
  })

  it('devuelve sin_acceso si el jugador no tiene email', () => {
    const player = makePlayer({ email: '' })
    expect(getPlayerPortalStatus(player, [], [makeInvitation()], NOW)).toBe('sin_acceso')
  })
})
```

- [ ] **Step 5: Ejecutar los tests y comprobar que fallan**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "@/lib/player-portal-status"` (el módulo aún no existe).

- [ ] **Step 6: Implementar la función**

Crear `src/lib/player-portal-status.ts`:

```ts
import type { AppUser, Invitation, Player } from '@/types'

/** Estado de acceso de un jugador al portal, deducido de users + invitations. */
export type PortalStatus = 'activo' | 'invitado' | 'sin_acceso'

function normalizeEmail(email?: string): string {
  return (email ?? '').trim().toLowerCase()
}

/**
 * Deduce el estado del portal de un jugador. No hay campo persistido: la verdad
 * está en si existe un usuario vinculado (activo) o una invitación pendiente
 * y vigente para su email (invitado).
 *
 * `activo` tiene precedencia sobre `invitado`.
 */
export function getPlayerPortalStatus(
  player: Player,
  users: AppUser[],
  invitations: Invitation[],
  now: Date = new Date()
): PortalStatus {
  const hasActiveUser = users.some(
    (u) =>
      u.isActive &&
      (u.linkedPlayerId === player.id || (u.linkedPlayerIds?.includes(player.id) ?? false))
  )
  if (hasActiveUser) return 'activo'

  const email = normalizeEmail(player.email)
  if (!email) return 'sin_acceso'

  const hasPendingInvitation = invitations.some(
    (inv) =>
      inv.status === 'pendiente' &&
      normalizeEmail(inv.email) === email &&
      new Date(inv.expiresAt).getTime() > now.getTime()
  )

  return hasPendingInvitation ? 'invitado' : 'sin_acceso'
}
```

- [ ] **Step 7: Ejecutar los tests y comprobar que pasan**

Run: `npm test`
Expected: PASS — 9 tests en `src/lib/player-portal-status.test.ts`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/player-portal-status.ts src/lib/player-portal-status.test.ts
git commit -m "feat: add getPlayerPortalStatus helper with vitest setup"
```

---

### Task 2: Email genérico + `invitePlayer` sobre el mecanismo unificado

Se hacen juntos porque el renombrado de `sendPlayerInvitation` rompería el build si se commitea suelto.

**Files:**
- Modify: `src/lib/emailService.ts`
- Modify: `src/stores/dataStore.ts` (`invitePlayer` ~línea 694, `bulkInvitePlayers` ~línea 714)

- [ ] **Step 1: Hacer que `sendEmail` falle de forma observable**

En `src/lib/emailService.ts`, sustituir el early-return por una excepción:

```ts
export async function sendEmail({ to, subject, htmlContent }: SendEmailParams) {
  if (!BREVO_API_KEY) {
    throw new Error(
      'No hay clave de Brevo configurada (VITE_BREVO_API_KEY): no se puede enviar el correo.'
    );
  }
```

El resto de la función se deja igual.

- [ ] **Step 2: Sustituir `sendPlayerInvitation` por `sendInvitationEmail`**

En `src/lib/emailService.ts`, borrar la función `sendPlayerInvitation` completa y añadir en su lugar:

```ts
import type { UserRole } from '@/types';

/**
 * Envía la invitación de activación. El enlace lo genera quien llama
 * (createInvitation), para que exista un único formato de URL: /activar/{token}
 */
export async function sendInvitationEmail(
  recipient: { name: string; email: string },
  activationUrl: string,
  role: UserRole
) {
  const isTutor = role === 'tutor';

  const subject = isTutor
    ? '🎾 Activa tu portal de familias - San Javier Academy'
    : '🎾 Activa tu portal de alumno - San Javier Academy';

  const intro = isTutor
    ? 'Se te ha dado acceso al portal de familias. Desde ahí puedes consultar las clases, los pagos y las evaluaciones de tus hijos, y avisar si algún día no van a asistir.'
    : 'Tu cuenta ha sido creada con éxito. Ahora puedes acceder a tu portal personal para gestionar tus clases, ver tus horarios y avisar de tu asistencia.';

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
      <div style="background-color: #059669; padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">¡Bienvenido a San Javier Academy!</h1>
      </div>
      <div style="padding: 32px; color: #334155; line-height: 1.6;">
        <p>Hola <strong>${recipient.name}</strong>,</p>
        <p>${intro}</p>
        <div style="text-align: center; margin: 40px 0;">
          <a href="${activationUrl}" style="background-color: #059669; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">Activar mi cuenta</a>
        </div>
        <p style="font-size: 14px; color: #64748b;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
        <p style="font-size: 12px; color: #94a3b8; word-break: break-all;">${activationUrl}</p>
        <p style="font-size: 12px; color: #94a3b8;">Este enlace caduca en 7 días.</p>
      </div>
      <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">© 2026 San Javier Academy Manager. Todos los derechos reservados.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: [{ email: recipient.email, name: recipient.name }],
    subject,
    htmlContent,
  });
}
```

- [ ] **Step 3: Quitar el import obsoleto en `dataStore.ts`**

Buscar y eliminar la línea que importa `sendPlayerInvitation`:

```bash
grep -n "sendPlayerInvitation" src/stores/dataStore.ts
```

Eliminar ese import (los nuevos se cargan dinámicamente dentro de las acciones, para evitar el ciclo `dataStore → invitations → dataStore`).

- [ ] **Step 4: Reescribir `invitePlayer`**

En `src/stores/dataStore.ts`, sustituir la acción `invitePlayer` completa por:

```ts
      invitePlayer: async (playerId) => {
        const player = get().players.find(p => p.id === playerId)
        if (!player || !player.email) return

        const clubId = getClubId()
        if (!clubId) return
        const { userId } = getCurrentUser()

        // Import dinámico: evita el ciclo dataStore → invitations → dataStore
        const { createInvitation } = await import('@/lib/invitations')
        const { sendInvitationEmail } = await import('@/lib/emailService')

        let activationUrl: string
        try {
          const result = await createInvitation({
            email: player.email,
            role: 'jugador',
            clubId,
            createdBy: userId,
            linkedPlayerId: player.id,
          })
          activationUrl = result.activationUrl
        } catch (error) {
          console.error('[DataStore] invitePlayer: error creando la invitación:', error)
          toast.error(`No se pudo crear la invitación para ${player.email}`)
          return
        }

        try {
          await sendInvitationEmail(
            { name: player.firstName, email: player.email },
            activationUrl,
            'jugador'
          )
          toast.success(`Invitación enviada a ${player.email}`)
        } catch (error) {
          console.error('[DataStore] invitePlayer: error enviando el correo:', error)
          toast.error(
            `Invitación creada, pero no se pudo enviar el correo. Copia el enlace en Usuarios → Invitaciones.`
          )
        }
      },
```

- [ ] **Step 5: Reescribir `bulkInvitePlayers`**

Sustituir la acción `bulkInvitePlayers` completa por:

```ts
      bulkInvitePlayers: async (playerIds) => {
        const players = get().players.filter(p => playerIds.includes(p.id) && p.email)
        if (players.length === 0) return

        const clubId = getClubId()
        if (!clubId) return
        const { userId } = getCurrentUser()

        toast.info(`Procesando ${players.length} invitaciones...`)

        const { createInvitation } = await import('@/lib/invitations')
        const { sendInvitationEmail } = await import('@/lib/emailService')

        let sentCount = 0
        let createdOnlyCount = 0
        let failedCount = 0

        for (const player of players) {
          try {
            const { activationUrl } = await createInvitation({
              email: player.email,
              role: 'jugador',
              clubId,
              createdBy: userId,
              linkedPlayerId: player.id,
            })
            try {
              await sendInvitationEmail(
                { name: player.firstName, email: player.email },
                activationUrl,
                'jugador'
              )
              sentCount++
            } catch {
              createdOnlyCount++
            }
          } catch (err) {
            console.error(`[DataStore] bulkInvitePlayers: falló ${player.email}`, err)
            failedCount++
          }
        }

        if (sentCount > 0) toast.success(`${sentCount} invitaciones enviadas`)
        if (createdOnlyCount > 0) {
          toast.error(
            `${createdOnlyCount} invitaciones creadas sin enviar el correo. Copia los enlaces en Usuarios → Invitaciones.`
          )
        }
        if (failedCount > 0) toast.error(`${failedCount} invitaciones no se pudieron crear`)
      },
```

- [ ] **Step 6: Comprobar que compila**

Run: `npm run build`
Expected: `✓ built` sin errores de TypeScript.

- [ ] **Step 7: Commit**

```bash
git add src/lib/emailService.ts src/stores/dataStore.ts
git commit -m "refactor: invitePlayer usa la coleccion invitations y email generico"
```

---

### Task 3: Email automático en Usuarios y en la invitación masiva de tutores

**Files:**
- Modify: `src/pages/UsersPage.tsx` (`handleSubmitInvitation` ~línea 251)
- Modify: `src/components/shared/BulkTutorInviteDialog.tsx` (`handleSubmit` ~línea 92)

- [ ] **Step 1: Importar el envío en `UsersPage.tsx`**

Añadir junto a los demás imports:

```ts
import { sendInvitationEmail } from '@/lib/emailService'
```

- [ ] **Step 2: Añadir estado para saber si el correo salió**

En `src/pages/UsersPage.tsx`, justo debajo de `const [inviteLink, setInviteLink] = useState('')` (línea ~80):

```ts
  const [inviteEmailSent, setInviteEmailSent] = useState(false)
```

- [ ] **Step 3: Enviar el correo tras crear la invitación**

En `handleSubmitInvitation`, sustituir el bloque `try` que llama a `createInvitation` por:

```ts
    try {
      const { activationUrl } = await createInvitation({
        email: inviteEmail,
        role: inviteRole as UserRole,
        clubId: user?.clubId ?? 'club-001',
        createdBy: user?.id ?? 'unknown',
        linkedPlayerId: inviteRole === 'jugador' && linkedPlayerId ? linkedPlayerId : undefined,
        linkedPlayerIds: inviteRole === 'tutor' && linkedPlayerIds.length > 0 ? linkedPlayerIds : undefined,
      })
      setInviteLink(activationUrl)
      setInviteSuccess(true)

      try {
        await sendInvitationEmail(
          { name: inviteEmail.split('@')[0], email: inviteEmail },
          activationUrl,
          inviteRole as UserRole
        )
        setInviteEmailSent(true)
      } catch (emailErr) {
        console.error('No se pudo enviar el correo de invitación:', emailErr)
        setInviteEmailSent(false)
      }
    } catch (err) {
      console.error('Error saving invitation to Firestore:', err)
      setEmailError('Error al guardar la invitacion. Intentalo de nuevo.')
    }
```

- [ ] **Step 4: Mostrar el resultado real del envío**

En el diálogo de éxito (línea ~930), sustituir el `<DialogDescription>` que hoy dice "Comparte el siguiente enlace con el usuario para que pueda activar su cuenta." por un texto que refleje si el correo salió:

```tsx
                <DialogDescription>
                  {inviteEmailSent
                    ? `Hemos enviado un correo a ${inviteEmail} con el enlace de activación. También puedes compartirlo tú mismo.`
                    : 'No se pudo enviar el correo automáticamente. Comparte tú este enlace para que pueda activar su cuenta.'}
                </DialogDescription>
```

- [ ] **Step 5: Resetear el estado en `resetForm`**

En la función `resetForm` (línea ~225-234), añadir junto a `setInviteLink('')`:

```ts
    setInviteEmailSent(false)
```

- [ ] **Step 6: Enviar el correo en la invitación masiva de tutores**

En `src/components/shared/BulkTutorInviteDialog.tsx`, añadir el import:

```ts
import { sendInvitationEmail } from '@/lib/emailService'
```

Ampliar la interfaz `BulkResult` (línea ~18) con el flag de envío, dejándola así:

```ts
interface BulkResult {
  email: string
  guardianName: string
  activationUrl?: string
  emailed?: boolean
  error?: boolean
}
```

Y sustituir el cuerpo del `for` de `handleSubmit` por:

```ts
      try {
        const { activationUrl } = await createInvitation({
          email: family.email,
          role: 'tutor',
          clubId: user?.clubId ?? 'club-001',
          createdBy: user?.id ?? 'unknown',
          linkedPlayerIds: family.players.map((p) => p.id),
        })

        let emailed = false
        try {
          await sendInvitationEmail(
            { name: family.guardianName, email: family.email },
            activationUrl,
            'tutor'
          )
          emailed = true
        } catch (emailErr) {
          console.error(`No se pudo enviar el correo a ${family.email}:`, emailErr)
        }

        outcome.push({ email: family.email, guardianName: family.guardianName, activationUrl, emailed })
      } catch (err) {
        console.error(`Error creating tutor invitation for ${family.email}:`, err)
        outcome.push({ email: family.email, guardianName: family.guardianName, error: true })
      }
```

- [ ] **Step 7: Indicar en la lista de resultados si se envió el correo**

En el `results.map` (línea ~142), dentro del `<div className="min-w-0">` que muestra nombre y email, añadir una tercera línea debajo del email:

```tsx
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{r.guardianName}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                  {!r.error && (
                    r.emailed ? (
                      <p className="text-[11px] font-medium text-emerald-600">Correo enviado</p>
                    ) : (
                      <p className="text-[11px] font-medium text-amber-600">Sin enviar — copia el enlace</p>
                    )
                  )}
                </div>
```

- [ ] **Step 8: Añadir botón de copiar enlace a la tabla de invitaciones**

Motivo: cuando falla el envío del correo, los toasts de `invitePlayer` dicen "Copia el enlace en Usuarios → Invitaciones", pero esa pestaña solo muestra Email / Rol / Estado / Jugador vinculado / Fecha y un botón de borrar — **el enlace no aparece por ningún sitio**. Hoy esa instrucción es imposible de seguir. El enlace se reconstruye desde el token, que sí está en el registro (`inv.token`).

En la tabla de invitaciones de `src/pages/UsersPage.tsx`, en la celda de acciones de cada fila (junto al botón de borrar), añadir un botón de copiar visible solo para las pendientes:

```tsx
                        {inv.status === 'pendiente' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Copiar enlace de activación"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/activar/${inv.token}`)
                              setCopiedInvitationId(inv.id)
                              setTimeout(() => setCopiedInvitationId(''), 2000)
                            }}
                          >
                            {copiedInvitationId === inv.id
                              ? <Check className="h-4 w-4 text-green-600" />
                              : <Copy className="h-4 w-4" />}
                          </Button>
                        )}
```

Añadir el estado junto a los demás `useState` de la página:

```ts
  const [copiedInvitationId, setCopiedInvitationId] = useState('')
```

`Copy` y `Check` ya se importan en este archivo (los usa el diálogo de éxito); reutilízalos.

- [ ] **Step 9: Comprobar que compila**

Run: `npm run build && npm test`
Expected: `✓ built` sin errores y 12 tests en PASS.

- [ ] **Step 10: Commit**

```bash
git add src/pages/UsersPage.tsx src/components/shared/BulkTutorInviteDialog.tsx
git commit -m "feat: enviar email automatico al invitar desde Usuarios y tutores en bloque"
```

---

### Task 4: PlayersPage usa el estado deducido

**Files:**
- Modify: `src/pages/PlayersPage.tsx` (destructuring ~línea 38, filtro ~línea 70-75, insignias ~línea 241-250, acción ~línea 308-319)

- [ ] **Step 1: Importar el helper y los datos necesarios**

Añadir imports:

```ts
import { getPlayerPortalStatus } from '@/lib/player-portal-status'
import { useAuthStore } from '@/stores/authStore'
```

Ampliar el destructuring del store para traer `users` e `invitations`:

```ts
  const { players, users, invitations, addPlayer, updatePlayer, cancelPlayer, deletePlayer, invitePlayer } = useDataStore()
```

- [ ] **Step 2: Calcular el estado de portal por jugador y si es admin**

Justo después del destructuring, añadir:

```ts
  const { user } = useAuthStore()
  const activeRole = user?.activeRole ?? user?.role
  // Invitar al portal es cosa de admin; los entrenadores además no sincronizan
  // `invitations`, así que para ellos el estado no sería fiable.
  const isAdmin = activeRole === 'director' || activeRole === 'coordinador'

  const portalStatusById = useMemo(() => {
    const now = new Date()
    const map: Record<string, ReturnType<typeof getPlayerPortalStatus>> = {}
    for (const p of players) {
      map[p.id] = getPlayerPortalStatus(p, users, invitations, now)
    }
    return map
  }, [players, users, invitations])
```

- [ ] **Step 3: Usar el estado deducido en el filtro**

En `filteredPlayers`, sustituir el bloque `matchesPortal` por:

```ts
      const portalStatus = portalStatusById[p.id] ?? 'sin_acceso'
      const matchesPortal =
        portalFilter === '' ? true :
        portalFilter === 'active' ? portalStatus === 'activo' :
        portalFilter === 'sent' ? portalStatus === 'invitado' :
        portalFilter === 'none' ? portalStatus === 'sin_acceso' :
        true
```

Y añadir `portalStatusById` a las dependencias del `useMemo`:

```ts
  }, [players, search, levelFilter, statusFilter, portalFilter, portalStatusById])
```

- [ ] **Step 4: Usar el estado deducido en las insignias**

Sustituir los dos bloques de insignia (`invitationStatus === 'sent'` y `=== 'active'`) por:

```tsx
              {portalStatusById[player.id] === 'invitado' && (
                <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-blue-600 bg-blue-50 w-fit px-1.5 py-0.5 rounded-md">
                  <Mail className="h-3 w-3" /> Invitación enviada
                </div>
              )}
              {portalStatusById[player.id] === 'activo' && (
                <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-1.5 py-0.5 rounded-md">
                  <CheckCircle2 className="h-3 w-3" /> Portal Activo
                </div>
              )}
```

- [ ] **Step 5: Usar el estado deducido en la acción de invitar (y limitarla a admin)**

Sustituir el bloque del `DropdownMenuItem` de invitación por:

```tsx
              {isAdmin && player.email && portalStatusById[player.id] !== 'activo' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => invitePlayer(player.id)}
                    className="text-blue-700 focus:text-blue-700"
                  >
                    <Gamepad2 className="h-4 w-4 mr-2" />
                    {portalStatusById[player.id] === 'invitado' ? 'Reenviar invitación' : 'Invitar al portal'}
                  </DropdownMenuItem>
                </>
              )}
```

- [ ] **Step 6: Actualizar las dependencias del `useMemo` de columnas**

En el array de dependencias de las columnas, añadir `portalStatusById` e `isAdmin`:

```ts
  ], [selectedIds, filteredPlayers.length, navigate, invitePlayer, portalStatusById, isAdmin])
```

- [ ] **Step 7: Comprobar que compila y que los tests siguen verdes**

Run: `npm run build && npm test`
Expected: `✓ built` y 9 tests en PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/PlayersPage.tsx
git commit -m "refactor: estado del portal deducido de users e invitations en PlayersPage"
```

---

### Task 5: `/activar-cuenta` como aviso + eliminar `signupPlayer`

**Files:**
- Modify: `src/pages/ActivateAccountPage.tsx` (reemplazo completo)
- Modify: `src/stores/authStore.ts` (interfaz ~línea 39, implementación ~línea 246-267)

- [ ] **Step 1: Reemplazar `ActivateAccountPage.tsx` por el aviso**

Contenido completo del archivo:

```tsx
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

/**
 * Ruta heredada. Los enlaces antiguos (`/activar-cuenta?token=&email=`) usaban
 * `player.invitationToken`, que no se puede resolver sin estar autenticado, así
 * que nunca llegaban a activar la cuenta. El alta se hace ahora siempre desde
 * `/activar/:token` (colección `invitations`).
 */
export default function ActivateAccountPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-md text-center p-8 rounded-[2rem] border-none shadow-xl">
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
            <AlertCircle className="h-10 w-10" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Este enlace ya no es válido</h2>
        <p className="text-slate-500 mb-6">
          Los enlaces de activación antiguos han dejado de funcionar. Pide a la academia que te
          envíe una invitación nueva y podrás crear tu contraseña.
        </p>
        <Button variant="outline" className="w-full rounded-xl" onClick={() => navigate('/login')}>
          Ir al inicio de sesión
        </Button>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Eliminar `signupPlayer` de la interfaz de `AuthState`**

En `src/stores/authStore.ts`, borrar esta línea de la interfaz:

```ts
  signupPlayer: (email: string, pass: string, playerId: string) => Promise<void>
```

- [ ] **Step 3: Eliminar la implementación de `signupPlayer`**

Borrar la acción `signupPlayer` completa (la que hace `createUserWithEmailAndPassword` y escribe `clubId: 'club-001'` hardcodeado). El alta la cubre `signupFromInvitation`.

- [ ] **Step 4: Comprobar que no quedan usos**

Run: `grep -rn "signupPlayer" src/`
Expected: sin resultados.

- [ ] **Step 5: Comprobar que compila**

Run: `npm run build`
Expected: `✓ built` sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ActivateAccountPage.tsx src/stores/authStore.ts
git commit -m "fix: enlace de activacion heredado muestra aviso y se elimina signupPlayer"
```

---

### Task 6: Terminar la retirada del flujo antiguo

> **Ampliada tras la revisión de la Task 5.** El inventario de huérfanos reveló que `PlayerProfilePage` seguía leyendo `invitationStatus` (quedó fuera de la migración de la Task 4), y que `addPlayer` sigue escribiendo campos que ya no lee nadie. Deprecar solo los tipos no bastaba: hay lectores y escritores vivos.

**Files:**
- Modify: `src/pages/PlayerProfilePage.tsx` (botón de invitar, ~líneas 359-377)
- Modify: `src/stores/dataStore.ts` (`addPlayer`, ~líneas 562-571)
- Modify: `src/types/index.ts` (`Player`, ~líneas 158-163)

- [ ] **Step 0a: Migrar `PlayerProfilePage` al estado deducido**

Motivo: la única escritura de `invitationStatus: 'active'` estaba en la `ActivateAccountPage` que borró la Task 5, y nada escribe `'sent'` desde la Task 2. El botón queda clavado en "Invitar al Portal" para siempre: nunca mostrará "Acceso Activo" ni se deshabilitará, así que un admin puede reinvitar a alguien ya activo sin ninguna señal. Además hoy es visible para entrenadores, que no pueden crear invitaciones (las reglas lo deniegan) ni deducir el estado (no sincronizan `invitations` ni `users`).

Sustituir el bloque del botón por la versión deducida y restringida a admin, con el mismo criterio que `PlayersPage`.

- [ ] **Step 0b: Dejar de escribir los campos muertos en `addPlayer`**

`addPlayer` genera y sincroniza `invitationToken` e `inviteCode` en cada alta; ninguno tiene ya lectores. Eliminar esas escrituras (no los campos del tipo, que se mantienen por compatibilidad).

- [ ] **Step 1: Marcar los campos como deprecados**

En la interfaz `Player`, sustituir el bloque de campos de invitación por:

```ts
  // Invitation & Portal fields
  /** @deprecated Flujo antiguo de activación. Ya no se escribe: el acceso se
   *  gestiona con la colección `invitations`. Se mantiene por compatibilidad
   *  con documentos existentes en Firestore. */
  invitationToken?: string
  /** @deprecated Ya no se escribe. El estado del portal se deduce con
   *  `getPlayerPortalStatus()` a partir de `users` + `invitations`. */
  invitationStatus?: 'pending' | 'sent' | 'active'
  portalUid?: string // Firebase Auth UID linked to this player
  inviteCode?: string // Simple code for manual linking
  userId?: string
```

- [ ] **Step 2: Comprobar que nadie escribe ya esos campos**

Run: `grep -rn "invitationStatus\|invitationToken" src/ --include=*.ts --include=*.tsx`
Expected: solo la declaración en `src/types/index.ts`. Si aparece alguna escritura (`updatePlayer({ invitationStatus... })`), eliminarla.

- [ ] **Step 3: Comprobar build y tests**

Run: `npm run build && npm test`
Expected: `✓ built` y 9 tests en PASS.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "chore: deprecar invitationToken e invitationStatus en Player"
```

---

## Verificación manual final

Requiere `npm run dev` y una cuenta de director.

1. **Ficha del jugador:** Jugadores → menú de un alumno con email → "Invitar al portal". Debe llegar el correo con un enlace `/activar/{token}`. Abrirlo (en ventana privada), poner contraseña → entra a su portal. Volver a Jugadores como director: el alumno aparece con **Portal Activo**.
2. **Estado intermedio:** tras invitar y antes de activar, el alumno debe verse como **Invitación enviada** y la acción debe decir "Reenviar invitación".
3. **Usuarios:** Usuarios → Invitaciones → invitar a un jugador. Debe decir "Correo enviado" y mostrar además el enlace copiable.
4. **Tutor:** "Invitar tutores" con una familia de 2 hijos → correo enviado → activar → aparece el selector de hijo en la cabecera.
5. **Sin Brevo:** quitar `VITE_BREVO_API_KEY` de `.env.local`, reiniciar `npm run dev` e invitar. El aviso debe decir que **no se pudo enviar** y ofrecer el enlace. Nunca "enviado". Restaurar la clave después.
6. **Legacy:** abrir `/activar-cuenta?token=x&email=y@z.com` → aviso "Este enlace ya no es válido" con botón a login.
7. **Entrenador:** entrar con rol entrenador → en Jugadores no debe aparecer la acción "Invitar al portal".
