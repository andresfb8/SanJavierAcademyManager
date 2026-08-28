# Rediseño CoachDashboard.tsx — Fase 2a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestructurar `src/pages/CoachDashboard.tsx` para que la clase actual/próxima y sus
avisos de asistencia relevantes protagonicen un único bloque héroe arriba de todo (mobile-first,
sin elementos `fixed`/`sticky`/`absolute` nuevos), eliminando la sección "Avisos de Alumnos" y la
tarjeta de clase activa duplicada que existen hoy por separado. El resto de clases de hoy pasa a
mostrarse en una lista reducida (sin la destacada) con un badge de avisos por fila. Mi
Rendimiento, Acciones Rápidas y Actividad Reciente no cambian de contenido ni lógica.

**Architecture:** Todo el cambio vive en un único archivo, `src/pages/CoachDashboard.tsx`. Se
añaden derivaciones nuevas (`useMemo` inline, mismo patrón que ya usa el archivo para
`activeClass`/`todayClasses`/`estimatedSalary`) — no se crea ningún archivo en `src/lib/` porque
es composición de datos ya calculados específica de esta página, no una regla de negocio
reutilizable. Sin componentes nuevos de `src/components/ui/`, sin dependencias nuevas.

**Tech Stack:** React 19 + TypeScript, Zustand (`useDataStore`), Tailwind v4, lucide-react
(iconos ya importados en el archivo, no hace falta añadir ninguno).

**Diseño de referencia:** `docs/superpowers/specs/2026-08-28-coach-dashboard-rediseno-design.md`

---

## Task 1: Derivaciones nuevas (avisos agrupados, clase destacada, lista reducida)

**Files:**
- Modify: `src/pages/CoachDashboard.tsx`

Añade la lógica de datos que consumirán las Tareas 2 y 3, sin tocar aún el JSX. `tsc` no falla
por variables sin usar temporalmente (`noUnusedLocals: false` en `tsconfig.json`), así que este
paso es seguro de commitear solo.

- [ ] **Step 1: Leer el archivo actual**

Leer `src/pages/CoachDashboard.tsx` completo y localizar el final del `useMemo` de
`todayClasses` (termina en `}, [currentCoachId, groups, attendance, enrollments,
cancelledClasses, todayDateStr])`) y el inicio del `if (!currentCoachId) {` justo después.
Confirma que el contenido coincide con lo descrito en este plan antes de editar — si no
coincide de forma que no puedas resolver con confianza, pregunta antes de improvisar.

- [ ] **Step 2: Insertar las nuevas derivaciones**

Insertar, entre el cierre del `useMemo` de `todayClasses` y el `if (!currentCoachId) {`:

```tsx
  // -- Avisos de hoy agrupados por grupo (para el héroe y los badges de la lista) --
  const todayNoticesForCoach = useMemo(() => {
    return attendanceNotices.filter(notice => {
      const noticeDate = notice.date instanceof Date ? notice.date : new Date(notice.date as unknown as string)
      const noticeLocal = new Date(noticeDate.getTime() - noticeDate.getTimezoneOffset() * 60000).toISOString().split('T')[0]
      const nowLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0]
      const coachGroupIds = groups.filter(g => g.coachId === currentCoachId).map(g => g.id)
      return noticeLocal === nowLocal && coachGroupIds.includes(notice.groupId)
    })
  }, [attendanceNotices, groups, currentCoachId, now])

  const noticesByGroupId = useMemo(() => {
    const map = new Map<string, typeof todayNoticesForCoach>()
    for (const notice of todayNoticesForCoach) {
      const list = map.get(notice.groupId) ?? []
      list.push(notice)
      map.set(notice.groupId, list)
    }
    return map
  }, [todayNoticesForCoach])

  // -- Clase destacada del héroe: la activa si existe, si no la próxima sin empezar/cancelar --
  const nextUpcomingClass = useMemo(() => {
    if (activeClass) return null
    return todayClasses.find(tc => !tc.isCancelled && tc.classStart > now) ?? null
  }, [activeClass, todayClasses, now])

  const featuredClassGroupId = activeClass?.id ?? nextUpcomingClass?.group.id ?? null

  // -- Resto de clases de hoy, excluyendo la destacada del héroe --
  const remainingClasses = useMemo(
    () => todayClasses.filter(tc => tc.group.id !== featuredClassGroupId),
    [todayClasses, featuredClassGroupId]
  )
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: sin errores (las nuevas constantes no se usan todavía en el JSX, pero eso no rompe el
build en este proyecto).

- [ ] **Step 4: Commit**

```bash
git add src/pages/CoachDashboard.tsx
git commit -m "feat: añadir derivaciones de clase destacada y avisos agrupados en CoachDashboard"
```

---

## Task 2: Bloque héroe (sustituye "Avisos de Alumnos" y la tarjeta de clase activa duplicada)

**Files:**
- Modify: `src/pages/CoachDashboard.tsx`

Sustituye dos bloques por uno:
1. La sección completa `{/* -- Alertas de Asistencia -- */}` (el `<section>` con la grid de
   avisos "Avisos de Alumnos").
2. Dentro de la columna `lg:col-span-7`, el bloque `{/* Clase activa con widget detallado (solo
   si hay) */}` (el ternario `activeClass ? (<Card>...) : todayClasses.length === 0 ? (...) :
   null`).

Por un único bloque héroe, colocado **antes** de `{/* -- Widget Pasar Lista Rápido -- */}`, fuera
de la grid `lg:grid-cols-12` (a ancho completo, según el spec mobile-first — no debe compartir
fila con nada).

- [ ] **Step 1: Leer el archivo actual**

Confirma el contenido exacto de ambos bloques a sustituir (los tienes íntegros en el spec de
diseño, sección "Problema identificado", si necesitas referencia) antes de editar.

- [ ] **Step 2: Eliminar la sección "Avisos de Alumnos"**

Eliminar por completo el bloque:

```tsx
        {/* -- Alertas de Asistencia -- */}
        <section className="space-y-4">
          ...
        </section>

```

(todo el `<section>`, incluida la línea en blanco que le sigue).

- [ ] **Step 3: Insertar el bloque héroe justo antes de `{/* -- Widget Pasar Lista Rápido -- */}`**

```tsx
        {/* -- Héroe: clase destacada + sus avisos -- */}
        {activeClass ? (
          <Card className="border-none shadow-xl shadow-primary/5 rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-slate-100">
            <CardHeader className="pb-4 px-8 pt-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">{activeClass.name}</h3>
                  <p className="text-sm font-bold text-primary flex items-center gap-1.5 mt-0.5">
                    <Clock className="h-4 w-4" />
                    {activeClass.startTime} - {activeClass.endTime} · Pista {activeClass.courtName}
                  </p>
                </div>
                <Badge className="bg-emerald-500 text-white border-none px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse shadow-lg shadow-emerald-200">
                  En curso
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-8 pb-8 space-y-6">
              {/* Contador presentes/pendientes */}
              {(() => {
                const enrolled = enrollments.filter(e => e.groupId === activeClass.id && e.isActive);
                const record = attendance.find(a => a.groupId === activeClass.id && new Date(a.date).toDateString() === now.toDateString());
                const present = record ? record.records.filter(r => r.status === 'presente').length : 0;
                const pending = enrolled.length - (record?.records.length || 0);

                return (
                  <div className="flex gap-3">
                    <div className="flex-1 rounded-2xl bg-emerald-50 p-4 border border-emerald-100/50">
                      <div className="text-2xl font-black text-emerald-600">{present}</div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600/60">Presentes</div>
                    </div>
                    <div className="flex-1 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                      <div className="text-2xl font-black text-slate-600">{pending}</div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500/60">Pendientes</div>
                    </div>
                  </div>
                );
              })()}

              {renderNoticesList(noticesByGroupId.get(activeClass.id) ?? [])}

              <div className="space-y-4">
                {enrollments.filter(e => e.groupId === activeClass.id && e.isActive).slice(0, 5).map((enrollment) => {
                  const student = players.find(p => p.id === enrollment.playerId);
                  if (!student) return null;
                  const record = attendance.find(a => a.groupId === activeClass.id && new Date(a.date).toDateString() === now.toDateString());
                  const studentStatus = record?.records.find(r => r.playerId === student.id)?.status;

                  return (
                    <div key={student.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 font-black text-sm">
                          {student.firstName[0]}
                        </div>
                        <div>
                          <span className="text-sm font-black text-slate-800">{student.firstName} {student.lastName}</span>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{student.level}</p>
                        </div>
                      </div>
                      <div className={cn(
                        "h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all",
                        studentStatus === 'presente' ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200 text-slate-200"
                      )}>
                        <CheckCircle2 className="h-4.5 w-4.5" />
                      </div>
                    </div>
                  )
                })}
              </div>

              <Button
                className="w-full bg-slate-900 hover:bg-black text-white h-14 rounded-[1.5rem] font-black text-sm shadow-xl shadow-slate-200 transition-all active:scale-[0.98] mt-4"
                onClick={() => navigate(`/asistencia?groupId=${activeClass.id}`)}
              >
                Abrir Gestión de Lista
                <ChevronRight className="h-5 w-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        ) : nextUpcomingClass ? (
          <Card className="border-none shadow-sm rounded-[2.5rem] bg-white ring-1 ring-slate-100">
            <CardContent className="p-8 space-y-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tu próxima clase</p>
                <h3 className="text-lg font-black text-slate-900 mt-1">{nextUpcomingClass.group.name}</h3>
                <p className="text-sm font-bold text-primary flex items-center gap-1.5 mt-0.5">
                  <Clock className="h-4 w-4" />
                  {nextUpcomingClass.slot.startTime}–{nextUpcomingClass.slot.endTime} · {nextUpcomingClass.group.courtName} · {nextUpcomingClass.enrolledCount} alumnos
                </p>
              </div>

              {renderNoticesList(noticesByGroupId.get(nextUpcomingClass.group.id) ?? [])}

              <Button
                className="w-full bg-slate-900 hover:bg-black text-white h-14 rounded-[1.5rem] font-black text-sm shadow-xl shadow-slate-200 transition-all active:scale-[0.98]"
                onClick={() => navigate(`/asistencia?groupId=${nextUpcomingClass.group.id}`)}
              >
                Pasar lista
                <ChevronRight className="h-5 w-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 rounded-[2.5rem] border-2 border-dashed border-slate-100 bg-slate-50/50">
            <div className="h-16 w-16 rounded-3xl bg-white shadow-sm flex items-center justify-center mb-4">
              <CalendarCheck className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-400">Sin clases programadas hoy</p>
            <Button variant="link" onClick={() => navigate('/agenda')} className="text-xs text-primary font-black uppercase tracking-widest mt-2">Ver mi agenda</Button>
          </div>
        )}

```

- [ ] **Step 4: Añadir el helper `renderNoticesList` usado arriba**

Insertar como función local del componente, junto a las demás derivaciones (por ejemplo, justo
después de las que añadió la Tarea 1, antes del `if (!currentCoachId) {`):

```tsx
  // -- Lista compacta de avisos para el héroe (máx. 3 + "+N más") --
  const renderNoticesList = (notices: typeof todayNoticesForCoach) => {
    if (notices.length === 0) return null
    const visible = notices.slice(0, 3)
    const extra = notices.length - visible.length
    return (
      <div className="space-y-2">
        {visible.map(notice => (
          <div key={notice.id} className={cn(
            "flex items-center gap-3 rounded-2xl border p-3",
            notice.type === 'absent' ? "border-amber-100 bg-amber-50/40"
            : notice.type === 'uncertain' ? "border-violet-100 bg-violet-50/40"
            : "border-blue-100 bg-blue-50/40"
          )}>
            <div className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
              notice.type === 'absent' ? "bg-amber-100 text-amber-600"
              : notice.type === 'uncertain' ? "bg-violet-100 text-violet-600"
              : "bg-blue-100 text-blue-600"
            )}>
              <Bell className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black truncate text-slate-800">{notice.playerName}</p>
              <p className="text-[11px] font-medium text-slate-500 truncate">
                {notice.type === 'absent' ? 'No asistirá a clase hoy'
                : notice.type === 'uncertain' ? 'Está en duda para clase hoy'
                : 'Ha confirmado su asistencia'}
              </p>
            </div>
          </div>
        ))}
        {extra > 0 && (
          <p className="text-[11px] font-bold text-slate-400 text-center">+{extra} más</p>
        )}
      </div>
    )
  }
```

Nota: se usa `Bell` para los tres tipos de aviso en vez del `Trophy` que usaba hoy el tipo
`'absent'` en la sección "Avisos de Alumnos" original (ese uso de `Trophy` para una ausencia no
tenía sentido semántico — es una simplificación deliberada al compactar el componente, no un
requisito del spec, coméntalo en tu reporte si lo cambias por otra cosa).

- [ ] **Step 5: Eliminar la tarjeta de clase activa duplicada dentro de `lg:col-span-7`**

Dentro de la columna `lg:col-span-7 space-y-6`, eliminar por completo el bloque que empieza en
`{/* Clase activa con widget detallado (solo si hay) */}` y termina en `) : null}` (el ternario
`activeClass ? (<Card>...) : todayClasses.length === 0 ? (<div>...) : null`) — todo su contenido
ya vive ahora en el héroe (Step 3) o ya no se necesita (el estado vacío también está cubierto por
la rama `else` del héroe).

- [ ] **Step 6: Verificar build**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/pages/CoachDashboard.tsx
git commit -m "feat: unificar héroe de clase destacada en CoachDashboard, quitar avisos y tarjeta duplicados"
```

---

## Task 3: "Resto de clases de hoy" — excluir la destacada y añadir badge de avisos

**Files:**
- Modify: `src/pages/CoachDashboard.tsx`

- [ ] **Step 1: Cambiar el título y el contador de la sección**

Reemplazar:

```tsx
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                Clases de Hoy
                {todayClasses.length > 0 && (
                  <span className="ml-2 normal-case font-bold text-slate-300">({todayClasses.length})</span>
                )}
              </h3>
              {todayClasses.length > 0 && (
                <button
                  onClick={() => navigate('/asistencia')}
                  className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                >
                  Ver todas
                </button>
              )}
            </div>
```

por:

```tsx
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                Resto de Clases de Hoy
                {remainingClasses.length > 0 && (
                  <span className="ml-2 normal-case font-bold text-slate-300">({remainingClasses.length})</span>
                )}
              </h3>
              {remainingClasses.length > 0 && (
                <button
                  onClick={() => navigate('/asistencia')}
                  className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                >
                  Ver todas
                </button>
              )}
            </div>
```

- [ ] **Step 2: Usar `remainingClasses` en vez de `todayClasses` y añadir el badge de avisos**

Reemplazar:

```tsx
            {/* Lista de todas las clases de hoy */}
            {todayClasses.length > 0 && (
              <div className="space-y-3">
                {todayClasses.map(({ group, slot, isMarked, enrolledCount, isCancelled, cancelledId }) => {
                  const isActive = activeClass?.id === group.id
                  return (
                    <div
                      key={`${group.id}-${slot.startTime}`}
                      className={cn(
                        'flex items-center gap-4 rounded-2xl border p-4 transition-all',
                        isCancelled ? 'bg-red-50 border-red-200 opacity-75'
                        : isActive ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-white border-slate-100',
                      )}
                    >
                      <div className={cn(
                        'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-black',
                        isCancelled ? 'bg-red-100 text-red-400 line-through'
                        : isActive ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500',
                      )}>
                        {slot.startTime.slice(0, 5)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-bold truncate', isCancelled ? 'text-red-600 line-through' : isActive ? 'text-emerald-900' : 'text-slate-800')}>
                          {group.name}
                          {isActive && !isCancelled && <span className="ml-2 text-[10px] font-black text-emerald-600 uppercase">● En curso</span>}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {slot.startTime}–{slot.endTime} · {group.courtName} · {enrolledCount} alumnos
                        </p>
                      </div>
                      {isCancelled ? (
```

por:

```tsx
            {/* Lista del resto de clases de hoy (sin la destacada del héroe) */}
            {remainingClasses.length > 0 && (
              <div className="space-y-3">
                {remainingClasses.map(({ group, slot, isMarked, enrolledCount, isCancelled, cancelledId }) => {
                  const noticeCount = noticesByGroupId.get(group.id)?.length ?? 0
                  return (
                    <div
                      key={`${group.id}-${slot.startTime}`}
                      className={cn(
                        'flex items-center gap-4 rounded-2xl border p-4 transition-all',
                        isCancelled ? 'bg-red-50 border-red-200 opacity-75'
                        : 'bg-white border-slate-100',
                      )}
                    >
                      <div className={cn(
                        'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-black',
                        isCancelled ? 'bg-red-100 text-red-400 line-through'
                        : 'bg-slate-100 text-slate-500',
                      )}>
                        {slot.startTime.slice(0, 5)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-bold truncate', isCancelled ? 'text-red-600 line-through' : 'text-slate-800')}>
                          {group.name}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {slot.startTime}–{slot.endTime} · {group.courtName} · {enrolledCount} alumnos
                        </p>
                      </div>
                      {noticeCount > 0 && (
                        <Badge className="bg-amber-50 text-amber-700 border-amber-100 text-[10px] font-bold shrink-0">
                          {noticeCount} {noticeCount === 1 ? 'aviso' : 'avisos'}
                        </Badge>
                      )}
                      {isCancelled ? (
```

Nota importante: esta sustitución quita la variable `isActive` (ya no existe ninguna clase
"activa" dentro de esta lista — la destacada, si es la activa, ya no aparece aquí, se excluyó vía
`remainingClasses`). Asegúrate de que no queda ninguna referencia a `isActive` más abajo en este
mismo bloque `.map(...)` (el resto del JSX de cada fila — los botones Cancelar/Lista/Reabrir/
Pasar lista — no usa `isActive`, así que no debería hacer falta tocar nada más ahí, pero
verifícalo leyendo el archivo).

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: sin errores. Presta especial atención a que no quede ninguna referencia residual a
`isActive` sin definir tras el cambio del Step 2.

- [ ] **Step 4: Commit**

```bash
git add src/pages/CoachDashboard.tsx
git commit -m "feat: excluir clase destacada y añadir badge de avisos en Resto de Clases de Hoy"
```

---

## Task 4: Verificación final

**Files:** (ninguno — solo verificación)

- [ ] **Step 1: Build y tests**

Run: `npm run build`
Expected: sin errores.

Run: `npm test`
Expected: 146/146 tests pasan (este archivo no tiene tests propios, pero confirma que nada más
se rompió).

- [ ] **Step 2: Repaso de código para descartar solapamientos (sin navegador disponible)**

Lee el archivo final completo y confirma:
1. Ningún elemento nuevo usa `fixed`, `sticky` ni `absolute` (grep de esas clases en el diff de
   este plan — solo deben aparecer las que ya existían: el `Header` sticky, el bottom-nav fijo en
   `Sidebar.tsx`, y el diálogo de cancelar clase, ninguno de los tres tocado por este plan).
2. El héroe no tiene `overflow-hidden` ni una altura fija que pudiera recortar la lista de avisos
   o el botón CTA si hay 3 avisos + "+N más".
3. El héroe ocupa ancho completo en cualquier breakpoint (no está dentro de la grid
   `lg:grid-cols-12`).
4. `remainingClasses`, `featuredClassGroupId`, `nextUpcomingClass`, `noticesByGroupId`,
   `todayNoticesForCoach` y `renderNoticesList` se usan todos en el JSX final (nada queda huérfano
   de la Tarea 1).
5. La sección "Avisos de Alumnos" original y la tarjeta de clase activa duplicada ya no existen
   en el archivo (búscalas por su comentario original `{/* -- Alertas de Asistencia -- */}` y
   `{/* Clase activa con widget detallado (solo si hay) */}` — no deben aparecer).

Deja constancia en tu reporte de que, al no haber navegador/Playwright disponible en este
entorno, la verificación visual real en un móvil queda pendiente para el usuario.

- [ ] **Step 3: Confirmar que no queda nada sin commitear**

Run: `git status --short`
Expected: sin cambios pendientes.
