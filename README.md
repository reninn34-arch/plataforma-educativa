# Atlas Edu

Plataforma educativa integral para el sistema PCEI (Programa de Curricular para Educacion Intensiva) de Ecuador. Diseñada para acelerar la educación secundaria de adultos a través de herramientas con inteligencia artificial, seguimiento de progreso y comunicación entre estudiantes, docentes y administradores.

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript |
| Base de datos | PostgreSQL + Drizzle ORM |
| Estilos | Tailwind CSS v4 + shadcn/ui |
| Autenticación | JWT (jose) + bcrypt |
| IA | Vercel AI SDK (OpenCode/OpenAI/Anthropic/Gemini) |
| PWA | Service Worker + Web Manifest |
| Email | Nodemailer (SMTP) |
| Testing | Vitest (unitarios + integración) |
| CI/CD | GitHub Actions (tests + build en cada PR) |

## Metodología de desarrollo

Atlas Edu sigue **Scrum**, un marco de trabajo ágil con sprints, roles definidos y ceremonias periódicas.

### Roles

| Rol | Responsable |
|-----|-------------|
| **Product Owner** | Max prioriza el backlog y define qué construir |
| **Scrum Master** | Max asegura que Scrum se siga correctamente |
| **Development Team** | Max desarrolla, prueba y entrega los incrementos |

### Ceremonias

| Ceremonia | Cadencia | Duración | Propósito |
|-----------|----------|----------|-----------|
| **Sprint Planning** | Cada 2 semanas | 1h | Definir qué se entrega en el sprint y cómo se hará |
| **Daily Scrum** | Diaria | 15min | Sincronizar el trabajo, identificar bloqueos |
| **Sprint Review** | Fin de sprint | 30min | Mostrar lo completado, recibir feedback |
| **Sprint Retrospective** | Fin de sprint | 30min | Mejorar el proceso para el próximo sprint |

### Artefactos

| Artefacto | Descripción | Dónde vive |
|-----------|-------------|------------|
| **Product Backlog** | Lista priorizada de todo lo que falta construir | GitHub Issues con label `backlog` |
| **Sprint Backlog** | Items seleccionados para el sprint actual | GitHub Issues con milestone del sprint |
| **Incremento** | Versión funcional al final de cada sprint | Rama `main` + tag semántico (`v1.2.3`) |
| **Definition of Done** | Criterios: código revisado, tests pasan, build ok, desplegado en producción | `CONTRIBUTING.md` |

### Flujo por sprint

```
Sprint Planning → seleccionar issues → milestone creado
     ↓
Desarrollo en ramas feature/* → PR a develop → CI → merge
     ↓
Daily Scrum (diario, 15min)
     ↓
Fin de sprint: Review + Retro → PR develop → main → tag vX.Y.Z
```

### Flujo de trabajo técnico

| Práctica | Implementación |
|----------|---------------|
| Branching | `main` (producción) ← `develop` (integración) ← `feature/*`, `fix/*` |
| Commits | [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, etc.) |
| Pull Requests | revisión obligatoria, CI debe pasar |
| CI/CD | GitHub Actions: tests + build en cada push y PR |
| Testing | Vitest con cobertura |
| Versionado | SemVer con tags Git (`v1.2.3`) |

### Ciclo de desarrollo por historia

1. La historia se estima y prioriza en el Product Backlog
2. Se selecciona en Sprint Planning y se asigna al milestone del sprint
3. Se crea una rama `feature/xxx` desde `develop`
4. Se desarrolla con commits convencionales
5. Se abre un Pull Request a `develop` referenciando `Closes #123`
6. CI verifica tests y build
7. Se revisa el código y se mergea a `develop`
8. Al final del sprint, `develop` se fusiona a `main` con tag de versión

### Artefactos del proyecto

- **`CHANGELOG.md`** - registro de cambios por versión (Keep a Changelog)
- **`CONTRIBUTING.md`** - guía detallada con roles, ceremonias y DoD
- **`docs/adr/`** - Architecture Decision Records
- **`.github/ISSUE_TEMPLATE/`** - plantillas para bugs, features y user stories
- **`.github/PULL_REQUEST_TEMPLATE.md`** - plantilla para PRs
- **Milestones de GitHub** - representan cada sprint
- **GitHub Projects** - tablero kanban del sprint activo

## Requisitos

- Node.js 20+
- PostgreSQL 16+
- Cuenta en [OpenCode](https://opencode.ai) (para funcionalidades de IA)
- Servidor SMTP (opcional, para recuperación de PIN y envío de credenciales)

## Instalación local

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd atlas-edu

# 2. Instalar dependencias
npm install

# 3. Crear base de datos PostgreSQL
createdb atlas_edu

# 4. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales reales

# 5. Ejecutar migraciones y datos de prueba
npm run db:setup

# 6. Iniciar servidor de desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Usuarios de prueba (seed)

| Rol | Cédula | PIN |
|-----|--------|-----|
| Estudiante | 1234567890 | 1234 |
| Docente | 1234567891 | 1234 |
| Admin | 1234567892 | 1234 |

## Estructura del proyecto

```
src/
├── app/                    # Rutas App Router
│   ├── (student)/          # Portal del estudiante
│   ├── (teacher)/          # Portal del docente
│   ├── (admin)/            # Portal del administrador
│   ├── login/              # Página de inicio de sesión
│   └── api/                # Endpoints REST
├── components/             # Componentes React compartidos
│   ├── ui/                 # Componentes base (shadcn)
│   ├── layout/             # Layouts compartidos
│   └── teacher/            # Componentes del portal docente
├── lib/                    # Utilidades y configuración
│   ├── auth.ts             # JWT, cookies de sesión
│   ├── db/                 # Esquema Drizzle y conexión
│   ├── api-helpers.ts      # Validación Zod, helpers
│   ├── rate-limit.ts       # Rate limiting en memoria
│   ├── fetch-utils.ts      # Fetch con CSRF automático
│   └── __tests__/          # Tests unitarios y de integración
├── proxy.ts                # Middleware de autenticación, roles y CSRF
└── drizzle/                # Migraciones SQL
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run start` | Iniciar servidor de producción |
| `npm run test` | Ejecutar tests |
| `npm run test:watch` | Tests en modo watch |
| `npm run test:coverage` | Tests con reporte de cobertura |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generar migraciones Drizzle |
| `npm run db:push` | Aplicar migraciones a la DB |
| `npm run db:seed` | Insertar datos de prueba |
| `npm run db:setup` | Push + seed |

## Variables de entorno

Copiar `.env.example` a `.env.local` y configurar:

```bash
# Base de datos
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/atlas_edu"

# JWT
JWT_SECRET="secret-aleatorio-de-al-menos-16-caracteres"

# Groq (default)
GROQ_API_KEY="gsk_tu_api_key"
AI_DEFAULT_PROVIDER="groq"
AI_DEFAULT_MODEL="llama-3.3-70b-versatile"

# OpenCode (fallback)
OPENCODE_GO_API_KEY="sk-tu-api-key"
AI_FALLBACK_MODELS="opencode:deepseek-flash,opencode:kimi-k2.5,opencode:gpt-5.5-pro"

# Opcionales: OpenAI, Anthropic, Google, DeepSeek
# OPENAI_API_KEY="sk-..."
# ANTHROPIC_API_KEY="sk-ant-..."
# GOOGLE_GENERATIVE_AI_API_KEY="..."
# DEEPSEEK_API_KEY="..."
# DEEPSEEK_BASE_URL="https://api.deepseek.com"

# SMTP (opcional, para recuperación de PIN)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=tu-correo@gmail.com
# SMTP_PASS=tu-contrasena-app
# SMTP_FROM_NAME=Atlas Edu
```

Notas sobre seleccion de modelo IA:

- `AI_DEFAULT_PROVIDER`: proveedor por defecto cuando `model` no trae prefijo.
- `AI_DEFAULT_MODEL`: modelo por defecto usado cuando el frontend no envia `model`.
- `AI_ALLOWED_MODELS`: lista separada por comas con formato `proveedor:modelo`.
- `AI_ENFORCE_ALLOWLIST`: si es `true`, bloquea modelos fuera de `AI_ALLOWED_MODELS`.
- `AI_FALLBACK_MODELS`: cadena de modelos de respaldo para reintentos automaticos.
- `AI_DEFAULT_EMBEDDING_PROVIDER`: proveedor por defecto para embeddings.
- `AI_DEFAULT_EMBEDDING_MODEL`: modelo por defecto para embeddings.
- `AI_ALLOWED_EMBEDDING_MODELS`: allowlist de embeddings en formato `proveedor:modelo`.
- `AI_ENFORCE_EMBEDDING_ALLOWLIST`: aplica allowlist estricta en embeddings.
- `AI_FALLBACK_EMBEDDING_MODELS`: cadena de respaldo para embeddings.
- El campo `model` en las APIs acepta `proveedor:modelo` (ej: `anthropic:claude-sonnet-4.6`).
- Si envias solo `modelo` (sin `proveedor`), se asume `AI_DEFAULT_PROVIDER`.
- Si `AI_ENFORCE_ALLOWLIST=true` y se envia un `model` no permitido, la API responde `400` con el detalle.

Endpoint de embeddings:

- `POST /api/ai/embedding` con body `{ "text": "...", "model": "openai:text-embedding-3-small" }`.
- `POST /api/ai/embedding/similarity` con body `{ "query": "...", "candidates": ["...", "..."], "topK": 3, "model": "openai:text-embedding-3-small" }`.

Generar un JWT_SECRET seguro:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Despliegue en producción

```bash
# 1. Configurar variables de entorno
cp .env.example .env.production
# Editar .env.production con credenciales reales

# 2. Construir
npm run build

# 3. Ejecutar migraciones
npm run db:push

# 4. Iniciar
npm run start
```

La aplicación corre en `http://localhost:3000`. Para producción real, usar un proxy reverso como Nginx o Caddy delante, y un process manager como PM2 para mantener la app viva.

## Seguridad

- **Middleware (`src/proxy.ts`)**: Protege todas las rutas por autenticación JWT y roles. En Next.js 16, el middleware se define en `proxy.ts` (reemplaza al anterior `middleware.ts`).
- **CSRF**: Tokens de doble submit. El middleware genera un token en cada carga de página y lo verifica en todas las mutaciones de API (POST/PUT/DELETE). El frontend usa `apiFetch()` de `@/lib/fetch-utils` que incluye el token automáticamente.
- **Archivos**: Los archivos subidos por estudiantes se almacenan fuera de `public/` y se sirven a través de una ruta de API con verificación de autenticación y autorización.
- **Rate limiting**: Login (10 req/min), recuperación de PIN (3 req/min), restablecimiento de PIN (5 req/min). Endpoints de IA también rate-limited.
- **Headers HTTP**: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy configurados.

## Funcionalidades principales

- **Estudiantes**: Dashboard de progreso, práctica con IA, rutas de aprendizaje personalizadas, entrega de tareas, calendario, calificaciones, chat con docentes.
- **Docentes**: Gestión de cursos, creación y calificación de tareas, registro de asistencia, analytics de práctica con IA, gradebook exportable, mensajería directa.
- **Administradores**: Gestión de usuarios (individual y bulk CSV), cursos, períodos lectivos, configuración SMTP, envío de credenciales por email, reportes de calificaciones.
- **IA**: Chat tutor por materia, generación de ejercicios prácticos con diagramas Mermaid, verificación de respuestas, coach con pistas, rutas de aprendizaje generadas por IA.

## Licencia

Privado. Todos los derechos reservados.
