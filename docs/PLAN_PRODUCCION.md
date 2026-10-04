# OpenDomus: plan para llevarla a producción

> Estado: ✅ Etapa 0 · ✅ Etapa 1 · 🔄 Etapa 2 (✅ landing + bienvenida · ✅ hito 1: servidor, cuentas, casas e invitaciones cifradas · sigue el hito 2: sincronización). Repo: https://github.com/juanjpeople/opendomus · App: https://opendomus.juanjpeople.workers.dev
> Mantener este archivo al día al cerrar cada paso.

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

## Decisiones de arquitectura

> Actualizadas el 2026-10-04: cifrado de extremo a extremo, todo en Cloudflare, tres niveles de privacidad. El servidor local (Raspberry) y el ESP32 quedan para más adelante.

### Cómo entra cada persona (✅ hecho: landing + `/empezar`)

1. La primera vez en un dispositivo se ve la **landing**; "Empezar" lleva a **/empezar**.
2. Tres caminos: **Crear mi casa** (admin, nube), **Unirme a una casa** (invitación por link o QR) o **Probar en este dispositivo** (sin cuenta, como hasta ahora).
3. "¿Quién está en casa?" queda para dispositivos compartidos (la tablet de la cocina).
4. Siempre se ve **dónde vive la casa**: el indicador "Este dispositivo" o "Nube cifrada" (abajo del menú, en el selector de perfiles y en Ajustes → Datos). Implementado en `src/store/useDeviceStore.ts` (`mode`: `unset` | `local` | `cloud`).

### Seguridad: cifrado de extremo a extremo (E2EE)

La nube guarda solo datos cifrados. Ni el servidor, ni Cloudflare, ni quien los comprometa pueden leer una casa.

- **Claves por alcance**: cada casa tiene una clave para **Familia**, otra para **Adultos** y cada persona una para **Privado** (simétricas, AES-256-GCM).
- **Claves de cada persona**: un par de claves por usuario (X25519 para recibir claves, Ed25519 para firmar cambios). Las claves de alcance se le entregan cifradas con su clave pública.
- **Login sin que el servidor vea la contraseña**: de la contraseña se derivan, en el dispositivo, dos claves distintas (PBKDF2/Argon2 + HKDF). Una sirve para autenticarse ante el servidor; la otra, para abrir las claves de la persona. El servidor nunca recibe la contraseña ni la segunda clave.
- **Varios dispositivos por persona**: un dispositivo nuevo se habilita con la contraseña, con la passkey/huella (extensión PRF de WebAuthn) o aprobándolo desde otro dispositivo (QR). Hay lista de dispositivos y se pueden revocar.
- **Sacar a alguien de la casa** rota las claves de los alcances que tenía: no lee nada nuevo.
- **Recuperación**:
  - un **kit de recuperación** (código para imprimir) abre lo privado;
  - lo compartido, otro miembro (el admin) te lo vuelve a entregar;
  - sin kit ni otro dispositivo, lo privado no se puede recuperar (es el precio de que nadie más pueda leerlo, y se explica antes de crear la cuenta).
- Login con Google, GitHub o enlace mágico prueba **quién sos**; para abrir los datos hace falta además la passkey, la clave de cifrado o la aprobación desde otro dispositivo.

### Privacidad: tres niveles para cada cosa

**Familia** (todos), **Adultos** (finanzas, regalos sorpresa) y **Privado** (solo yo). Cada lista, receta, evento o proyecto tiene su nivel (por defecto, Familia). Una página de **Privacidad** muestra qué se comparte con quién.

### Nube en Cloudflare (plan gratuito para empezar)

| Pieza | Para qué |
|---|---|
| **Workers** (Hono + Better Auth) | API: cuentas, casas, invitaciones, dispositivos, sincronización. |
| **D1** (SQLite) | Usuarios, casas, membresías, claves cifradas, registro de cambios cifrados. |
| **Durable Objects** (uno por casa) | Orden de los cambios y aviso en tiempo real (WebSocket). Más adelante, el modo party. |
| **R2** | Fotos cifradas. |
| **Workers con archivos estáticos** | La app (ya publicada). |

El servidor es TypeScript y comparte `packages/core` (dominio, permisos, protocolo) con la app. Más adelante el mismo código corre en una Raspberry (Node + SQLite).

### Sincronización con E2EE

El servidor no puede ejecutar el dominio sobre datos que no lee. Por eso la regla pasa al cliente:

- cada cambio es una **operación cifrada y firmada** (ej. "ajustar Leche −1"), con metadatos en claro mínimos (tipo de operación, alcance, autor) para que el servidor autorice a grandes rasgos (un chico no puede escribir en "Adultos");
- el Durable Object de la casa le asigna un número de orden y la reparte;
- cada dispositivo aplica las operaciones en ese orden con el **mismo `domain.ts`** y verifica firma y permisos con `permissions.ts`;
- las cantidades son deltas (dos consumos simultáneos no se pisan); en ediciones gana la última por campo; borrar gana sobre editar;
- local primero: se escribe en IndexedDB al instante y se sube cuando hay conexión.

### Resto (sin cambios)

| Tema | Decisión |
|---|---|
| Web | Sitio estático (`output: "export"`), ✅ publicado en Cloudflare. |
| Android | **Capacitor** sobre el build estático. |
| Suscripciones | Entitlements por casa + proveedor intercambiable (ver "Decisiones abiertas"). |
| Repositorio | Monorepo npm workspaces: `apps/web`, `apps/server`, `packages/core`. |
| Autoalojado y ESP32 | Más adelante (Etapa 4): el mismo servidor en Docker; el ESP32 como cliente con token de dispositivo. |
| Multimedia y modo party | Fase 6: contenido desde Jellyfin (en casa) o desde la nube propia (R2); el modo party usa el canal en tiempo real de la casa (play/pausa/salto sincronizados). |

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

## ✅ Etapa 1: profesionalizar la base

1. ✅ **GitHub**: repo público `juanjpeople/opendomus`, CI en verde en cada push.
2. ✅ **Licencia** GNU AGPL v3 o posterior, `CONTRIBUTING.md` y plantillas de issues y PRs.
3. ✅ **CI** (GitHub Actions): typecheck, lint, tests unitarios, build y Playwright de punta a punta en cada PR. Los scripts de prueba que hoy están en el scratchpad pasan a `e2e/` en el repo.
4. **Tests de integración de los servicios** con `fake-indexeddb`: compras + inventario + recetas en transacciones reales.
5. **Versionado**: Conventional Commits + `CHANGELOG.md` (changesets). La versión de la app se muestra en Ajustes (ya existe `APP_VERSION`).
6. ✅ **Sitio estático**: `output: "export"`.
   - `/inventario/[containerId]` pasa a `/inventario/ver?id=`.
   - `/c/[code]` lee el código desde la URL; el hosting reescribe `/c/*` (los QR impresos siguen andando).
   - Las redirecciones de `next.config.ts` pasan a `public/_redirects`.
7. ✅ **Deploy** en **Cloudflare** (Workers con archivos estáticos, `wrangler.jsonc`) (sigue siendo local-first; sirve para probar en el celular por HTTPS).
8. **Monorepo**: mover a `apps/web` y extraer `packages/core` (dominio, permisos, i18n). Sin cambiar comportamiento.

## 🔄 Etapa 2: nube (Cloudflare), cuentas, casas, invitaciones y cifrado

**Hitos:**
1. ✅ **Cuentas, casas e invitaciones** (`server/`, `src/lib/crypto`, `src/features/cloud`): Worker en el mismo origen (`/api/*`), D1, Better Auth con contraseña derivada en el dispositivo, identidad X25519/Ed25519, claves Familia/Adultos/Privado ensobradas, kit de recuperación, invitaciones por link/QR con el secreto en el `#`. Probado de punta a punta (API y navegador) y en CI. En producción la UI sigue en "Muy pronto" (`NEXT_PUBLIC_CLOUD`) hasta el hito 2.
2. **Sincronización cifrada** de los datos de la casa (Durable Object por casa, operaciones firmadas, niveles de privacidad por cosa); con esto la casa local pasa a la nube y el indicador a "Nube cifrada".
3. **Recuperación y dispositivos**: "olvidé mi contraseña" con el kit, aprobar un dispositivo nuevo por QR, revocar, rotación de claves al sacar a alguien, Google/GitHub/passkeys, emails (Resend).


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
2. ✅ **Licencia**: AGPL-3.0 o posterior (decidido).
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
