# Cómo contribuir a Refugio

Gracias por sumarte. Antes de escribir código, leé [VALORES.md](VALORES.md): cada decisión se mide contra esos valores y lineamientos. Las convenciones visuales y de código están en la página `/design` de la app.

## Puesta en marcha

Requiere Node.js 24 o más nuevo.

```bash
npm install
npm run dev        # http://localhost:3000
```

## Antes de abrir un PR

```bash
npm run check      # tipos + lint + tests unitarios
npm run build      # sitio estático en out/
npm run e2e        # pruebas de punta a punta sobre out/ (usa el Chrome instalado)
```

El CI corre lo mismo en cada PR.

## Cómo está organizado el código

Cada módulo vive en `src/features/<módulo>/`:

| Archivo | Qué va |
|---|---|
| `domain.ts` | Tipos, reglas y validación. Sin React ni base de datos: se prueba con `node:test` y el servidor lo va a reutilizar. |
| `service.ts` | El **único** que escribe en la base. Verifica permisos (`assertCan`) y registra el historial en la misma transacción. |
| `hooks.ts` | Lecturas reactivas (`useLiveQuery`) y acciones con avisos para la UI. |
| `components/` | La interfaz. |

Reglas que no se negocian:

- **Permisos por acción**: preguntá `can(user, "inventory.adjust")`, nunca por el rol. La matriz está en `src/lib/auth/permissions.ts`.
- **Esquema de la base**: nunca edites una versión existente; agregá una nueva en `declareSchema` (`src/lib/db.ts`) con su migración.
- **Textos**: todo pasa por el diccionario (`src/i18n/messages/es.ts` es la fuente de verdad; `en.ts` tiene que tener las mismas claves, y un test lo verifica).
- **URLs con id**: usá `containerHref`, `recipeHref`, `projectHref`, `qrHref` (`src/lib/navigation/routes.ts`). No hay rutas dinámicas: la app es un sitio estático.
- **Nada sale sin permiso**: sin telemetría, sin llamadas externas que la persona no haya pedido.

## Licencia

Refugio es software libre bajo la [GNU AGPL v3](LICENSE) o posterior. Al contribuir, aceptás que tu aporte se publique bajo esa misma licencia.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/es/), en español: `feat: …`, `fix: …`, `docs: …`, `test: …`, `refactor: …`, `chore: …`. El cuerpo explica el porqué.
