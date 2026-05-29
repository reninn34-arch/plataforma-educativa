# Atlas Edu

Plataforma educativa integral para el sistema PCEI (Programa de Curricular para Educacion Intensiva) de Ecuador. Diseñada para acelerar la educación secundaria de adultos a través de herramientas con inteligencia artificial, seguimiento de progreso y comunicación entre estudiantes, docentes, administradores y padres de familia.

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript |
| Base de datos | PostgreSQL + Drizzle ORM |
| Estilos | Tailwind CSS v4 + shadcn/ui |
| Autenticación | JWT (jose) + bcrypt |
| IA | Vercel AI SDK (Kimi K2.5 vía OpenCode) |
| PWA | Service Worker + Web Manifest |
| Email | Nodemailer (SMTP) |
| Testing | Vitest |
| CI/CD | GitHub Actions |

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
│   ├── (parent)/           # Portal del padre de familia
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
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/atlas_edu"
JWT_SECRET="secret-aleatorio-de-al-menos-16-caracteres"
OPENCODE_GO_API_KEY="sk-tu-api-key"
OPENCODE_GO_BASE_URL="https://opencode.ai/zen/go/v1"

# SMTP (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-correo@gmail.com
SMTP_PASS=tu-contrasena-app
SMTP_FROM="Atlas Edu <noreply@atlas.edu>"
```

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
- **Rate limiting**: Login limitado a 10 intentos/minuto por IP. Endpoints de IA también rate-limited.
- **Headers HTTP**: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy configurados.

## Funcionalidades principales

- **Estudiantes**: Dashboard de progreso, práctica con IA, rutas de aprendizaje personalizadas, entrega de tareas, calendario, calificaciones, chat con docentes.
- **Docentes**: Gestión de cursos, creación y calificación de tareas, registro de asistencia, analytics de práctica con IA, gradebook exportable, mensajería directa.
- **Administradores**: Gestión de usuarios (individual y bulk CSV), cursos, períodos lectivos, configuración SMTP, envío de credenciales por email, reportes de calificaciones.
- **Padres**: Visualización del progreso académico de sus hijos.
- **IA**: Chat tutor por materia, generación de ejercicios prácticos con diagramas Mermaid, verificación de respuestas, coach con pistas, rutas de aprendizaje generadas por IA.

## Licencia

Privado. Todos los derechos reservados.
