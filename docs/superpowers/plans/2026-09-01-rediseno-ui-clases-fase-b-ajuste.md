# Rediseño UI Clases — Ajuste de Fase B (Grupos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar las 3 divergencias reales encontradas entre `GroupsPage.tsx` y el mock: quitar la lista de alumnos de las tarjetas, dividir la fila de filtros en principal/secundaria, y aligerar el estilo de los metadatos y del toggle de vista.

**Architecture:** Cambios contenidos en un único archivo (`src/pages/GroupsPage.tsx`), sin tocar tipos, stores, ni otros componentes. Es un ajuste visual/estructural, no se cambia ninguna lógica de filtrado, cálculo de métricas, ni el diálogo de crear/editar grupo.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-09-01-rediseno-ui-clases-fase-b-ajuste-design.md`

---

### Task 1: Quitar lista de alumnos, dividir filtros, aligerar metadatos y toggle

**Files:**
- Modify: `src/pages/GroupsPage.tsx`

- [ ] **Step 1: Quitar la lista de alumnos de la vista de tarjetas**

Cambiar:

```tsx
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.map((group) => {
              const activeEnrollments = enrollments.filter(e => e.groupId === group.id && e.isActive)
              const groupPlayers = activeEnrollments
                .map(e => players.find(p => p.id === e.playerId))
                .filter(Boolean) as any[]

              const displayPlayers = groupPlayers.slice(0, 4)
              const remainingPlayers = groupPlayers.length - 4

              return (
```

por:

```tsx
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.map((group) => {
              return (
```

Cambiar (quitar por completo el bloque de la lista de alumnos, que hoy está
entre el bloque de metadatos y el de Ocupación):

```tsx
                    <div className="flex-1 min-h-[100px]">
                      {groupPlayers.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Alumnos ({group.currentEnrollment})
                          </div>
                          <div className="space-y-1.5">
                            {displayPlayers.map(p => (
                              <div key={p.id} className="flex items-center gap-2 text-sm">
                                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
                                  {p.firstName?.charAt(0)}{p.lastName?.charAt(0)}
                                </div>
                                <span className="truncate font-medium text-foreground/90">{p.firstName}</span>
                              </div>
                            ))}
                            {remainingPlayers > 0 && (
                              <div className="text-xs text-muted-foreground pl-8 pt-0.5">
                                + {remainingPlayers} alumno{remainingPlayers !== 1 ? 's' : ''} más
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center border-2 border-dashed rounded-lg p-4 bg-muted/20">
                          <span className="text-sm text-muted-foreground">Sin alumnos inscritos</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-2 border-t mt-auto">
```

por:

```tsx
                    <div className="space-y-1.5 pt-2 border-t mt-auto">
```

(La vista de tabla NO se toca — su propio cálculo local de `groupPlayers`
dentro del `.map()` de filas, líneas 675-679 del archivo actual, sigue
igual, es independiente del de la vista de tarjetas que acabamos de
quitar.)

- [ ] **Step 2: Aligerar el estilo de los metadatos de cada tarjeta**

Cambiar:

```tsx
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded-lg">
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate" title={group.coachName || 'Sin entrenador'}>{group.coachName || 'Sin entrenador'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate" title={group.courtName || 'Sin pista'}>{group.courtName || 'Sin pista'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 col-span-2 truncate">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate" title={formatSchedule(group.schedule)}>{formatSchedule(group.schedule)}</span>
                      </div>
                    </div>
```

por:

```tsx
                    <div className="space-y-1.5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate" title={group.coachName || 'Sin entrenador'}>{group.coachName || 'Sin entrenador'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate" title={group.courtName || 'Sin pista'}>{group.courtName || 'Sin pista'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate" title={formatSchedule(group.schedule)}>{formatSchedule(group.schedule)}</span>
                      </div>
                    </div>
```

(Solo cambia el contenedor: de `grid grid-cols-2 ... bg-muted/30 p-2
rounded-lg` a `space-y-1.5`, y se quita `col-span-2` de la fila del
horario ya que no hay más grid. Las 3 filas internas quedan igual.)

- [ ] **Step 3: Dividir la fila de filtros en principal + secundaria, con el toggle a texto+icono**

Cambiar todo el bloque de filtros (desde `{/* Filters and view toggle */}`
hasta el cierre de ese `<div>`, antes de `{/* Content */}`):

```tsx
        {/* Filters and view toggle */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <Select
            options={[
              { value: 'schedule', label: 'Ordenar: Horario' },
              { value: 'name', label: 'Ordenar: Nombre' },
            ]}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'schedule' | 'name')}
            className="w-full sm:w-40"
          />
          {!isEntrenador && (
            <Select
              options={[
                { value: '', label: 'Todos los entrenadores' },
                ...activeCoaches.map((c) => ({
                  value: c.id,
                  label: `${c.firstName} ${c.lastName}`
                }))
              ]}
              value={coachFilter}
              onChange={(e) => setCoachFilter(e.target.value)}
              className="w-full sm:w-48"
            />
          )}
          <Select
            options={[
              { value: '', label: 'Todos los niveles' },
              ...PLAYER_LEVELS.map((l) => ({ value: l.value, label: l.label })),
            ]}
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="w-full sm:w-48"
          />
          <Select
            options={[
              { value: '', label: 'Todos los días' },
              ...DAYS_OF_WEEK.map((d) => ({ value: String(d.value), label: d.label })),
            ]}
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
            className="w-full sm:w-40"
          />
          <Select
            options={[
              { value: '', label: 'Todos' },
              { value: 'hueco', label: 'Con hueco' },
              { value: 'completo', label: 'Completo' },
            ]}
            value={capacityFilter}
            onChange={(e) => setCapacityFilter(e.target.value)}
            className="w-full sm:w-36"
          />
          <Select
            options={[
              { value: '', label: activeSeasonForEmptyState ? `Temporada actual: ${activeSeasonForEmptyState.name}` : 'Temporada actual' },
              { value: ALL_SEASONS, label: 'Todas las temporadas' },
              ...seasons.map((s) => ({ value: s.id, label: s.name })),
            ]}
            value={seasonFilter}
            onChange={(e) => setSeasonFilter(e.target.value)}
            className="w-full sm:w-56"
          />
          <div className="flex items-center border rounded-md shrink-0">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              className="h-10 w-10 rounded-r-none"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              className="h-10 w-10 rounded-l-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={filteredGroups.length === 0}>
            <FileDown className="h-4 w-4 mr-1" />
            Exportar PDF
          </Button>
        </div>
```

por (fila principal igual al orden del mock — Nivel, Entrenador, Día,
Plazas, toggle con texto — y fila secundaria con Ordenar/Temporada/Exportar
PDF en tamaño reducido):

```tsx
        {/* Filtros: fila principal (igual al mock) */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <Select
            options={[
              { value: '', label: 'Todos los niveles' },
              ...PLAYER_LEVELS.map((l) => ({ value: l.value, label: l.label })),
            ]}
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="w-full sm:w-48"
          />
          {!isEntrenador && (
            <Select
              options={[
                { value: '', label: 'Todos los entrenadores' },
                ...activeCoaches.map((c) => ({
                  value: c.id,
                  label: `${c.firstName} ${c.lastName}`
                }))
              ]}
              value={coachFilter}
              onChange={(e) => setCoachFilter(e.target.value)}
              className="w-full sm:w-48"
            />
          )}
          <Select
            options={[
              { value: '', label: 'Todos los días' },
              ...DAYS_OF_WEEK.map((d) => ({ value: String(d.value), label: d.label })),
            ]}
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
            className="w-full sm:w-40"
          />
          <Select
            options={[
              { value: '', label: 'Todos' },
              { value: 'hueco', label: 'Con hueco' },
              { value: 'completo', label: 'Completo' },
            ]}
            value={capacityFilter}
            onChange={(e) => setCapacityFilter(e.target.value)}
            className="w-full sm:w-36"
          />
          <div className="flex items-center border rounded-md shrink-0">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4 mr-1.5" />
              Tarjetas
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4 mr-1.5" />
              Tabla
            </Button>
          </div>
        </div>

        {/* Filtros: fila secundaria (sin equivalente en el mock, funcionalidad existente) */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
          <Select
            options={[
              { value: 'schedule', label: 'Ordenar: Horario' },
              { value: 'name', label: 'Ordenar: Nombre' },
            ]}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'schedule' | 'name')}
            className="h-8 w-full text-xs sm:w-36"
          />
          <Select
            options={[
              { value: '', label: activeSeasonForEmptyState ? `Temporada actual: ${activeSeasonForEmptyState.name}` : 'Temporada actual' },
              { value: ALL_SEASONS, label: 'Todas las temporadas' },
              ...seasons.map((s) => ({ value: s.id, label: s.name })),
            ]}
            value={seasonFilter}
            onChange={(e) => setSeasonFilter(e.target.value)}
            className="h-8 w-full text-xs sm:w-52"
          />
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={filteredGroups.length === 0}>
            <FileDown className="h-4 w-4 mr-1" />
            Exportar PDF
          </Button>
        </div>
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build`
Expected: sin errores. Prestar atención a que no queden referencias sueltas
a `groupPlayers`/`displayPlayers`/`remainingPlayers`/`activeEnrollments`
dentro de la vista de tarjetas tras el Step 1 (la vista de tabla tiene su
propia copia local de estos nombres dentro de su propio `.map()`, esa NO se
toca ni genera conflicto).

Run: `npm test`
Expected: mismo número de tests que el baseline (esta página no tiene
tests dedicados).

- [ ] **Step 5: Verificación manual en navegador**

1. `npm run dev`, sesión como `director`, ir a `/clases/grupos`.
2. Vista de tarjetas: confirmar que ya NO aparece la lista de alumnos
   (nombres/avatares) en ninguna tarjeta — la tarjeta pasa directo de los
   3 datos (entrenador/pista/horario, ahora en lista simple sin caja de
   fondo) a la barra de Ocupación y el pie de Asistencia/Lista de espera.
3. Confirmar que el toggle de vista ahora muestra "Tarjetas"/"Tabla" con
   icono + texto, y que sigue cambiando de vista correctamente al pulsar.
4. Confirmar que la fila principal de filtros (Nivel, Entrenador, Día,
   Plazas) sigue filtrando igual que antes, y que aparece ANTES que una
   segunda fila más pequeña con Ordenar/Temporada/Exportar PDF, que
   también deben seguir funcionando exactamente igual que antes (probar
   cambiar el orden, cambiar de temporada, exportar el PDF).
5. Cambiar a vista de Tabla y confirmar que no cambió nada ahí (la tabla
   no estaba en el alcance de este ajuste).
6. Repetir como `entrenador`: sin filtro de Entrenador (igual que antes),
   sin botón "Nuevo grupo", tarjetas sin lista de alumnos igual que para
   director.
7. Confirmar en la consola del navegador que no hay errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add src/pages/GroupsPage.tsx
git commit -m "fix: quitar lista de alumnos de tarjetas y reordenar filtros de Grupos segun el mock"
```

---

### Task 2: Verificación final

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Build y tests completos**

Run: `npm run build`
Expected: sin errores.

Run: `npm test`
Expected: mismo resultado que antes de este ajuste (esta página no tiene
tests dedicados, así que el conteo total no debería cambiar).

- [ ] **Step 2: Comparación visual final contra el mock**

Tomar una captura de la vista de tarjetas de `/clases/grupos` y compararla
con el nodo `adT95` del mock (`san javier.pen`) — confirmar que la altura y
densidad de las tarjetas ahora es comparable (mismo número de bloques:
cabecera, metadatos, ocupación, pie), y que la fila de filtros principal
tiene el mismo conjunto de controles que el mock (Nivel, Entrenador, Día,
Plazas, toggle con texto), con Ordenar/Temporada/Exportar PDF visiblemente
secundarios debajo.

- [ ] **Step 3: Repetir el proceso de `subagent-driven-development`**

Tras completar la Task 1 (implementador + revisor de spec + revisor de
calidad), dispatch un revisor final sobre el diff completo de este plan.
Después, usar `superpowers:finishing-a-development-branch`.
