# Rediseño de interfaz — Módulo Clases, Fase E (Particulares y Eventos)

## Contexto

Continuación de las Fases A-D del rediseño de Clases. Mockups de
referencia en `san javier.pen`: `MorHZ` ("07 · Clases / Particulares") y
`f57Q4` ("08 · Clases / Eventos"). Hoy ambas pestañas comparten un único
componente, `src/pages/EventsActivitiesPage.tsx`, con un selector interno
Todos/Eventos/Particulares y una tabla unificada. Ninguno de los dos
mocks muestra ese selector ni esa tabla combinada — cada uno es una
pantalla propia y visualmente distinta.

## Alcance de esta fase

1. Dividir `EventsActivitiesPage.tsx` en dos páginas nuevas e
   independientes: `src/pages/PrivateLessonsPage.tsx` (fiel a `MorHZ`) y
   `src/pages/EventsPage.tsx` (fiel a `f57Q4`). Se elimina el selector
   interno "Todos" (no tiene ruta propia hoy — ver verificación abajo —,
   ni aparece en ningún mock).
2. `PrivateLessonsPage`: 4 KPIs, tabla a ancho completo (sin sidebar de
   Solicitudes/Tarifas, ver "fuera de alcance"), filtros existentes
   reubicados en fila secundaria.
3. `EventsPage`: lista de tarjetas de evento, calendario mensual
   interactivo, desglose de ingresos por tipo de evento, filtros
   existentes reubicados en fila secundaria.
4. `src/pages/EventsActivitiesPage.tsx` se elimina del repositorio una
   vez migradas las dos rutas.

**Verificación de que `EventsActivitiesPage` no se usa en ningún otro
sitio** (con `initialTab='all'` ni de ninguna otra forma): confirmado por
`grep` — solo aparece en `src/AuthenticatedApp.tsx`, en las rutas
`particulares` (`initialTab="private"`) y `eventos`
(`initialTab="events"`). Ninguna ruta usa el valor por defecto `'all'`.

Fuera de alcance (decisiones ya tomadas):
- **"Solicitudes pendientes"** (petición de clase particular por parte de
  un alumno + aprobación del staff con detección de conflictos) — es un
  flujo nuevo de verdad, no un reskin. No se construye en esta fase.
- **"Tarifas de particulares"** (tabla de precios configurable por
  duración/nº de alumnos/bonos, con autocompletado del precio al crear
  una clase) — funcionalidad nueva, no se construye en esta fase.
- El diálogo de crear clase particular/evento, `EventDetailPage.tsx` y
  `PrivateLessonDetailPage.tsx` no se tocan.
- La simplificación del KPI "Ocupación de pista" del mock, ver sección 2.

## 1. `EventsPage.tsx` (antes "Eventos" dentro de `EventsActivitiesPage`)

### Lista de tarjetas de evento (columna izquierda)

Por cada evento activo (`event.isActive`), una tarjeta con:
- Bloque de fecha destacado: día grande + mes abreviado en mayúsculas
  (`"30\nAGO"`), igual que el mock.
- Nombre del evento + badge de tipo, reutilizando `EVENT_TYPES` (label +
  color) ya existentes — **no se inventan categorías nuevas** distintas a
  `mini_torneo`/`clinic`/`exhibicion`/`social`, coherente con la decisión
  ya tomada en la Fase B de no simplificar taxonomías reales del modelo
  de datos para encajar con el mock.
- Línea de metadatos: horario (`startTime - endTime`), "`{courtIds.length}`
  pistas" (o el nombre de la pista si solo hay una — `courtNames[0]`
  cuando `courtIds.length === 1`), entrenador(es)
  (`coachNames.join(', ')`, o "Equipo técnico" si `coachNames.length ===
  0`, igual que el mock para el evento "Jornada de Puertas Abiertas").
- Barra de ocupación: `attendeePlayerIds.length` / `maxCapacity` (si no
  hay `maxCapacity`, se omite la barra y solo se muestra el número de
  inscritos, sin fracción).
- Precio: `formatCurrency(event.price)`, o "Gratis" si `price === 0`.
- Badge de estado de inscripción: "Completo" si
  `attendeePlayerIds.length >= maxCapacity` (y hay `maxCapacity`
  definido); en cualquier otro caso, "Inscripción abierta".

Clic en la tarjeta navega a `/eventos/:id` (ruta ya existente,
`EventDetailPage.tsx`, sin cambios).

### Calendario mensual (columna derecha, arriba)

Un calendario del mes en curso (con navegación mes anterior/siguiente),
con un punto bajo cada día que tenga al menos un evento activo. Al hacer
clic en un día con eventos, la lista de tarjetas de la izquierda se filtra
para mostrar solo los eventos de ese día (un segundo clic sobre el mismo
día, o un botón "Ver todos", quita el filtro). Cabecera del calendario
muestra "`{mes} {año}`" y "`{N} eventos`" (eventos activos de todo el mes
visible).

### Ingresos por evento (columna derecha, abajo)

Una tarjeta con una fila por cada valor de `EVENT_TYPES` (Mini Torneo /
Clinic / Exhibición / Evento Social), mostrando la suma de
`price * attendeePlayerIds.length` de los eventos activos de esa
categoría en la temporada activa del club, con una barra de progreso
proporcional al máximo de las 4 categorías (igual estética que el mock,
sin inventar categorías que no existen en `EventType`). Al final, un
total de temporada.

### Filtros existentes (fila secundaria)

Buscador (por nombre/entrenador/pista), filtro de Entrenador, y rango de
fechas (Desde/Hasta) — mismos 3 controles que ya existen hoy en
`EventsActivitiesPage`, reubicados en una fila secundaria más discreta
justo encima del layout de dos columnas (lista de tarjetas + calendario/
ingresos), mismo criterio ya usado en Grupos: tamaño reducido,
`text-muted-foreground`, claramente subordinados al contenido principal.

## 2. `PrivateLessonsPage.tsx` (antes "Particulares" dentro de `EventsActivitiesPage`)

### KPIs (fila superior, 4 tarjetas `StatCard`)

Calculados sobre las clases particulares del **mes en curso**
(`lesson.date` dentro del mes/año actual):

1. **Clases este mes**: recuento de `privateLessons` de ese mes.
2. **Facturado**: suma de `price` de esas clases, con la media por clase
   como descripción (`total / count`, redondeado a 2 decimales).
3. **Alumnos recurrentes**: nº de alumnos (excluyendo invitados —
   `playerId` que no empiece por `guest-`) que aparecen en 2 o más clases
   ese mes, con el total de alumnos distintos ese mes como descripción
   ("de N distintos").
4. **Pista más usada** — sustituye al "Ocupación Pista 4: 62%" del mock
   (decisión ya tomada: el mock exige un % de ocupación que necesitaría
   un dato de horas disponibles por pista que no existe hoy). Se muestra
   el nombre de la pista con más clases particulares ese mes y el número
   de clases, p.ej. "Pista 2 PDM" con descripción "6 clases este mes". Si
   no hay ninguna clase particular ese mes, este KPI (y los otros 3)
   muestran "Sin datos"/0 en vez de romper.

### Tabla (ancho completo, sin sidebar)

Columnas: Alumno (`playerNames.join(', ')`) / Fecha y hora / Pista /
Entrenador / Importe / Estado. "Estado" se calcula a partir de
`privateLessonPayments` de esa clase (filtrando por `lessonId`):
- Todos los pagos en `'pagado'` → badge "Pagada" (verde).
- Ningún pago, o al menos uno en `'pendiente'` → badge "Pendiente"
  (ámbar).
- Todos los pagos en `'cancelado'` → badge "Cancelada" (gris).

Ordenada por fecha descendente (más reciente primero), igual que la
tabla unificada actual.

### Filtros existentes (fila secundaria)

Mismos 3 controles que en `EventsPage` (buscador, Entrenador, rango de
fechas Desde/Hasta), en una fila secundaria bajo los KPIs y encima de la
tabla.

## Fuera de alcance / riesgos conocidos

- Al calcular "Alumnos recurrentes" e "Ingresos por evento" sobre todos
  los registros del mes/temporada, el coste es lineal sobre
  `privateLessons`/`events` — mismo criterio de aceptación de coste que
  fases anteriores (Grupos, Parrilla, Asistencia) con el volumen de datos
  actual del club.
- El calendario de `EventsPage` no reutiliza `AttendanceCalendar.tsx` (ese
  componente está acoplado a un grupo/su historial de asistencia) — se
  construye una versión ligera y de propósito específico para
  este caso (mes + puntos + clic para filtrar), sin funcionalidad de
  navegación entre meses múltiples más allá de anterior/siguiente.
- Como en Grupos/Parrilla, la fila de filtros existentes no tiene
  equivalente en el mock — se acepta que sea una adición visible pero
  subordinada, no se inventa un lugar en el mock donde no lo hay.
