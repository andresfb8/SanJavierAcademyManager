# Temporada activa en Grupos — Diseño

**Fecha:** 2026-08-19
**Estado:** aprobado, pendiente de plan de implementación

## Contexto

El usuario reportó: creó una temporada nueva desde `SeasonsPage.tsx` sin traspasar ningún grupo, y la sección de Grupos siguió mostrando exactamente lo mismo que antes, incluidos grupos finalizados. Investigación:

- **Crear una temporada es puramente aditivo.** `addSeason` (`src/stores/dataStore.ts:899-905`) solo añade un registro `Season`; no toca `groups` ni `enrollments`.
- **No existe el concepto de "temporada activa"** en ningún sitio — ni en `Club` ni en el store. Las temporadas son una lista plana sin ninguna marcada como "la actual".
- **`GroupsPage.tsx`** (`filteredGroups`, líneas 109-136) muestra todos los grupos que existen, de cualquier temporada, filtrando solo por texto/nivel/entrenador — nunca por temporada. Los grupos finalizados llevan una etiqueta "Finalizado" (`isGroupStale`) pero no se ocultan.
- **Crear un grupo nuevo no le asigna ninguna temporada** (`seasonId` queda `undefined` — confirmado en `GroupsPage.tsx:285`, la llamada a `addGroup` nunca incluye `seasonId`). Solo los grupos que pasan por el asistente de traspaso (`RenewGroupsDialog` → `renewGroup`, `dataStore.ts:1164-1300`) reciben un `seasonId`.
- La generación de recibos (corregida en una rama reciente, `claude/importe-fijo-trimestral-anual`) ya solo factura grupos con `isActive: true` — es segura independientemente de este cambio.

El usuario quiere: saber en qué temporada está trabajando, que los grupos que cree se asocien a ella, y poder filtrar los datos económicos (Pagos) por temporada.

## Decisión (validada con el usuario)

1. **Selector explícito de "temporada activa"**, compartido por todo el club (no por sesión de usuario), no inferido por fechas.
2. **Migración automática y transparente** de los grupos existentes sin `seasonId` a una temporada "Temporada 2025/2026" creada (o reutilizada si ya existe) la primera vez que se detecta que falta `club.activeSeasonId`.
3. **Grupos nuevos se etiquetan automáticamente** con la temporada activa al crearse; editar un grupo existente no cambia su temporada.
4. **Grupos filtra por defecto por la temporada activa**, con un filtro adicional para consultar otras temporadas sin cambiar cuál es la activa.
5. **La generación de recibos NO cambia** — sigue basada en `isActive`. Pagos gana un filtro por temporada, calculado al vuelo desde `payment.groupId → group.seasonId`, sin migrar pagos existentes ni añadirles campos nuevos.
6. Fuera de alcance: Jugadores, Agenda, Dashboard (ya resueltos con `isGroupCurrentlyActive` en trabajo previo), `RenewGroupsDialog`/`renewGroup`, y `Enrollment.seasonId` (se deriva siempre del grupo, no se guarda por separado).

## Arquitectura

### 1. Tipo `Club` — nuevo campo

En `src/types/index.ts`, añadir a `interface Club` (junto a los demás campos de configuración):
```ts
activeSeasonId?: string  // temporada en la que el club está trabajando ahora mismo
```

### 2. Migración automática (`ensureActiveSeason`)

Nueva función en `src/stores/dataStore.ts`, expuesta como acción del store:
```ts
ensureActiveSeason: () => Promise<void>
```

Lógica (idempotente, se puede llamar varias veces sin efecto tras la primera ejecución real):
1. Leer `get().club`. Si `club.activeSeasonId` ya está definido → no hacer nada, retornar.
2. Buscar en `get().seasons` una temporada cuyo `name` sea exactamente `"Temporada 2025/2026"` (comparación case-insensitive tras `trim()`). Si no existe, crearla vía la lógica ya usada por `addSeason` (mismo patrón: generar id, `syncDoc('seasons', ...)`), con `startDate`/`endDate` cubriendo el curso actual (usar `club.seasonStart`/`club.seasonEnd` si están definidos como valores razonables; si no, dejar `startDate`/`endDate` como el 1 de septiembre del año académico en curso y el 30 de junio siguiente, siguiendo el mismo criterio que ya usa el formulario de creación manual de temporadas en `SeasonsPage.tsx`).
3. Para cada grupo en `get().groups` con `isActive === true && !g.seasonId`: actualizar `seasonId` a la temporada del paso 2, tanto en el estado local (`set`) como en Firestore (`syncDoc('groups', ...)`), en un único batch si el volumen lo justifica (usar `writeBatch` de Firestore, igual que `renewGroup`, para evitar N escrituras sueltas).
4. Actualizar `club.activeSeasonId` a la temporada del paso 2, vía la misma lógica que `updateClub`.

**Cuándo se llama:** solo cuando el rol del usuario autenticado es `director` o `coordinador` (las reglas de Firestore ya restringen la escritura en `clubs`/`groups`/`seasons` a `isAdmin()` — un `entrenador`/`jugador`/`tutor` no debe intentar esta escritura y fallaría con permission-denied). Se invoca una vez, tras la primera carga completa de datos: en `src/stores/authStore.ts`, dentro del callback `onFirstLoad` que ya se pasa a `subscribeToAllData` (`authStore.ts:167-169`), añadir la llamada a `ensureActiveSeason()` condicionada al rol:
```ts
_dataUnsubscribe = subscribeToAllData(appUser.clubId, appUser.role, () => {
  setDataLoading(false)
  if (appUser.role === 'director' || appUser.role === 'coordinador') {
    useDataStore.getState().ensureActiveSeason()
  }
})
```

### 3. `SeasonSwitcher` — selector en la cabecera

Nuevo componente `src/components/layout/SeasonSwitcher.tsx`, mismo patrón visual/estructural que `ChildSwitcher.tsx` (dropdown con `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem`, píldora con texto + `ChevronDown`, marca de check en la opción activa).

- Solo se renderiza cuando el rol activo (`useAuthStore().user?.activeRole ?? user?.role`) es `director` o `coordinador`. Para el resto de roles retorna `null` (igual que `ChildSwitcher` retorna `null` si el rol no es `tutor`).
- Lee `club.activeSeasonId` y `seasons` de `useDataStore`. Si solo hay una temporada, muestra el nombre sin desplegable (igual que `ChildSwitcher` con un solo hijo).
- Al seleccionar una temporada distinta, llama a `updateClub({ activeSeasonId: seasonId })` (acción ya existente, `dataStore.ts:549`).
- Se añade a `Header.tsx`, junto a `ChildSwitcher` (ambos son mutuamente excluyentes por rol, así que no compiten por espacio en la práctica).

### 4. `GroupsPage.tsx` — filtro por temporada activa

- `filteredGroups` (líneas 109-136) gana una condición adicional: por defecto, solo incluir grupos cuyo `seasonId === club.activeSeasonId`.
- Nuevo filtro en la barra de filtros existente (junto a nivel/entrenador): un `Select` "Temporada", con opciones = todas las `seasons` existentes + una opción "Todas las temporadas". Por defecto seleccionado: la temporada activa. Cambiar este filtro **no** modifica `club.activeSeasonId` — es solo una vista local de esta página (estado de componente, no store).
- Grupos sin `seasonId` (no debería haber ninguno tras la migración del punto 2, pero por robustez): se incluyen en la vista "Todas las temporadas" y se excluyen de cualquier temporada específica.
- La etiqueta "Finalizado" (`isGroupStale`) no cambia.

### 5. `PaymentsPage.tsx` — filtro por temporada

- Nuevo filtro `Select` "Temporada" en la barra de filtros existente, con las mismas opciones que en Grupos (todas las `seasons` + "Todas las temporadas"). **Por defecto: "Todas las temporadas"** (a diferencia de Grupos, aquí no se oculta nada por defecto — es una herramienta de consulta, no una vista de trabajo).
- Al filtrar por una temporada concreta: para cada `payment`, resolver `groups.find(g => g.id === payment.groupId)?.seasonId === temporadaSeleccionada`. Pagos cuyo grupo no se encuentre (grupo eliminado) o no tenga `seasonId` quedan fuera del filtro cuando se selecciona una temporada específica (pero visibles en "Todas las temporadas").
- No se modifica la generación de recibos, ni el documento `Payment`, ni se añade `seasonId` a `Payment`.

## Fuera de alcance

- `RenewGroupsDialog`/`renewGroup`: sin cambios. El admin sigue traspasando grupos manualmente y luego cambia la temporada activa cuando quiera "mudarse" a la nueva — este spec no automatiza ese cambio.
- Jugadores, Agenda, Dashboard: sin cambios, siguen mostrando el estado real "de hoy" vía `isGroupCurrentlyActive` (trabajo de una sesión anterior), que es independiente de la temporada activa.
- `Enrollment.seasonId`: no se añade; la temporada de una matrícula se deriva siempre de su grupo.
- Generación de recibos: sin cambios (sigue por `isActive`).

## Tests

Vitest, siguiendo la convención del proyecto (solo lógica pura, no Firestore/Admin SDK):

- Función auxiliar de filtrado de grupos por temporada (extraída como función pura si `filteredGroups` lo permite, o probada indirectamente si la lógica es trivial e inline).
- Resolución de temporada de un pago a partir de `payment.groupId` + lista de `groups` (función pura, casos: grupo con `seasonId`, grupo sin `seasonId`, grupo no encontrado).

No se testea `ensureActiveSeason` end-to-end (requiere Firestore/Admin SDK) — se verifica manualmente.

## Verificación manual

1. `npm run build` y `npm test` en verde.
2. Con datos existentes (grupos sin `seasonId`), iniciar sesión como `director`. Confirmar que se crea/reutiliza "Temporada 2025/2026", que los grupos activos existentes quedan asignados a ella, y que `club.activeSeasonId` queda establecido — todo sin acción manual.
3. Confirmar que `SeasonSwitcher` aparece en la cabecera para `director`/`coordinador` y no para `entrenador`/`jugador`/`tutor`.
4. Crear una temporada nueva desde `SeasonsPage.tsx`, cambiarla a activa desde `SeasonSwitcher`. Confirmar que Grupos ahora muestra la lista vacía (o solo los grupos ya traspasados a esa temporada), y que un grupo nuevo creado en este momento queda etiquetado con la temporada activa.
5. Usar el filtro de temporada de Grupos para ver la temporada anterior sin cambiar la activa — confirmar que los grupos antiguos siguen apareciendo ahí y que `club.activeSeasonId` no cambió.
6. En Pagos, confirmar que el filtro por defecto muestra todo, y que seleccionar una temporada concreta reduce la lista a los pagos de grupos de esa temporada.
7. Confirmar que la generación de recibos no cambia de comportamiento (recibos ya existentes, y una generación manual de prueba, coinciden con lo esperado antes de este cambio).
