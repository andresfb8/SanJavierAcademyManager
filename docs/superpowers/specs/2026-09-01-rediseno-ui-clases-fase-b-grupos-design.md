# Rediseño de interfaz — Módulo Clases, Fase B (Grupos)

## Contexto

Continuación de la Fase A de Clases (topbar unificado, ya mergeada). Ahora
toca la primera pestaña con rediseño visual completo: **Grupos**.

Mockup de referencia en `san javier.pen`: nodo `adT95` ("06 · Clases /
Grupos"). A diferencia de Fase A, aquí sí se rediseña el contenido interno
de `GroupsPage.tsx`, no solo su topbar.

## Alcance de esta fase

1. `ClasesOutletContext` gana `search`/`setSearch` (mismo patrón que
   `PersonasOutletContext`) — el buscador pasa a vivir en el topbar de
   `ClasesLayout`, conectado de verdad. Solo `GroupsPage` lo consume en
   esta fase; el resto de pestañas sigue sin buscador hasta su propia fase.
2. Subtítulo de la pestaña Grupos en `ClasesLayout` se enriquece con 3
   métricas (antes solo 2).
3. `GroupsPage.tsx`: se quita su buscador propio de la fila de filtros; se
   añaden filtros de Día y Plazas; se añaden 2 métricas nuevas por grupo
   (asistencia, lista de espera) tanto en la vista de tarjetas como en la
   de tabla; el menú de acciones de cada tarjeta pasa de botones inline a
   un menú "···".

Fuera de alcance: el diálogo de crear/editar grupo; `GroupDetailPage.tsx`
(ficha del grupo); conectar el buscador del topbar en las otras 5 pestañas;
la simplificación de niveles a 3 categorías del mock (se mantienen los 5
niveles actuales, ver decisión más abajo).

## 1. `ClasesLayout` — buscador real

### `ClasesOutletContext`

```ts
export interface ClasesOutletContext {
  search: string
  setSearch: (value: string) => void
  setPrimaryAction: (action: ClasesPrimaryAction | null) => void
}
```

`ClasesLayout` pasa a tener `const [search, setSearch] = useState('')`,
reseteado a `''` en un `useEffect` con dependencia `[location.pathname]`
(mismo patrón que `PersonasLayout`). El input de búsqueda del topbar deja
de ser decorativo y se conecta a `search`/`setSearch`.

**Importante — el input solo se muestra en las pestañas que ya lo
consumen**, no en las 6 a la vez: mostrar un buscador que no filtra nada
en Parrilla/Asistencia/etc. sería peor que no tener buscador (parece roto,
no "pendiente"). Igual que el subtítulo ya se calcula por ruta, el propio
`ClasesLayout` decide si renderizar el input:

```ts
const showSearch = location.pathname === '/clases/grupos'
```

Y en el JSX, el bloque del `<Input>` de búsqueda se envuelve en
`{showSearch && (...)}`. Cada fase futura añade su propia ruta a esta
condición (o se convierte en una lista `SEARCH_ENABLED_PATHS` si crece más
de 2-3 entradas) cuando conecte su propio buscador.

### Subtítulo de Grupos

Cambia de `"${activos} activos · ${total} total"` a:

```
"${activos} activos · ${totalInscritos} alumnos inscritos · ${promedio} alumnos por grupo"
```

Donde `totalInscritos` es la suma de `currentEnrollment` de los grupos
activos, y `promedio = totalInscritos / activos` formateado a 1 decimal
con coma (`toLocaleString('es-ES', { maximumFractionDigits: 1 })`). Si
`activos === 0`, mostrar `"0 grupos activos"` sin las otras dos métricas
(evita división por cero).

## 2. `GroupsPage.tsx` — cambios

### Buscador

Se elimina el `<Input>` de búsqueda de la fila de filtros (el input real
vive ahora en `ClasesLayout`, ver sección 1). `GroupsPage` deja de tener
`const [search, setSearch] = useState('')` y solo **lee** `search` —
nunca lo escribe, igual que `PlayersPage`/`CoachesPage`/`UsersPage` en
Personas: `const search = useOutletContext<ClasesOutletContext | undefined>()?.search ?? ''`
(sigue siendo opcional porque, aunque hoy `GroupsPage` solo se renderiza
dentro de `ClasesLayout` en la práctica — ver nota de Fase A sobre
`GroupsInClasesLayout` —, se mantiene el mismo patrón defensivo ya
establecido para esta página por consistencia y porque no cuesta nada).

### Nuevos filtros: Día y Plazas

Se añaden dos `Select` nuevos a la fila de filtros (que ya tiene Nivel,
Entrenador, Temporada, Ordenar):

- **Día**: opciones "Todos los días" + `DAYS_OF_WEEK` (Lunes...Domingo).
  Filtra grupos cuyo `schedule` contenga al menos un slot con ese
  `dayOfWeek`.
- **Plazas**: opciones "Todos" / "Con hueco" / "Completo". "Con hueco" =
  `currentEnrollment < maxCapacity`; "Completo" = `currentEnrollment >=
  maxCapacity`.

Ninguno de los filtros existentes (Nivel, Entrenador, Temporada, Ordenar)
se quita.

### Métrica de asistencia por grupo (nueva)

```ts
const attendanceRateByGroup = useMemo(() => {
  const rates: Record<string, number | null> = {}
  for (const group of groups) {
    const records = attendance.filter((r) => {
      if (r.groupId !== group.id) return false
      const d = r.date instanceof Date ? r.date : new Date(r.date)
      if (activeSeason && (d < activeSeason.startDate || d > activeSeason.endDate)) return false
      return true
    })
    let present = 0
    let total = 0
    for (const record of records) {
      for (const entry of record.records) {
        total++
        if (entry.status === 'presente') present++
      }
    }
    rates[group.id] = total > 0 ? Math.round((present / total) * 100) : null
  }
  return rates
}, [groups, attendance, activeSeason])
```

`attendance` se añade a la desestructuración de `useDataStore()`. `null`
significa "Sin datos" (sin registros de asistencia en la temporada
activa) — mismo criterio que ya usa `PlayersPage` para el jugador
individual.

### Métrica de lista de espera por grupo (nueva)

```ts
const waitlistCountByGroup = useMemo(() => {
  const counts: Record<string, number> = {}
  for (const group of groups) {
    counts[group.id] = enrollments.filter(
      (e) => e.groupId === group.id && e.isWaitlist && !e.isActive
    ).length
  }
  return counts
}, [groups, enrollments])
```

### Vista de tarjetas — cambios

- El bloque de botones "Editar"/"Eliminar" (esquina superior derecha,
  visibles siempre) se sustituye por un único botón "···" con
  `DropdownMenu` (mismo componente ya usado en `PlayersPage`/`CoachesPage`)
  con dos opciones: "Editar" (abre `openEditDialog`) y "Eliminar" (abre
  `setShowDeleteConfirm`, con separador y estilo destructivo, igual que en
  `CoachesPage`).
- Se añade una fila de pie (footer) bajo la barra de ocupación, con dos
  bloques separados por un espaciador:
  - Asistencia: icono + `${rate}%` o `"Sin datos"` si `rate === null`.
  - Lista de espera: icono + `${count} en espera"` o `"Sin lista de
    espera"` si `count === 0`.

### Vista de tabla — cambios

Se añaden 2 columnas nuevas, después de "Ocupación": "Asistencia" (mismo
formato que en tarjetas) y "Lista de espera" (mismo formato). Estas 2
columnas se ocultan en pantallas pequeñas igual que ya hace la columna
"Detalles" (`hidden md:table-cell`), para no sobrecargar la tabla en móvil.

## Fuera de alcance / riesgos conocidos

- El cálculo de asistencia por grupo recorre todos los `attendance` del
  club por cada grupo en un `useMemo` — con el volumen actual de datos
  (decenas de grupos, cientos de registros) no debería notarse; si en el
  futuro se vuelve lento, se puede optimizar indexando `attendance` por
  `groupId` primero. No bloquea esta fase.
- Los 5 niveles actuales (`PLAYER_LEVELS`) se mantienen sin cambios — no
  se introduce la agrupación en 3 categorías ("Escuela"/"Adultos"/
  "Competición") que muestra el mock, decisión tomada explícitamente con
  el usuario.
- El buscador del topbar de `ClasesLayout` solo se muestra en `/clases/grupos`
  por ahora — en el resto de pestañas no aparece en absoluto (no un campo
  vacío sin efecto), hasta que a cada una le toque su propia fase de
  rediseño y añada su ruta a la condición `showSearch`.
