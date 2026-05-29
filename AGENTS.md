# Atlas Edu - Convenciones de desarrollo

## Stack
Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind CSS v4 + Drizzle ORM + PostgreSQL

## Convenciones de archivos

### Middleware
En Next.js 16, el middleware se define en `src/proxy.ts` (NO en `middleware.ts`). Este archivo:
- Verifica autenticación JWT (`atlas-edu-token` cookie)
- Aplica restricciones de rol por prefijo de ruta
- Genera y verifica tokens CSRF
- Exporta `export default async function middleware(request: NextRequest)`
- Exporta `export const config = { matcher: [...] }`

### API Routes
- Cada ruta en `src/app/api/` es un `route.ts` con exports nombrados (`GET`, `POST`, `PUT`, `DELETE`)
- Los params son `Promise<{ id: string }>` y se extraen con `await params`
- Autenticación: cada ruta verifica el token JWT independientemente del middleware
- Validación: usar schemas Zod de `@/lib/api-helpers`
- Errores: mensajes en español, nunca exponer detalles internos

### Frontend
- Componentes cliente: directiva `"use client"` al inicio
- Fetch: usar `apiFetch()` de `@/lib/fetch-utils` para todas las llamadas HTTP (incluye CSRF automático)
- Estilos: Tailwind CSS con `cn()` de `@/lib/utils` para clases condicionales
- shadcn/ui: componentes en `@/components/ui/`

### Base de datos
- ORM: Drizzle (`@/lib/db/schema.ts` para definiciones, `@/lib/db/index.ts` para conexión)
- Migraciones: `npm run db:generate` seguido de `npm run db:push`
- Nunca usar SQL crudo con `postgres()` directamente; preferir Drizzle
- Nombres de tabla: snake_case en DB, camelCase en TypeScript

### Autenticación
- PIN de 4 dígitos con bcrypt (NO cambiar a contraseñas sin aprobación)
- JWT: 24h de expiración, HS256, httpOnly cookie con sameSite "lax"
- `@/lib/auth.ts`: `createToken()`, `verifyToken()`, `getUser()`, `setSessionCookie()`, `destroySession()`
- Roles: "student", "teacher", "admin", "parent"

### Variables de entorno
- Schema Zod en `@/lib/env.ts` con `getEnv()` (caché singleton)
- `.env.local` para desarrollo (NUNCA commitear secrets reales a `.env.example`)
- `.env.example` solo contiene placeholders y documentación

### Testing
- Framework: Vitest
- Tests unitarios: `src/lib/__tests__/`
- Tests de integración: `src/app/api/__tests__/`
- Comandos: `npm test`, `npm run test:watch`, `npm run test:coverage`

### Idioma
- TODO el código visible al usuario (mensajes de error, UI) en español
- Nombres de variables, funciones, comentarios: inglés o español según consistencia del archivo existente
- Mensajes de commit: español
