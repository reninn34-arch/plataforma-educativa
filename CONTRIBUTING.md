# Guía de contribución

## Flujo de trabajo

Este proyecto sigue un flujo **trunk-based simplificado** con dos ramas principales (`main` y `develop`) y ramas temporales de funcionalidad.

### Ramas

| Rama | Propósito | Base |
|------|-----------|------|
| `main` | Producción. Solo se actualiza via PR desde `develop`. | — |
| `develop` | Integración. Rama activa de desarrollo. | `main` |
| `feature/*` | Funcionalidades nuevas. Se mergean a `develop`. | `develop` |
| `fix/*` | Correcciones de bugs. Se mergean a `develop`. | `develop` |
| `refactor/*` | Refactors de código. Se mergean a `develop`. | `develop` |

### Flujo paso a paso

```bash
# 1. Asegurar que develop está actualizada
git checkout develop
git pull

# 2. Crear rama de funcionalidad
git checkout -b feature/mi-funcionalidad

# 3. Desarrollar y commitear
git add .
git commit -m "feat: descripción del cambio"

# 4. Mantener la rama actualizada con develop
git fetch origin
git rebase origin/develop

# 5. Subir y crear Pull Request
git push -u origin feature/mi-funcionalidad
# Crear PR en GitHub hacia develop
```

## Convenciones de commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: nueva funcionalidad
fix: corrección de error
refactor: cambio que no agrega funcionalidad ni corrige error
perf: mejora de rendimiento
test: agregar o modificar tests
docs: cambios en documentación
chore: tareas de mantenimiento
```

## Pull Requests

- Título descriptivo con prefijo del tipo de cambio
- CI debe pasar (tests + build)
- Incluir descripción de qué y por qué
- Referenciar issues relacionados con `Closes #123`

## Testing

```bash
npm test         # Ejecutar tests
npm run test:watch   # Modo watch
npm run test:coverage # Reporte de cobertura
```

## Code review

- Todos los PRs deben ser revisados antes de mergear
- Buscar: lógica correcta, casos borde, tipos, rendimiento, seguridad
- Preferir PRs pequeños y enfocados
