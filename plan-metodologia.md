# Módulo de Metodología (El Cerebro)

## Goal

Crear el catálogo global de parámetros metodológicos (técnicos, tácticos, físicos, mentales) que servirá como base centralizada para diseñar planes de entrenamiento, permitiendo filtrado por niveles, adjuntar recursos multimedia y crear plantillas de entrenamiento con pesos ("pelotitas").

## Tasks

- [x] Task 1: Definir Esquema de Datos → Verify: Revisar archivo `src/types/methodology.ts` con interfaces para `Parameter` (id, nombre, categoría, nivel, videoUrl) y `TrainingPlan`.
- [x] Task 2: Crear Servicio Firestore → Verify: Revisar funciones CRUD en `src/lib/methodology-service.ts` para leer, crear, actualizar y eliminar (o archivar) parámetros.
- [x] Task 3: Actualizar Reglas de Firestore → Verify: Desplegar reglas que permitan a Directores escribir/leer en la nueva colección `methodology_parameters` y Entrenadores solo leer.
- [x] Task 4: Crear Interfaz del Catálogo (Lista/Tabla) → Verify: Renderizar `src/pages/MethodologyPage.tsx` con filtros visuales por Categoría y Nivel.
- [x] Task 5: Crear Formulario de Creación/Edición → Verify: Abrir modal o página, rellenar datos, adjuntar enlace de YouTube y guardar exitosamente en la base de datos.
- [x] Task 6: Añadir Función de Duplicado ("Clonar") → Verify: Seleccionar parámetro existente, clicar "Duplicar" y verificar que se abre el formulario pre-rellenado con (Copia).
- [x] Task 7: Añadir Módulo al Menú Principal → Verify: Comprobar que en el `MainLayout` / `Sidebar`, el rol Director y Coordinador ven el acceso a "Metodología".

## Done When

- [x] El Director puede acceder a la sección "Metodología".
- [x] El Director puede crear, filtrar, editar y duplicar parámetros con enlaces multimedia.
- [x] La base de datos refleja los cambios correctamente mediante un único catálogo global.

## Notes

- **Fase 1 (Actual)**: Centrada 100% en el CRUD del vocabulario/parámetros.
- Las plantillas de entrenamiento completas (con pesos y "pelotitas" detalladas) y la asignación a grupos específicos se abordarán como la Fase 1.5 o Fase 2, una vez este "diccionario global" esté construido y sea robusto.
- Se usarán Etiquetas (Tags) globales como decidiste, para facilitar futuros cruces de datos.
