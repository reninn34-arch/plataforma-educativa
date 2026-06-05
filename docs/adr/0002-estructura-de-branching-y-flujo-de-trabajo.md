# ADR 2: Estructura de branching y flujo de trabajo

## Contexto

El proyecto (Atlas Edu) no tenía una estrategia de branching formal. Todo se commitaba directamente a `main`. A medida que el proyecto crece, se necesita un flujo que permita colaboración, revisión de código y estabilidad en producción.

## Decisión

Adoptar un flujo **trunk-based simplificado** con dos ramas principales:

- **`main`**: Rama de producción. Solo recibe merges vía Pull Request desde `develop`.
- **`develop`**: Rama de integración. Las funcionalidades se desarrollan en ramas `feature/*` y se mergean aquí.
  - `feature/<nombre>`: Ramas temporales para funcionalidades nuevas.
  - `fix/<nombre>`: Ramas temporales para correcciones.
  - `refactor/<nombre>`: Ramas temporales para refactors.

### Flujo de trabajo

```
feature/login → PR → develop → PR → main
                        ↑
              fix/crash-login
```

1. Crear rama desde `develop`: `feature/mi-funcionalidad`
2. Desarrollar y commitear con [Conventional Commits](https://www.conventionalcommits.org/)
3. Abrir Pull Request a `develop`
4. CI debe pasar (tests + build)
5. Mergear a `develop`
6. Periódicamente, abrir PR de `develop` a `main`
7. Versionar con tags semánticos (`v1.2.3`)

### CI

El pipeline de CI se ejecuta en:
- Push a `main` y `develop`
- Pull requests hacia `main` y `develop`

## Consecuencias

- **Positivas**: `main` siempre estable, trazabilidad de cambios, oportunidad de code review, CI atrapa errores temprano.
- **Negativas**: Overhead de gestión de ramas, necesidad de mantener `develop` actualizada.
