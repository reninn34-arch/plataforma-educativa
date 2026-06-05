# ADR 1: Usar Next.js 16 + Drizzle ORM + PostgreSQL

## Contexto

Se necesita una plataforma educativa moderna con renderizado híbrido (SSR + CSR), API REST, autenticación, soporte para IA y despliegue sencillo. El equipo es pequeño y busca maximizar productividad sin sacrificar rendimiento.

## Decisión

- **Framework**: Next.js 16 con App Router por su modelo híbrido de renderizado, API routes integradas y ecosistema maduro.
- **ORM**: Drizzle ORM por tipado fuerte, rendimiento y sintaxis familiar a SQL.
- **Base de datos**: PostgreSQL por su confiabilidad, soporte de JSONB, índices avanzados y amplia adopción.
- **Autenticación**: JWT con httpOnly cookies + bcrypt para PINs de 4 dígitos (requisito del sistema PCEI).
- **Estilos**: Tailwind CSS v4 + shadcn/ui por velocidad de desarrollo y accesibilidad.
- **Testing**: Vitest por su velocidad y compatibilidad con el ecosistema.

## Consecuencias

- **Positivas**: Stack moderno con buena DX, tipado extremo (TypeScript + Drizzle), despliegue flexible (Vercel, Docker, VPS).
- **Negativas**: Dependencia del ecosistema Next.js, migraciones manuales con Drizzle Kit, curvas de aprendizaje para Tailwind v4.
