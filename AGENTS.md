<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Costos y servicios externos

OpenDomus debe poder mantenerse dentro de la capa gratuita. No introducir dependencias
que exijan tarjeta, activar facturación, planes pagos o suscripciones adicionales sin
plantear el requisito y obtener autorización explícita antes de implementarlas.
Conservar `/admin` sin Cloudflare Access/Zero Trust; ver `docs/ADMIN.md`.
Documentar límites de uso reales: no prometer uso ilimitado ni convertir automáticamente
un límite gratuito en consumo pago.

## Sistema visual

La página `/design` (`src/app/design/`) es el estándar de la UI: usa el código real y muestra
cómo se ve, se mueve y habla la app, con flujos completos de referencia (almacenamiento y
recetas). Antes de tocar una pantalla, recorrela (casa demo → perfil Administrador → `/design`).

- Nada se usa en una pantalla si antes no está en `/design`: primero la pieza en
  `src/components/ui` (exportada en `index.ts`), después su `DemoBlock` en `/design`.
- Colores, radios y tamaños con `theme.useToken()`; movimiento con `src/components/motion` y los
  tokens de `src/lib/motion.ts` (`DURATION`, `SPRING`, `HOVER_LIFT`, `TAP`). Toda pantalla entra
  en cascada (`Reveal`/`Stagger`) y todo lo que se toca responde.
- Todo texto por `t()`; voseo, una idea por oración (ver "Voz y textos" en `/design`).
- Ante una decisión de UI, gana la opción de mejor calidad visual, fiel a la firma original.
- `scripts/design-lint.test.mjs` (corre con `npm test`) frena colores fijos, textos por idioma en
  componentes, íconos con `size` y piezas sin documentar. El plan y su estado están en
  `docs/UNIFICACION_VISUAL.md`; repasá la lista "Revisión antes de un PR" de `/design`.
