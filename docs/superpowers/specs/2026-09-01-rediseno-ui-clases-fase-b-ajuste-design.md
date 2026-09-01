# Rediseño de interfaz — Ajuste de Fase B (Grupos)

## Contexto

Al terminar la Fase B (filtros nuevos, métricas de asistencia/lista de
espera, menú "···") se comparó el resultado contra el mock (`san javier.pen`,
nodo `adT95`, "06 · Clases / Grupos") y se encontraron 3 divergencias reales
que no habían sido aprobadas explícitamente — se decidió arreglarlas en una
fase separada, después de terminar la Fase C (Parrilla). Este documento es
el spec de ese ajuste.

## Alcance de este ajuste

1. Quitar el bloque "ALUMNOS (n): lista de nombres" de la vista de
   tarjetas — el mock no lo muestra, y hace que nuestras tarjetas sean mucho
   más altas que las del mock.
2. Dividir la fila de filtros en dos: una fila principal igual al mock
   (Nivel, Entrenador, Día, Plazas, toggle Tarjetas/Tabla) y una fila
   secundaria más discreta debajo con los controles que el mock no tiene
   pero que son funcionalidad real (Ordenar, Temporada, Exportar PDF).
3. Estilo de los metadatos de cada tarjeta: pasar de una caja con fondo en
   grid de 2 columnas a una lista simple sin fondo, como en el mock. El
   toggle de vista gana etiquetas de texto ("Tarjetas"/"Tabla") junto a los
   iconos.

Explícitamente descartado (decisión ya tomada, no se revisita aquí):
- No se restaura un buscador propio en la fila de filtros — el buscador del
  topbar (Fase B) es suficiente.
- No se toca la vista de tabla (ya tenía un estilo de metadatos en lista
  simple sin caja, coincide con el mock).
- No se toca el diálogo de crear/editar grupo ni el de confirmación de
  borrado.
- No se adopta la simplificación de niveles a 3 categorías del mock
  (decisión ya tomada en la Fase B original).

## 1. Quitar la lista de alumnos de las tarjetas

Se elimina por completo el bloque `<div className="flex-1 min-h-[100px]">
{groupPlayers.length > 0 ? ... : ...}</div>` (líneas 565-592 del archivo
actual) de la vista de tarjetas. La tarjeta pasa directamente de los
metadatos a la barra de Ocupación.

Como consecuencia, las variables `activeEnrollments`/`groupPlayers`/
`displayPlayers`/`remainingPlayers` (calculadas dentro del `.map()` de la
vista de tarjetas, líneas 503-509) dejan de usarse en esa vista y se
eliminan de ahí — la vista de tabla sigue calculando su propia versión
local de `groupPlayers` de forma independiente (líneas 675-679), sin
cambios.

## 2. Fila de filtros dividida en dos

**Fila principal** (coincide con el orden del mock): Nivel, Entrenador
(oculto para `entrenador`, igual que hoy), Día, Plazas, y el toggle
Tarjetas/Tabla con icono + texto:

```tsx
<Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('grid')}>
  <LayoutGrid className="h-4 w-4 mr-1.5" /> Tarjetas
</Button>
<Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')}>
  <List className="h-4 w-4 mr-1.5" /> Tabla
</Button>
```

**Fila secundaria**, debajo, con estilo más discreto (`text-sm`, sin el
mismo peso visual que la principal): Ordenar, Temporada, Exportar PDF —
mismos controles que ya existen hoy, solo reordenados a una segunda fila.

Ninguno de los filtros existentes cambia de comportamiento, solo de
posición dentro del layout.

## 3. Estilo de metadatos y toggle

El bloque de metadatos de cada tarjeta (`entrenador · pista · horario`)
pasa de:

```tsx
<div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded-lg">
```

a una lista simple, una línea por dato, sin caja de fondo:

```tsx
<div className="space-y-1.5 text-sm text-muted-foreground">
```

manteniendo cada fila (`flex items-center gap-1.5`, icono + texto con
`truncate`/`title`) igual que hoy, solo sin el `grid-cols-2`/`bg-muted/30`
que las agrupaba en una caja de 2 columnas.

## Fuera de alcance / riesgos conocidos

- Quitar la lista de alumnos de la tarjeta no borra el dato en ningún
  sitio — sigue visible en la vista de tabla (columna "Alumnos") y en la
  ficha del grupo (`GroupDetailPage.tsx`, no tocada).
- La fila secundaria de filtros no tiene mock de referencia. Para que se
  note subordinada a la principal sin parecer deshabilitada: mismos
  componentes `Select`/`Button` pero en tamaño `sm` (en vez del tamaño por
  defecto de la fila principal), envueltos en `text-sm text-muted-foreground`
  y con algo menos de espacio vertical respecto a la fila principal
  (`pt-1` en vez de `gap-3` completo). Sin borde ni caja separadora — solo
  la diferencia de tamaño/color marca la jerarquía.
