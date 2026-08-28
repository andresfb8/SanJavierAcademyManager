# Rediseño de UI — Fase 2a: reestructurar CoachDashboard.tsx

**Fecha:** 2026-08-28
**Estado:** aprobado, pendiente de plan de implementación
**Rama:** `claude/rediseno-ui`

## Contexto

Continuación del rediseño de UI (`docs/superpowers/specs/2026-08-28-rediseno-ui-shell-design.md`,
Fase 1 ya implementada: sidebar colapsable + Dashboard del director). El usuario pidió seguir con
"el apartado del entrenador". Tras revisar el código existente (`src/pages/CoachDashboard.tsx` y
el flujo de asistencia `src/components/attendance/QuickAttendanceSheet.tsx`), ambos ya están
bastante trabajados visualmente (tarjetas grandes redondeadas, botones táctiles ≥48px,
autoguardado) — el problema no es de estilo sino de **estructura y prioridad de la información**:
lo que el entrenador necesita nada más entrar (su clase actual/próxima y quién falta a ella) no
destaca frente al resto del contenido de la página.

**Decisión de alcance:** solo se toca `CoachDashboard.tsx` (el Dashboard/home del entrenador,
ruta `/` para el rol `entrenador`, ver `src/AuthenticatedApp.tsx`). No se toca
`QuickAttendanceSheet.tsx`, `AttendancePage.tsx`, `CoachProfilePage.tsx` ni el bloque `isCoach`
de `src/pages/DashboardPage.tsx` (que además es código muerto: la ruta `/` para `entrenador`
renderiza `CoachDashboard.tsx`, nunca `DashboardPage.tsx` — confirmado en
`src/AuthenticatedApp.tsx:119-126`).

## Problema identificado

Estructura actual de `CoachDashboard.tsx` (de arriba a abajo):
1. "Avisos de Alumnos" — grid de tarjetas con TODOS los avisos de asistencia de hoy de todos los
   grupos del coach, sin relacionarlos visualmente con la clase a la que afectan.
2. "Clases de Hoy" — lista compacta de todas las clases de hoy (incluida la activa, marcada con
   "● En curso").
3. Si hay `activeClass`, además una `Card` grande y detallada aparte (nombre, hora, contador
   presentes/pendientes, preview de 5 alumnos) — **duplicando** la misma clase que ya aparece en
   el punto 2.
4. "Mi Rendimiento" (salario estimado, horas/alumnos/grupos/hoy) en una columna lateral.
5. "Acciones Rápidas" (Nueva Evaluación, Ver mi Perfil).
6. "Actividad Reciente" (colapsable).

Nada destaca claramente como "lo primero que debes mirar", y la clase activa aparece dos veces
en sitios distintos con distinto nivel de detalle.

## Decisiones de diseño (validadas con el usuario)

1. **Bloque héroe único, arriba de todo:** la clase actual/próxima como protagonista, con sus
   avisos de asistencia relevantes integrados dentro (no en una sección aparte), y la acción de
   pasar lista como CTA principal.
2. **"Clases de Hoy" pasa a ser solo el resto de clases** (excluyendo la que ya se muestra en el
   héroe), con un badge de aviso por clase si tiene alguno, sin repetir el detalle del héroe.
3. **Todo lo demás baja de prioridad visual:** Mi Rendimiento, Acciones Rápidas y Actividad
   Reciente se mantienen sin cambios de contenido ni de lógica, solo se reordenan para no competir
   con el bloque héroe.
4. **Sin componentes nuevos de shadcn/ui ni CLI.** Se construye a mano con `Card`/`Button`/`Badge`
   ya existentes en `src/components/ui/`, mismo enfoque que la Fase 1 (probado y descartado el CLI
   por sobreescribir archivos personalizados del proyecto sin fusionar).
5. **Mobile-first.** El entrenador usa esto sobre todo desde el móvil (en la pista, entre
   clases), así que el móvil es el diseño de referencia, no un extra que "también funcione":
   - El héroe ocupa **siempre el 100% del ancho**, en cualquier breakpoint — no comparte fila con
     nada ni en desktop, precisamente para que destaque igual de bien en pantallas pequeñas.
   - Su CTA principal ("Pasar lista" / "Abrir Gestión de Lista") es un botón de ancho completo
     (`w-full`), igual que ya lo es hoy el de la `Card` de clase activa.
   - Los avisos dentro del héroe se listan en columna simple (no en grid de 2-3 columnas como la
     sección "Avisos de Alumnos" actual, que no cabría bien dentro de una tarjeta en pantallas
     estrechas), máximo 3 visibles con un "+N más" si hay más.
   - "Resto de clases de hoy" + "Mi Rendimiento" mantienen el `grid-cols-1 lg:grid-cols-12` que
     ya existe (apilado completo en móvil, lista de clases antes que rendimiento), y las
     `StatCard` de rendimiento mantienen su `grid-cols-2` actual (ya pensado para móvil).
   - Se mantiene el `pb-20 lg:pb-8` del contenedor para que el contenido no quede tapado por el
     bottom-nav fijo en móvil.
6. **Sin cambios de lógica de negocio.** `currentCoachId`, `coachHoursThisMonth`,
   `coachAssignedPlayers`, `coachClassesToday`, `activeClass`, `estimatedSalary`, `todayClasses`,
   el diálogo de cancelar clase y `visibleActivities` no se tocan — es una reorganización de cómo
   se presentan los mismos datos, más dos derivaciones nuevas puramente de presentación (ver
   Arquitectura). Sigue el patrón ya establecido en el propio archivo (`useMemo` inline en el
   componente de página, sin extraer a `src/lib/`) — a diferencia de `dashboard-alerts.ts` en la
   Fase 1, aquí no hay una regla de negocio reutilizable por otro componente, es composición de
   datos ya calculados específica de esta página.

## Arquitectura

### 1. Dos derivaciones nuevas (inline, dentro de `CoachDashboard.tsx`)

**`noticesByGroupId`** — `Map<string, AttendanceNotice[]>`, agrupa los avisos de hoy (el mismo
filtro que ya existe hoy: fecha de hoy + grupo del coach) por `groupId`, para poder mostrar solo
los avisos relevantes de cada clase en vez de una lista plana global.

**`featuredClass`** — la clase que protagoniza el héroe:
- Si `activeClass` existe (ya calculado, clase en curso o a ≤60min), es la clase destacada, con
  el mismo nivel de detalle que tiene hoy la `Card` de clase activa (contador
  presentes/pendientes, preview de hasta 5 alumnos, botón "Abrir Gestión de Lista").
- Si no hay `activeClass` pero sí hay clases de hoy sin empezar y sin cancelar en `todayClasses`,
  la destacada es la primera de ellas por hora de inicio (`nextClass`) — versión más ligera del
  héroe: nombre/hora/pista/nº alumnos + avisos de su grupo + botón "Pasar lista" (mismo
  `navigate` que ya usan hoy los items de la lista), sin el preview de alumnos (no aporta antes
  de que empiece la clase).
- Si no hay ninguna clase de hoy sin cancelar, no hay héroe — se mantiene el estado vacío actual
  ("Sin clases programadas hoy" + enlace a "Ver mi agenda").

### 2. Estructura JSX resultante (de arriba a abajo)

1. **Héroe** (nuevo, sustituye a la sección "Avisos de Alumnos" y a la `Card` de clase activa
   actual): un único bloque grande con la `featuredClass`. Si es la `activeClass`, mismo
   contenido/estilo que la `Card` detallada de hoy (`rounded-[2.5rem]`, badge "En curso",
   contador presentes/pendientes, preview de alumnos), añadiendo dentro los avisos de
   `noticesByGroupId.get(featuredClass.groupId)` (mismo estilo de tarjeta de aviso que hoy,
   compactado). Si es `nextClass`, versión más ligera equivalente a un item de la lista actual
   pero más grande/destacada, con sus avisos también integrados. Si no hay clase, el estado vacío
   actual.
2. **Resto de clases de hoy:** la lista actual de `todayClasses`, pero **excluyendo** la
   `featuredClass` (para no duplicarla), y cada item añade un badge compacto
   (`⚠ N avisos`, usando `noticesByGroupId`) cuando su grupo tiene avisos ese día. Mismo
   comportamiento de botones (Pasar lista / Cancelar / Lista / Reabrir) que hoy, sin cambios.
   Si tras excluir la destacada no queda ninguna clase, no se renderiza esta sección (título
   incluido).
3. **Mi Rendimiento** (salario + StatCards de horas/alumnos/grupos/hoy): mismo contenido y
   lógica de hoy, se mantiene como columna lateral junto a "Resto de clases de hoy" (mismo
   patrón `grid-cols-12` 7/5 que ya existe, adaptado a que ahora conviven con la lista reducida
   en vez de con la lista completa + widget de clase activa).
4. **Acciones Rápidas** y **Actividad Reciente**: sin cambios, mismo sitio relativo (después del
   bloque anterior).

### 3. Qué NO cambia

- El diálogo de cancelar clase (`cancelDialog`/`cancelReason` y su JSX) se mueve de sitio en el
  archivo si hace falta pero su lógica y contenido no cambian.
- Los botones de acción de cada clase (Pasar lista / Cancelar / Lista / Reabrir) mantienen
  exactamente el mismo comportamiento (`navigate`, `setCancelDialog`, `deleteCancelledClass`).
- El estado "perfil no vinculado" (`!currentCoachId`) no cambia.
- `Header` (título/subtítulo) no cambia.

### 4. Riesgo de superposición en móvil (a vigilar explícitamente)

El usuario ha señalado que las superposiciones en móvil son un problema recurrente en la app, así
que este punto se trata como requisito, no como nota al margen. Elementos con posicionamiento
especial ya existentes en la página/layout, que este rediseño **no debe añadir ni tocar**:

- `Header` (`src/components/layout/Header.tsx`): `sticky top-0 z-30`.
- Bottom-nav móvil (`src/components/layout/Sidebar.tsx`): `fixed bottom-0 ... z-40`, altura `h-16`
  — por eso el contenedor de `CoachDashboard.tsx` lleva `pb-20` (más margen que la altura real del
  nav, para no pegar el contenido al borde).
- Diálogo de cancelar clase (ya existente en `CoachDashboard.tsx`): `fixed inset-0 z-50`.

**Regla para este rediseño:** el héroe, la lista de "Resto de clases de hoy" y los badges de
avisos van en flujo normal del documento — nada de `fixed`/`sticky`/`absolute` nuevo. El único
riesgo real de superposición que introduce este cambio es de contenido, no de posicionamiento:
que la lista de avisos dentro del héroe (hasta 3 + "+N más") crezca más de la cuenta y empuje o
recorte el botón CTA en pantallas muy estrechas — se evita dejando que la tarjeta crezca en
altura de forma natural (sin `overflow-hidden` ni alturas fijas en el héroe) en vez de intentar
encajarlo en un contenedor de tamaño fijo.

## Fuera de alcance

- `QuickAttendanceSheet.tsx`, `AttendancePage.tsx`, `CoachProfilePage.tsx` — no se tocan.
- El bloque `isCoach` de `DashboardPage.tsx` (código muerto, inalcanzable desde el router) — no
  se limpia ni se toca en este plan, es una tarea de limpieza aparte si se decide hacerla.
- Portal de jugador (`PlayerDashboard.tsx`) — sigue siendo Fase 2b/3 futura, no este plan.
- Cambios de paleta de color o tipografía — se reutiliza el lenguaje visual ya existente en el
  propio `CoachDashboard.tsx` (rounded-[1.5rem]/[2rem]/[2.5rem], font-black, colores
  amber/emerald/blue/violet ya usados hoy en el archivo).

## Verificación manual

1. Como `entrenador` con una clase en curso ahora mismo: el héroe muestra la clase con el mismo
   detalle que antes (contador, preview de alumnos) más los avisos de esa clase integrados; esa
   clase ya no aparece también en "Resto de clases de hoy".
2. Como `entrenador` sin clase en curso pero con clases más tarde hoy: el héroe muestra la
   próxima clase (versión ligera) con sus avisos y botón "Pasar lista"; el resto de clases de hoy
   aparecen en la lista de abajo, con badge de avisos si les corresponde.
3. Como `entrenador` sin ninguna clase hoy (o todas canceladas): se mantiene el estado vacío
   actual, sin héroe ni lista.
4. Confirmar que un aviso de un grupo que NO es el destacado aparece como badge en su fila de la
   lista, no se pierde.
5. Confirmar que Mi Rendimiento, Acciones Rápidas y Actividad Reciente siguen funcionando igual
   (salario, StatCards, nueva evaluación, ver perfil, colapsar actividad).
6. **Superposición en móvil (ancho ~360-390px, el más estrecho habitual):**
   - Scrollear toda la página de arriba a abajo: ningún elemento debe quedar tapado por el
     bottom-nav fijo ni por el `Header` sticky al hacer scroll.
   - Con 3+ avisos en el héroe (forzar datos de prueba si hace falta): el "+N más" y el botón CTA
     deben seguir siendo pulsables, sin recortarse ni solaparse con la tarjeta.
   - Abrir el diálogo de cancelar clase con el teclado virtual activo (foco en el `select` de
     motivo): el diálogo debe seguir centrado/anclado abajo sin que el bottom-nav se superponga.
   - Nombres de alumno o de grupo largos (usa uno de prueba si no hay ninguno largo en los datos
     actuales) no deben desbordar la tarjeta ni superponerse con el badge de avisos o el botón.
7. `npm run build` y `npm test` sin errores.
