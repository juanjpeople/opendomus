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
