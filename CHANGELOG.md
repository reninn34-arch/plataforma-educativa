# Changelog

Todas las cambios notables en Atlas Edu serán documentados aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/), y el proyecto usa [Semantic Versioning](https://semver.org/).

## [0.5.0] - 2026-06-06 — Sprint 5 🔧

### Corregido
- Mensajería a cursos: botón "Mensaje" del frontend llamaba a `/api/chat` (endpoint incorrecto) — ahora usa `POST /api/messages/course`
- Notificaciones de mensaje navegaban a `/messages` (página inexistente) — ahora solo se marcan como leídas al hacer clic
- Riesgo académico (`getStudentRisk` y botón "En riesgo"): usaba datos de práctica con IA (tabla `progress`, siempre vacío) — ahora usa calificaciones del profesor, tareas pendientes y actividad real
- Estudiantes sin entregas mostraban "999 días inactivo" — ahora muestra "Sin entregas registradas"

### Agregado
- Nueva herramienta `sendMessageToStudent` para enviar mensajes individuales a estudiantes
- Nuevo endpoint `POST /api/messages/course` para enviar mensajes a todo un curso
- Notificaciones en `sendMessageToStudents` para avisar a estudiantes al enviar mensajes por IA
- Marcado individual de notificaciones como leídas al hacer clic (`markOneRead`)

## [0.4.0] - 2026-06-06 — Sprint 4 🔄 (tracking completado)

### Agregado
- Sistema multi-proveedor IA con fallback automático y embeddings (#41)
- Generación de exámenes y tareas completas con IA (#42)
- Asistente IA conversacional completo con 20+ herramientas, voz y archivos (#43)
- Arquitectura de rutas de aprendizaje estilo Duolingo (#44)
- Sistema de examen estructurado con auto-grading (#45)
- Ejercicios individuales por estudiante con datos cacheados (#46)
- React Query, sistema de fetch con CSRF y caché global (#47)
- Documentación Swagger/OpenAPI de la API (#48)
- Optimización de performance: índices, consultas batch y bcrypt paralelo (#49)
- Estadísticas académicas detalladas para docentes (#50)
- Gestión de ciclo de vida de períodos lectivos (#51)
- Sistema de sonidos con Web Audio API (#52)
- Monitor de API y herramientas de desarrollo (#53)
- Vista de asistencia para administradores (#54)
- PWA: Service Worker y manifest para soporte offline (#55)
- Interfaz completa de configuración SMTP (#56)
- Métricas de estudiante: racha, precisión y errores frecuentes (#57)

## [0.3.0] - 2026-06-06 — Sprint 3 ✅ (100% completado)

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
- Recuperación de PIN sin ayuda del administrador (#37)
- Coach IA con pistas Socráticas al practicar (#38)
- Semáforo de riesgo de estudiantes (#39)
- Rate limiting para endpoints críticos (#40)

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
