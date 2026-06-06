# Changelog

Todas las cambios notables en Atlas Edu serán documentados aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/), y el proyecto usa [Semantic Versioning](https://semver.org/).

## [0.3.0] - 2026-06-06 — Sprint 3 🔄 (tracking completado)

### Agregado
- Experiencia gamificada al practicar (#26): sonidos, vidas, combo, estrellas, confetti, animaciones, módulos colapsables
- Material de estudio por curso y materia (#27): subida PDF/texto, inyección en prompts IA
- Videos de YouTube en lecciones (#28): búsqueda automática, embed, prevención duplicados
- Diagramas Mermaid generados por IA (#29): zoom, fullscreen, click-to-enlarge
- Lecciones en diapositivas con SVG visual (#30)
- Página dedicada de horario semanal para docentes (#31): tabla Lun-Vie, colores por materia
- Calendario de tareas para estudiantes (#32)
- Mensajería directa docente-estudiante (#33)
- Boletines de calificaciones por curso (#34): desglose materia + trimestre
- Regeneración masiva de PINs e impresión de credenciales (#35)
- Diseño responsive completo y tema visual por materia (#36)

## [0.2.0] - 2026-06-06 — Sprint 2 ✅ (100% completado)

### Agregado
- Dashboard admin con gráficos estadísticos (#18)
- Sistema de notificaciones en plataforma (#19)
- Exportación de reportes de calificaciones PDF y Excel (#20)
- Tests de integración para rutas de administrador (#21)
- Tipos fuertes de Drizzle eliminando `any` (#22)
- Analytics docentes avanzados: rendimiento, riesgo, comparativa (#23)
- Modo oscuro con next-themes (#24): toggle, persistencia, variables CSS, tema por usuario

### Cambiado
- Migración de clases fijas a variables CSS del tema
- Reemplazo de `require` por `import` en jsPDF y xlsx

## [0.1.0] - 2026-06-05 — Sprint 1 ✅ (100% completado)

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

## [0.0.1] - 2026-05-??

### Agregado
- Funcionalidad inicial del proyecto
- Autenticación con PIN y JWT
- Portales: estudiante, docente, administrador, padre
- Práctica con IA, rutas de aprendizaje
- Gestión de cursos, tareas, asistencia, calificaciones
- Carga masiva de usuarios por CSV
