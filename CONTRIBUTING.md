# Guía de contribución

Atlas Edu se desarrolla con **Scrum** (sprints de 2 semanas). Esta guía documenta el flujo de trabajo, roles, ceremonias y definiciones.

## Roles

| Rol | Responsabilidad |
|-----|----------------|
| **Product Owner** | Gestiona el Product Backlog, prioriza, define criterios de aceptación |
| **Scrum Master** | Facilita las ceremonias, elimina bloqueos, asegura que se siga Scrum |
| **Development Team** | Autogestionado, desarrolla, prueba y entrega los incrementos |

## Ceremonias

| Ceremonia | Cuándo | Duración |
|-----------|--------|----------|
| **Sprint Planning** | Primer día del sprint | 1h |
| **Daily Scrum** | Cada día hábil | 15 min |
| **Sprint Review** | Último día del sprint | 30 min |
| **Sprint Retrospective** | Último día del sprint | 30 min |

## Definition of Done (DoD)

Una historia se considera **completada** cuando cumple **todas** estas condiciones:

- [ ] Código implementado y funcional
- [ ] Tests unitarios escritos y pasan
- [ ] TypeScript sin errores (`npx tsc --noEmit`)
- [ ] Build exitoso (`npm run build`)
- [ ] Pull Request revisado y aprobado
- [ ] Mergeado a `develop`
- [ ] Documentación actualizada (si aplica)

## Flujo de trabajo con ramas

```bash
# Al inicio del sprint: actualizar develop
git checkout develop
git pull

# Crear rama para la historia
git checkout -b feature/123-descripcion-corta

# Desarrollar con commits convencionales
git add .
git commit -m "feat(#123): descripción del cambio"

# Mantener actualizada con develop
git fetch origin
git rebase origin/develop

# Subir y crear Pull Request
git push -u origin feature/123-descripcion-corta
# Crear PR en GitHub hacia develop
```

### Ramas

| Rama | Propósito | Base | Mergea a |
|------|-----------|------|----------|
| `main` | Producción. Solo se actualiza al final del sprint. | — | — |
| `develop` | Integración diaria. Rama activa. | `main` | `main` (fin de sprint) |
| `feature/*` | Historias de usuario del sprint. | `develop` | `develop` |
| `fix/*` | Correcciones de bugs. | `develop` | `develop` |
| `refactor/*` | Refactors de código. | `develop` | `develop` |

## Product Backlog y Sprint Backlog

- **Product Backlog**: Issues de GitHub con label `backlog`
- **Sprint Backlog**: Issues asignados al milestone del sprint activo
- Cada issue debe tener: título descriptivo, criterios de aceptación, estimación (si aplica)

## Convenciones de commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(#123): nueva funcionalidad
fix(#123): corrección de error
refactor: cambio que no agrega funcionalidad ni corrige error
perf: mejora de rendimiento
test: agregar o modificar tests
docs: cambios en documentación
chore: tareas de mantenimiento
```

Incluir el número de issue cuando aplique: `feat(#123): ...`

## Pull Requests

- Título descriptivo con prefijo y número de issue: `feat(#123): ...`
- CI debe pasar (tests + build)
- Incluir descripción de qué, por qué y cómo se probó
- Referenciar el issue: `Closes #123`

## Testing

```bash
npm test                # Ejecutar tests
npm run test:watch      # Modo watch
npm run test:coverage   # Reporte de cobertura
```

## Code review

- Todo PR debe ser revisado antes de mergear
- Buscar: lógica correcta, casos borde, tipos, rendimiento, seguridad
- PRs pequeños y enfocados en una sola historia
