# Changelog

Todas las cambios notables en Atlas Edu serán documentados aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/), y el proyecto usa [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-06-05

### Agregado
- Issue templates para bugs y features (GitHub)
- Pull Request template
- ADR (Architecture Decision Records) en `docs/adr/`
- Guía de contribución (`CONTRIBUTING.md`)
- Flujo de branching con `develop` + ramas `feature/*`
- CI ahora corre también en rama `develop`
- Tests para el CSV parser de carga masiva de usuarios
- Validaciones mejoradas en carga masiva (tamaño, límite de filas, longitud de campos)
- Transacción atómica en bulk insert/reactivate

### Cambiado
- Estructura de la ruta bulk `POST /api/admin/users/bulk` con tipado fuerte
- CSV parser extraído a `src/lib/csv-utils.ts` con soporte BOM y quoted multiline

## [0.1.0] - 2026-05-??

### Agregado
- Funcionalidad inicial del proyecto
- Autenticación con PIN y JWT
- Portales: estudiante, docente, administrador, padre
- Práctica con IA, rutas de aprendizaje
- Gestión de cursos, tareas, asistencia, calificaciones
- Carga masiva de usuarios por CSV
