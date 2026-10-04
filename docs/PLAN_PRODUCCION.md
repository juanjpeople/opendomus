# OpenDomus: plan para llevarla a producción

> Estado: ✅ Etapa 0 terminada · 🔄 Etapa 1 en curso (sitio estático, CI, pruebas de punta a punta y guía de contribución hechos; faltan GitHub, licencia, Cloudflare y monorepo). Mantener este archivo al día al cerrar cada paso.

## Contexto

Hoy OpenDomus es una app 100 % cliente (Next 16 + Dexie/IndexedDB): cada dispositivo tiene su propia casa, no hay cuentas, ni invitaciones, ni sincronización, ni deploy. Querés:

- que un admin **invite** a la familia y que las apps **se sincronicen** entre sí;
- tenerla **deployada**: en la nube con **suscripción automática** y también **autoalojada** en una Raspberry/NAS (el ESP32, como dispositivo satélite);
- una **app Android en Play Store**;
- **profesionalizar** el proyecto (CI, tests, licencia, releases), sabiendo que va a llevar tiempo y que todavía nadie se suscribe.

Además, hay trabajo **a medio hacer** en la rama `feat/fase-1`: las listas múltiples con presupuesto y los proyectos. El modelo, los servicios y los hooks ya están escritos; no compila solo porque faltan ~65 claves de traducción y la página de proyectos.

Lo que juega a favor:

- Todas las escrituras pasan por `src/features/*/service.ts`: es el lugar natural para la sincronización.
- Los ids ya son UUID (`src/lib/id.ts`).
- Los permisos son una sola matriz pura (`src/lib/auth/permissions.ts`) que el servidor puede reutilizar tal cual.
- El dominio (`domain.ts`) no depende ni de React ni de la base.

---

## Decisiones de arquitectura (recomendadas)

| Tema | Decisión | Por qué |
|---|---|---|
| Servidor | **TypeScript: Hono + Drizzle + Better Auth**, en `apps/server` | Reutiliza `domain.ts` y `permissions.ts` sin reescribir nada. Corre en Raspberry Pi (Docker arm64 o binario de Bun). |
| Base del servidor | **SQLite** autoalojado / **Postgres** en la nube (Drizzle soporta las dos) | Liviano en la Raspberry, escalable en la nube. |
| Login | Better Auth: email + contraseña con recuperación, magic link, Google, GitHub y passkeys | Cubre los 5 métodos que pediste con plugins oficiales. |
| Casa e invitaciones | Plugin `organization` de Better Auth: casa = organización; invitación por email, link o QR, con rol (admin/adulto/niño) | Es exactamente "el admin manda invites". |
| Miembros sin cuenta | Un `Member` puede tener `userId` o no. Los chicos sin email siguen como perfil con PIN en la tablet de la casa | No obliga a nadie a tener email. |
| Sincronización | **Offline-first por comandos**: el servicio escribe local y encola el comando (outbox) → el servidor lo vuelve a ejecutar con el mismo dominio y permisos y le asigna un `rev` → los clientes bajan cambios con `?since=rev` y reaplican lo pendiente. Avisos en tiempo real por SSE | Las cantidades son deltas (dos personas usando leche a la vez no se pisan). Es el modelo de Replicache, hecho a medida. |
| Fotos | Almacenamiento compatible con S3 (o disco local en el autoalojado); se bajan bajo demanda | Las fotos no viajan en la sincronización de datos. |
| Web | `output: "export"` (sitio estático) → Cloudflare Pages en la nube; en el autoalojado lo sirve el mismo servidor | Mismo build para la web, la PWA y Android. |
| Android | **Capacitor** sobre el build estático | Plugins nativos (cámara para QR, biometría, push, deep links de los QR). |
| Suscripciones | Modelo de **entitlements por casa** + proveedor intercambiable (adaptador). Ver "Decisiones abiertas" | Desde Argentina, Stripe no está disponible directo: conviene no atarse a un proveedor todavía. |
| ESP32 | Cliente, no servidor: **tokens de dispositivo** con permisos acotados y una API HTTP simple (botón "se acabó", pantalla e-ink con la lista, sensores) | Un ESP32 no puede alojar el servidor. La Raspberry es el mínimo para eso. |
| Repositorio | Monorepo **npm workspaces**: `apps/web`, `apps/server`, `packages/core` (dominio, permisos, i18n, protocolo de sync) | Un solo lugar para las reglas. |

---

## ✅ Etapa 0: cerrar lo que está en curso (listas + proyectos)

Objetivo: dejar `feat/fase-1` compilando, probada y mergeada a `main`.

1. **Textos** `es` y `en`: todas las claves que marca `tsc`: `shopping.lists.*`, `shopping.budget.*`, `shopping.estimate.*`, `shopping.summary.total|ofBudget|unpriced`, `shopping.price.save|total|hintFree`, `shopping.list.moveTo|remove|actionsAria|emptyTextList`, `shopping.toast.moved`, `projects.*`, `errors.notFound.list|project`, `errors.shopping.homeList`, `permissions.projects.*`, `activity.lists.*`, `activity.projects.*`, `nav.routes.projects|project`.
2. **Proyectos**:
   - `src/features/projects/components/ProjectsPage.tsx`: tarjetas con ícono, estado, `BudgetBar` y cantidad de listas.
   - `ProjectView.tsx` (`/proyectos/ver?id=`): presupuesto total contra la suma de sus listas, sus listas como tarjetas que llevan a `/compras?lista=`, "Nueva lista en este proyecto" (reusa `ListModal` con `projectId`), notas, marcar como terminado y borrar.
   - `ProjectModal.tsx`: nombre, presupuesto, moneda, color e ícono. Reusa `ColorSwatches`/`IconGrid` de `src/components/ui`.
   - Páginas `src/app/proyectos/page.tsx` y `src/app/proyectos/ver/page.tsx` (esta con `Suspense`).
   - Rutas en `src/lib/navigation/routes.ts` (ícono `HardHat`, `needsId` en `ver`).
3. **Compras**:
   - `src/app/compras/page.tsx` dentro de `Suspense` (usa `useSearchParams`).
   - `ActivityList` con los textos de los módulos `lists` y `projects`.
   - La tarjeta del inicio usa `useShoppingCounts` (ya suma todas las listas activas).
   - Revisar en `ListModal` la regla de que la lista de la casa no se renombra (`list` puede ser `undefined`).
4. **Búsqueda Ctrl+K**: listas (abre `/compras?lista=`) y proyectos.
5. **Tests**:
   - `summarizeBudget`: gastado, estimado, monedas mezcladas, sin precio, pasado de presupuesto.
   - `summarizeProject`, `parseListInput` y `parseMoney`.
   - Migración v9: los ítems viejos pasan a la lista de la casa.
   - Agregar a `scripts/test-hooks.mjs` lo que haga falta.
6. **Verificación**: `npm run typecheck && npm run lint && npm test && npm run build`. Prueba de punta a punta con Playwright:
   - crear el proyecto "Renovación baño" con presupuesto;
   - crear la lista "Sanitarios" dentro de él;
   - anotar ítems con precio estimado;
   - comprar uno, cargar lo pagado y ver la barra de presupuesto;
   - pasarse del presupuesto y ver el aviso en rojo;
   - mover un ítem a otra lista;
   - archivar la lista;
   - todo en escritorio, celular y modo oscuro, en es y en.
   - Después: actualizar `OPENDOMUS_PLAN.md`, commit, merge a `main`.

## 🔄 Etapa 1: profesionalizar la base

1. **GitHub**: repo (privado o público), push de `main`, protección de rama, PRs.
2. **Licencia**: decidir (ver abajo). ✅ `CONTRIBUTING.md` y plantillas de issues y PRs.
3. ✅ **CI** (GitHub Actions): typecheck, lint, tests unitarios, build y Playwright de punta a punta en cada PR. Los scripts de prueba que hoy están en el scratchpad pasan a `e2e/` en el repo.
4. **Tests de integración de los servicios** con `fake-indexeddb`: compras + inventario + recetas en transacciones reales.
5. **Versionado**: Conventional Commits + `CHANGELOG.md` (changesets). La versión de la app se muestra en Ajustes (ya existe `APP_VERSION`).
6. ✅ **Sitio estático**: `output: "export"`.
   - `/inventario/[containerId]` pasa a `/inventario/ver?id=`.
   - `/c/[code]` lee el código desde la URL; el hosting reescribe `/c/*` (los QR impresos siguen andando).
   - Las redirecciones de `next.config.ts` pasan a `public/_redirects`.
7. **Deploy** de la web a **Cloudflare Pages** (sigue siendo local-first; sirve para probar en el celular por HTTPS).
8. **Monorepo**: mover a `apps/web` y extraer `packages/core` (dominio, permisos, i18n). Sin cambiar comportamiento.

## Etapa 2: servidor, cuentas, casas e invitaciones

- `apps/server`:
  - Hono + Better Auth (email y contraseña, magic link, Google, GitHub, passkeys) + Drizzle.
  - Envío de emails por un adaptador SMTP (en la nube, Resend o similar).
- **Casa = organización**:
  - Crear la casa en el primer login.
  - "Subir mi casa": migrar los datos locales actuales con el formato de export que ya existe.
- **Invitaciones**: el admin invita por email, link o QR con un rol; el invitado entra con cualquier método de login y queda como `Member` vinculado a su `userId`.
- **Roles**: admin/adulto/niño de la casa = la matriz de `permissions.ts` (de `packages/core`), evaluada **en el servidor**.
- **Web**:
  - pantallas de entrar, registrarse, recuperar contraseña, invitaciones pendientes y "Mi cuenta";
  - el selector de perfiles queda para dispositivos compartidos (la tablet de la cocina).

## Etapa 3: sincronización offline-first

- **Protocolo** en `packages/core/sync`:
  - `push(commands[])` → el servidor aplica en orden, con permisos y dominio, y asigna `rev`;
  - `pull(sinceRev)` → filas cambiadas + tombstones.
- **Cliente**:
  - los servicios encolan comandos en una tabla `outbox` (Dexie v10) dentro de la misma transacción;
  - un `SyncEngine` empuja, baja y reaplica lo pendiente;
  - avisos por SSE.
  - El indicador del header pasa de "Sin conexión" a "Sincronizado / Pendiente (n)".
- **Conflictos**:
  - cantidades = deltas (sin conflicto);
  - ediciones = la última gana, por campo, en el orden del servidor;
  - lo borrado gana sobre la edición.
- **Fotos**: subida aparte con reintentos.

## Etapa 4: despliegue en la nube y autoalojado, más dispositivos

- **Nube**: web en Cloudflare Pages + API en un VPS chico o Fly.io + Postgres administrado + almacenamiento de objetos. Multi-tenant por casa.
- **Autoalojado**: una imagen Docker multi-arquitectura (amd64/arm64) que sirve API y web, con SQLite y un `docker-compose.yml`. Guía para Raspberry Pi. Backups automáticos (copia de SQLite y de las fotos).
- **ESP32**: tokens de dispositivo por casa (alcance limitado, revocables desde Ajustes), endpoints simples (`POST /devices/shopping`, `GET /devices/list`) y un ejemplo de firmware (Arduino) en `examples/esp32`.

## Etapa 5: Android (Play Store)

- **Capacitor** sobre el build estático.
  - Plugins: cámara/escáner, biometría, deep links de `/c/<código>`, push.
  - Ícono y splash con la casa del isotipo.
- **Play Console**:
  - cuenta de desarrollador (pago único);
  - una cuenta personal nueva tiene que pasar una **prueba cerrada con testers durante días** antes de publicar (verificar la exigencia vigente);
  - política de privacidad, formulario de seguridad de datos y firma de la app.
- **CI**: build del AAB firmado y subida a la pista interna.

## Etapa 6: suscripciones automáticas

- **Entitlements por casa** en el servidor (`plan`, `status`, `currentPeriodEnd`, límites como almacenamiento o cantidad de miembros). La app solo pregunta "¿puede?", como con los permisos.
- **Planes** (propuesta):
  - autoalojado = gratis y completo;
  - nube Gratis (1 casa, límites suaves);
  - nube Plus (más espacio de fotos, backups, dispositivos).
- **Cobro web**: proveedor con *checkout* + portal del cliente + webhooks idempotentes → entitlements.
- **Android**: Google exige **Play Billing** para vender suscripciones digitales dentro de la app. Plan: unificar los dos cobros (por ejemplo, con RevenueCat), o al principio vender solo por web y que la app solo permita entrar (verificar la política vigente).
- **Hasta que haya clientes**: dejar el modelo, los webhooks y la UI de "Plan" listos en modo prueba.

## Etapa 7: listo para producción

- **Seguridad**:
  - cifrado local de IndexedDB (ya diseñado en `OPENDOMUS_PLAN.md`);
  - límite de pedidos (rate limiting);
  - revisión de permisos del lado del servidor;
  - política de seguridad de contenido (CSP);
  - auditoría de dependencias.
- **Observabilidad opcional** ("Nada sale sin permiso"): reporte de errores solo si la persona lo activa (GlitchTip o Sentry autoalojado); métricas del servidor.
- **Legal**: términos, privacidad, exportar y borrar la cuenta (esto último ya existe en local).
- **Soporte**: estado del servicio y avisos dentro de la app sin patrones oscuros.

---

## Decisiones abiertas (no bloquean la Etapa 0 ni la 1)

1. **Proveedor de cobro**:
   - Paddle o Lemon Squeezy (*merchant of record*: cobran y liquidan impuestos globales, aceptan vendedores de Argentina);
   - Mercado Pago (suscripciones en ARS, ideal para el mercado local);
   - Stripe (requiere una empresa en EE.UU., por ejemplo con Stripe Atlas).
   - Se puede combinar: Mercado Pago para Argentina + un *merchant of record* para el resto.
2. **Licencia**: AGPL-3.0 (código abierto que obliga a publicar los cambios si alguien lo ofrece como servicio; protege el SaaS) o MIT (más permisiva).
3. **Hosting de la API en la nube**: VPS barato (por ejemplo Hetzner) o una plataforma administrada (Fly.io, Railway). Se decide en la Etapa 4.

## Verificación por etapa

- **Siempre**: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` y Playwright de punta a punta en CI.
- **Etapa 0**: el flujo de proyectos y listas descrito arriba, en escritorio, celular y modo oscuro.
- **Etapas 2 y 3**: dos navegadores con dos cuentas de la misma casa:
  - una invita y la otra acepta;
  - las dos editan sin conexión, se reconectan y convergen;
  - el inventario resta bien con consumos simultáneos;
  - un chico no puede hacer cambios desde la API.
- **Etapa 4**: `docker compose up` en una Raspberry (o una VM arm64) y un ESP32 (o curl con su token) que anota algo en la lista.
- **Etapa 5**: la app instalada desde la pista interna abre un QR impreso y funciona sin conexión.
- **Etapa 6**: los webhooks en modo prueba cambian el plan de la casa y la app lo refleja.
