# ADR 2: Estructura de branching y flujo de trabajo

## Contexto

El proyecto (Atlas Edu) no tenía una estrategia de branching formal. Todo se commitaba directamente a `main`. A medida que el proyecto crece, se necesita un flujo que permita colaboración, revisión de código y estabilidad en producción.

## Decisión

Adoptar **Scrum** como marco de trabajo ágil con sprints de 2 semanas, y un flujo de branching **trunk-based simplificado** con dos ramas principales:

- **`main`**: Rama de producción. Solo recibe merges vía Pull Request desde `develop` al final de cada sprint.
- **`develop`**: Rama de integración diaria. Las funcionalidades se desarrollan en ramas `feature/*` y se mergean aquí.
  - `feature/<numero-issue>-<nombre>`: Ramas para historias de usuario del sprint actual.
  - `fix/<nombre>`: Ramas temporales para correcciones.
  - `refactor/<nombre>`: Ramas temporales para refactors.

### Flujo de trabajo

```
Product Backlog (GitHub Issues)
  → Sprint Planning → Sprint Backlog (Milestone)
    → feature/123-login → PR → develop → CI → merge
    → fix/crash → PR → develop → CI → merge
      → Fin de sprint: Review + Retro
        → develop → PR → main → tag v1.2.3
```

### CI

El pipeline de CI se ejecuta en:
- Push a `main` y `develop`
- Pull requests hacia `main` y `develop`

## Consecuencias

- **Positivas**: `main` siempre estable, trazabilidad de cambios, oportunidad de code review, CI atrapa errores temprano, cada sprint produce un incremento potencialmente entregable.
- **Negativas**: Overhead de gestión de ramas, necesidad de mantener `develop` actualizada, disciplina para mantener las ceremonias.
