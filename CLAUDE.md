# San Javier Academy Manager — Instrucciones para Claude Code

## Descripción del Proyecto

Aplicación web de gestión académica para el Club de Padel San Javier. SPA construida con
React 19 + TypeScript + Vite en el frontend, y Firebase (Hosting, Cloud Functions, Firestore)
en el backend.

**Firebase Project ID**: `san-javieracademy-manager`
**URL producción**: `https://san-javieracademy-manager.web.app`

---

## Estructura del Repositorio

```
SanJavierAcademyManager/
├── src/                        # Frontend React + TypeScript
│   ├── components/             # Componentes UI
│   │   ├── layout/             # MainLayout, Sidebar, Header
│   │   ├── shared/             # Diálogos, formularios reutilizables
│   │   └── ui/                 # shadcn/ui components
│   ├── pages/                  # Páginas (Dashboard, Jugadores, Grupos, etc.)
│   ├── stores/                 # Estado global Zustand (persistido en localStorage)
│   ├── lib/                    # Firebase, utilidades, generación de PDFs/Excel
│   ├── types/                  # Tipos TypeScript compartidos
│   └── constants/              # Constantes de la aplicación
├── functions/                  # Firebase Cloud Functions (Node.js 18, TypeScript)
│   └── src/
│       ├── billing/            # Generación de recibos mensuales
│       └── triggers/           # Triggers de Firestore
├── .github/workflows/          # CI/CD con GitHub Actions
├── .claude/hooks/              # Hooks de Claude Code (locales)
├── firebase.json               # Configuración Firebase (hosting, functions, firestore)
├── firestore.rules             # Reglas de seguridad Firestore
├── firestore.indexes.json      # Índices compuestos Firestore
└── scripts/                    # Scripts utilitarios
    └── create-director.ts      # Crea usuario director inicial
```

---

## Comandos de Build

### Frontend (directorio raíz)
```bash
npm install                     # Instalar dependencias
npm run build                   # tsc + vite build → genera dist/
npm run dev                     # Servidor de desarrollo (localhost:5173)
npm run preview                 # Preview del build de producción
```

### Cloud Functions
```bash
npm --prefix functions install         # Instalar dependencias de funciones
npm --prefix functions run build       # tsc → genera functions/dist/
npm --prefix functions run build:watch # Modo watch
```

---

## Comandos de Despliegue

> Requiere Firebase CLI (`npm install -g firebase-tools`) y autenticación.

```bash
# Desplegar todo (hosting + functions + reglas Firestore)
firebase deploy

# Solo frontend
firebase deploy --only hosting

# Solo Cloud Functions (el predeploy hook de firebase.json hace el build automáticamente)
firebase deploy --only functions

# Hosting + Functions
firebase deploy --only hosting,functions

# Solo reglas e índices de Firestore
firebase deploy --only firestore
```

---

## Workflow de Git

### Ramas
- **master** — Rama de producción. Push aquí activa el deploy automático via GitHub Actions.
- **develop** — Rama de integración.
- **claude/*** — Ramas de trabajo de Claude Code.

### Flujo de trabajo
```bash
# Trabajar en una rama feature
git checkout -b claude/nombre-feature

# Hacer commits
git add <archivos>
git commit -m "feat: descripción breve"
git push -u origin claude/nombre-feature

# Cuando está listo para producción, mergear a master
git checkout master
git merge claude/nombre-feature
git push origin master  # Activa el deploy automático
```

### Prefijos de commit
- `feat:` — Nueva funcionalidad
- `fix:` — Corrección de bug
- `refactor:` — Refactorización sin cambio de comportamiento
- `docs:` — Documentación
- `chore:` — Tareas de mantenimiento (config, deps, etc.)

---

## CI/CD (GitHub Actions)

El archivo `.github/workflows/deploy.yml` despliega automáticamente a Firebase cuando
se hace push a `master` o `main`.

**Secret requerido en GitHub**: `FIREBASE_SERVICE_ACCOUNT`
- Obtener en: Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada
- Agregar en: GitHub repo → Settings → Secrets and Variables → Actions

---

## Emuladores Locales Firebase

```bash
firebase emulators:start     # Inicia todos los emuladores
# Puertos: Auth 9099 | Functions 5001 | Firestore 8080 | Hosting 5000
```

---

## Convenciones del Proyecto

- **Alias de importación**: `@/` → `src/` (configurado en `tsconfig.json` y `vite.config.ts`)
- **Estado global**: Zustand stores en `src/stores/`, todos persistidos en localStorage
- **Formularios**: React Hook Form + Zod para validación
- **Estilos**: Tailwind CSS v4 via plugin de Vite
- **Iconos**: Lucide React
- **Gráficas**: Recharts
- **PDFs**: jsPDF
- **Excel**: xlsx
- **TypeScript**: Modo strict activado; `noEmit: true` en frontend (Vite maneja la compilación)
- **Functions**: CommonJS modules (`"module": "commonjs"` en `functions/tsconfig.json`)

---

## Roles de Usuario

El sistema tiene control de acceso basado en roles (definido en `firestore.rules`):
- `director` — Acceso total
- `coordinador` — Acceso administrativo
- `entrenador` — Acceso a sus grupos y jugadores
- `jugador` — Acceso a su propio perfil

---

## Script de Inicialización

Para crear el primer usuario director en Firebase:
```bash
npx tsx scripts/create-director.ts
# Crea: andresfernandez@clubdepadelsanjavier.es / 123456
```
