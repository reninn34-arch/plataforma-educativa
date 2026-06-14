# Changelog

Todas las cambios notables en Atlas Edu serán documentados aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/), y el proyecto usa [Semantic Versioning](https://semver.org/).

## [0.7.0] - 2026-06-13 — Sprint 7 🧹

### Agregado
- Landing page rediseñada con hero, características, HowItWorks, testimonios, estadísticas animadas y footer (#75-#82)
- Groq como proveedor IA principal con fallback automático a OpenCode / DeepSeek
- **Cuestionarios de estudio**: CRUD completo con página dedicada para docentes (`/teacher/cuestionarios`). Tipos de pregunta: MCQ, file_upload y **completar** (fill-in-the-blank). Vista previa, edición y eliminación
- **Generación IA de cuestionarios**: Herramienta `createCuestionario` en el asistente IA del docente. El profesor describe el tema en lenguaje natural y la IA genera automáticamente el cuestionario completo con preguntas, opciones y respuestas correctas. Integrado con `POST /api/teacher/cuestionarios/generate`
- Botón "Crear cuestionario" en el asistente IA: acceso directo desde el chat para que el docente genere un cuestionario sin salir de la conversación
- Módulos de aprendizaje por estudiante (tabla `student_modules`) con orden personalizado y sincronización con learning paths generados por IA
- Generación de deberes y cuestionarios en inglés cuando la materia es Inglés
- Lecciones y ejercicios de práctica generados en inglés para la materia Inglés, resto en español
- Sistema de detección de errores retryables en IA (rate limits, timeouts) con reintentos automáticos
- Variables SMTP validadas desde Zod en `env.ts` (antes se accedían con `process.env` directo)
- Rate limiting en `POST /api/auth/reset-pin` (5 req/min por IP)

### Cambiado
- Proveedor IA default cambiado de OpenCode a Groq (`llama-3.3-70b-versatile`) con fallbacks a OpenCode
- Variables de entorno agrupadas por proveedor (Groq primero, OpenCode después)
- README sincronizado con `.env.example` real
- `apiSuccess()` ahora maneja arrays correctamente (envuelve en `{ success: true, data }`)
- `generatePin()` consolidado en `csv-utils.ts` — eliminadas definiciones duplicadas en `ai-tools.ts` y `admin/users/route.ts`
- `checkAcademicLoad`, `recordPhysicalGrades` y `getFeatureGuide` extraídos a funciones compartidas en `ai-tools.ts` (~200 líneas menos)
- Diseño de práctica: 8 preguntas por ronda, estilo Kahoot, pantalla completa, resultados consistentes
- Layout de práctica: grid 2 columnas en MCQ, feedback compacto

### Corregido
- Ortografía general: tildes, signos de puntuación y faltas ortográficas en toda la plataforma
- Ortografía en nombres de materias en página de práctica
- Nombres de módulos y nodos en seed con ortografía corregida + truncate cascade
- Módulos y nodos por defecto eliminados del seed (ahora solo se generan por IA según búsqueda del estudiante)
- Diagramas Mermaid: fallback incondicional a `generateText` con parseo robusto sin JSON
- Lecciones: `introduction`/`intro` como `explanation` y `text` como `description` en `commonMistakes`
- Práctica: generación de ejercicios fallaba por formato JSON incorrecto del modelo
- Módulo nuevo ahora se pone primero en el árbol (no al final). Módulos completados se colapsan
- Admin: `totalUsers` ahora incluye admins para calcular activos/inactivos correctamente
- Admin: asistente IA oculto en el panel de administración
- Botón "Cambiar entrega" eliminado para estudiantes
- Auto-scroll al generar módulo nuevo eliminado
- `COMMON_PINS` limpiado: eliminados strings no numéricos y duplicados
- Validación redundante de dígitos repetidos eliminada en `isValidPin`
- `useTeacherCourses()` — alias engañoso de `useUserProfile()` eliminado
- `NotificationBell.tsx` duplicado en `components/` raíz eliminado
- `forgot-pin/route.ts` token de reseteo usa rol real del usuario en vez de `"" as any`
- `assignments/[id]/route.ts` línea con backcodeo `"\\"` que rompía en Linux eliminada
- `study-material.test.ts` timeout corregido (ahora usa mock de `pdf-parse` v2)

## [0.6.1] - 2026-06-06 — Sprint 6 🔐

### Agregado
- Campo "Confirmar Nuevo PIN" en perfiles de estudiantes y docentes para evitar errores de tipeo
- Validación de complejidad de PIN: rechaza dígitos repetidos (1111), secuencias (1234, 4321) y +40 PINs comunes
- Columna `pin_updated_at` en usuarios para audit trail de cambios de PIN
- Columna `whatsapp` en usuarios para número de contacto
- `POST /api/admin/users/[id]/send-credentials` para enviar credenciales a un usuario individual
- Botón "Enviar credenciales por correo" en el modal de editar usuario
- Campo WhatsApp en crear/editar usuarios (admin) y columna en tabla con link clickeable
- Columna WhatsApp en tabla de estudiantes (docente) reemplaza la columna Riesgo, con link a wa.me

### Cambiado
- `profileSchema`: `currentPin` y `newPin` ahora son requeridos (no opcionales)
- Todas las rutas de PIN migradas a `hashPin`/`comparePin` de `hash-utils.ts` (consistencia)
- Cambio de PIN desde perfil ahora re-emite JWT y actualiza `pin_updated_at`

### Corregido
- Perfiles de estudiante y docente ahora muestran el email correctamente (select incluía solo cedula, fullName, role)
- Al borrar WhatsApp/email en admin y guardar, no se limpiaba (enviaba `undefined` ignorado por el backend)
- Instrucciones SMTP: link a App Passwords ahora es clickeable; texto "Otra" corregido a "Otro"

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
