# ADR 3: Adoptar Scrum como marco de trabajo ágil

## Contexto

El proyecto Atlas Edu se desarrollaba sin una metodología formal. Para mejorar la planificación, trazabilidad y calidad del software, se decidió adoptar un marco de trabajo ágil estructurado.

## Decisión

Adoptar **Scrum** con las siguientes características adaptadas a un equipo pequeño/unipersonal:

### Cadencia
- **Sprints de 2 semanas** (lunes a viernes de por medio)
- Al final de cada sprint: Review + Retrospective
- Al inicio de cada sprint: Sprint Planning

### Roles
- **Product Owner**: Gestiona y prioriza el Product Backlog
- **Scrum Master**: Facilita las ceremonias y asegura la adherencia a Scrum
- **Development Team**: Autogestionado, responsable de entregar el incremento

### Artefactos
- **Product Backlog**: GitHub Issues con label `backlog`
- **Sprint Backlog**: GitHub Issues asignados al milestone del sprint
- **Incremento**: Rama `main` con tag semántico al final de cada sprint
- **Definition of Done**: Documentada en `CONTRIBUTING.md`

### Eventos
1. **Sprint Planning** (1h): Definir objetivo del sprint y seleccionar items del backlog
2. **Daily Scrum** (15min): Sincronización diaria
3. **Sprint Review** (30min): Demostrar lo completado
4. **Sprint Retrospective** (30min): Mejorar el proceso

### Integración técnica
- GitHub Milestones representan los sprints
- GitHub Issues representan las historias de usuario, bugs y tareas
- GitHub Projects (kanban) visualiza el flujo del sprint
- Labels: `backlog`, `user-story`, `bug`, `enhancement`, `sprint-X`

## Consecuencias

- **Positivas**: Visibilidad completa del progreso, entregas predecibles cada 2 semanas, mejora continua vía retrospectivas, backlog priorizado.
- **Negativas**: Requiere disciplina para mantener las ceremonias, overhead de planificación cada 2 semanas, puede sentirse pesado para un equipo unipersonal.
