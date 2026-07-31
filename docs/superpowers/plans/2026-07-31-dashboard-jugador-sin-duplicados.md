# Dashboard de jugador en escritorio sin duplicados — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada dato del alumno (próxima clase, pagos, asistencia, ausencias, perfil) aparezca una sola vez en la vista de escritorio del dashboard de jugador, eliminando la fila de accesos rápidos duplicada y cerrando los dos enlaces que dependían de ella.

**Architecture:** Se elimina la sección "Quick Actions Desktop" de `PlayerDashboard.tsx` (la vista móvil, que usa el mismo array `quickActions`, no se toca). El acceso a "Mi Perfil" que cubría esa fila se reemplaza por un avatar clicable en el saludo; el acceso a "Mi Asistencia" se cierra añadiendo un `onClick` opcional a `AsistenciaMensualChart`, siguiendo el mismo patrón que ya usa `EstadoPagosCard`.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS v4, React Router, Lucide React.

**Spec:** `docs/superpowers/specs/2026-07-31-dashboard-jugador-sin-duplicados-design.md`

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/components/player/PlayerDashboardCards.tsx` | Modificar | `AsistenciaMensualChart` acepta `onClick` opcional |
| `src/pages/PlayerDashboard.tsx` | Modificar | Avatar clicable en el saludo; eliminar Quick Actions Desktop; conectar `onClick` de `AsistenciaMensualChart` |

---

### Task 1: `AsistenciaMensualChart` acepta un `onClick` opcional

**Files:**
- Modify: `src/components/player/PlayerDashboardCards.tsx:280-324`

- [ ] **Step 1: Ampliar las props del componente**

En `src/components/player/PlayerDashboardCards.tsx`, encontrar:

```ts
interface AsistenciaMensualChartProps {
  studentId: string
  groupIds: string[]
}

export function AsistenciaMensualChart({ studentId, groupIds }: AsistenciaMensualChartProps) {
```

Cambiar a:

```ts
interface AsistenciaMensualChartProps {
  studentId: string
  groupIds: string[]
  onClick?: () => void
}

export function AsistenciaMensualChart({ studentId, groupIds, onClick }: AsistenciaMensualChartProps) {
```

- [ ] **Step 2: Aplicar el `onClick` y el estilo interactivo al `Card` raíz**

En el mismo archivo, encontrar (dentro de `AsistenciaMensualChart`, el `return`):

```tsx
  return (
    <Card className="border border-slate-100 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-bold text-slate-600 flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          Asistencia Mensual
        </CardTitle>
      </CardHeader>
```

Cambiar la etiqueta `<Card ...>` a. Como `onClick` es opcional (a diferencia de `EstadoPagosCard`, que siempre lo recibe en la práctica), las clases interactivas (`cursor-pointer hover:shadow-md`) solo se aplican cuando hay un `onClick` real, dejando la tarjeta con su apariencia estática si no lo hay:

```tsx
  return (
    <Card
      className={cn(
        'border border-slate-100 shadow-sm transition-all',
        onClick && 'cursor-pointer hover:shadow-md'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-bold text-slate-600 flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          Asistencia Mensual
        </CardTitle>
      </CardHeader>
```

Nota: `cn` ya está importado en este archivo (lo usa `EstadoPagosCard`); no hace falta añadir el import.

- [ ] **Step 3: Comprobar que compila**

Run: `npm run build`
Expected: `✓ built` sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/player/PlayerDashboardCards.tsx
git commit -m "feat: AsistenciaMensualChart acepta onClick para navegar al historial"
```

---

### Task 2: Avatar clicable en el saludo de escritorio

**Files:**
- Modify: `src/pages/PlayerDashboard.tsx:1-48` (imports/constantes), `:617-625` (saludo)

- [ ] **Step 1: Añadir la constante de color del avatar**

En `src/pages/PlayerDashboard.tsx`, cerca del resto de imports y constantes de módulo (justo antes de `export default function PlayerDashboard()`), añadir:

```ts
// PlayerDashboard solo se renderiza para roles 'jugador'/'tutor' (ver App.tsx),
// así que el gradiente del avatar es siempre el mismo, sin necesidad de un mapa por rol.
const AVATAR_GRADIENT = 'from-blue-500 to-blue-600'
```

- [ ] **Step 2: Añadir el avatar clicable junto al saludo**

Encontrar el bloque del saludo de escritorio:

```tsx
        {/* Saludo Desktop */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Hola, {user?.displayName?.split(' ')[0]} 👋
            </h1>
            <p className="text-sm font-medium text-slate-400 mt-1">
              {isTutor ? <>Viendo a <span className="font-bold text-slate-600">{studentFirstName}</span> · {formatDate(now)}</> : formatDate(now)}
            </p>
          </div>
          <div className="flex items-center gap-3">
```

Cambiar a (envuelve el saludo junto con el avatar en un contenedor `flex`, y el avatar es un `<button>` para mantener foco de teclado y semántica correcta):

```tsx
        {/* Saludo Desktop */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { if (studentId) navigate(`/jugadores/${studentId}`) }}
              className={cn(
                'h-12 w-12 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-black text-lg shrink-0 hover:scale-105 transition-transform',
                AVATAR_GRADIENT
              )}
              title="Ver mi perfil"
            >
              {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
            </button>
            <div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                Hola, {user?.displayName?.split(' ')[0]} 👋
              </h1>
              <p className="text-sm font-medium text-slate-400 mt-1">
                {isTutor ? <>Viendo a <span className="font-bold text-slate-600">{studentFirstName}</span> · {formatDate(now)}</> : formatDate(now)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
```

`cn`, `navigate`, `studentId`, `isTutor`, `user`, `studentFirstName`, `formatDate` y `now` ya están disponibles en el componente — no hace falta añadir ningún import.

- [ ] **Step 3: Comprobar que compila**

Run: `npm run build`
Expected: `✓ built` sin errores.

- [ ] **Step 4: Comprobar visualmente**

Run: `npm run dev`, entrar como jugador, abrir el dashboard en una ventana ancha (≥1024px). El avatar con la inicial debe aparecer junto al saludo y, al pulsarlo, navegar a `/jugadores/{id}`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PlayerDashboard.tsx
git commit -m "feat: avatar clicable en el saludo del dashboard para acceder al perfil"
```

---

### Task 3: Eliminar la sección "Quick Actions Desktop" y conectar el `onClick` de asistencia

**Files:**
- Modify: `src/pages/PlayerDashboard.tsx:635-655` (eliminar), `:710-715` (conectar `onClick`)

- [ ] **Step 1: Eliminar el bloque de accesos rápidos de escritorio**

Encontrar y eliminar por completo este bloque (queda justo debajo del saludo, tras el cierre de la `Task 2`):

```tsx
        {/* Quick Actions Desktop */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.label}
                onClick={action.onClick}
                className="flex items-center gap-4 p-5 rounded-[1.5rem] bg-white border border-slate-100 shadow-sm text-left hover:shadow-md hover:border-slate-200 transition-all active:scale-95 group"
              >
                <div className={cn('h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110', action.color)}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800 leading-tight">{action.label}</p>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">{action.sub}</p>
                </div>
              </button>
            )
          })}
        </div>

```

Tras eliminarlo, el `<div className="grid grid-cols-3 gap-6">` (la rejilla de 3 columnas) debe quedar justo debajo del `<div>` del saludo, sin nada intermedio.

**No tocar** la declaración del array `quickActions` (más arriba en el archivo, dentro del cuerpo del componente) — sigue usándose sin cambios en la vista móvil, en otra sección del mismo archivo.

- [ ] **Step 2: Conectar el `onClick` de `AsistenciaMensualChart`**

Encontrar:

```tsx
            {studentId && (
              <AsistenciaMensualChart
                studentId={studentId}
                groupIds={myGroups.map((g) => g.id)}
              />
            )}
```

Cambiar a:

```tsx
            {studentId && (
              <AsistenciaMensualChart
                studentId={studentId}
                groupIds={myGroups.map((g) => g.id)}
                onClick={() => navigate('/asistencia')}
              />
            )}
```

- [ ] **Step 3: Comprobar que compila**

Run: `npm run build`
Expected: `✓ built` sin errores.

- [ ] **Step 4: Comprobar que los tests siguen en verde**

Run: `npm test`
Expected: PASS — 31 tests (esta tarea no añade tests nuevos: es una eliminación de UI y una conexión de navegación ya cubierta por el patrón existente de `EstadoPagosCard`/`UltimasEvaluacionesCard`).

- [ ] **Step 5: Comprobar visualmente**

Run: `npm run dev`, entrar como jugador, ventana ancha (≥1024px):
- No debe aparecer ninguna fila de accesos rápidos entre el saludo y las 3 columnas.
- No debe haber ningún hueco vacío en el layout.
- Pulsar la tarjeta "Asistencia Mensual" debe navegar a `/asistencia` y mostrar el historial de solo lectura.
- Reducir la ventana a móvil (o usar las DevTools) → la fila de accesos rápidos debe seguir apareciendo exactamente igual que antes (sin regresión), incluyendo "Mi Asistencia" y "Mi Perfil".

- [ ] **Step 6: Commit**

```bash
git add src/pages/PlayerDashboard.tsx
git commit -m "fix: eliminar la fila de accesos rapidos duplicada en el dashboard de escritorio"
```

---

## Verificación manual final

Requiere `npm run dev`, cuentas de jugador y de tutor (con al menos un hijo activo).

1. **Jugador, escritorio:** el dashboard muestra el avatar junto al saludo, sin fila de accesos rápidos, sin huecos vacíos. Cada dato (próxima clase, pagos, asistencia, ausencias) aparece una sola vez.
2. **Avatar → perfil:** pulsar el avatar navega a `/jugadores/{id}` del alumno.
3. **Asistencia Mensual → historial:** pulsar la tarjeta navega a `/asistencia` y muestra `MyAttendanceView` (la vista de solo lectura).
4. **Tutor, escritorio:** repetir 1-3 con una cuenta de tutor y un hijo activo — el avatar y los enlaces deben respetar el `studentId` del hijo seleccionado, no el del tutor.
5. **Regresión móvil:** en una ventana estrecha, la fila de accesos rápidos (Mi Próxima Clase, Mis Pagos, Mi Asistencia, Mi Perfil, Mis Ausencias) sigue apareciendo exactamente igual que antes de este cambio.
6. **Regresión general:** el resto del dashboard (próxima clase, grupos, ausencias, pagos, evaluaciones, eventos, bonos, recuperaciones) sigue funcionando igual que antes — este cambio no toca su contenido, solo elimina la fila duplicada y añade dos enlaces.
