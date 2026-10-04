# OpenDomus: plan para llevarla a producción

> Estado: ✅ Etapa 0 · ✅ Etapa 1 · 🔄 Etapa 2 (✅ landing + bienvenida · ✅ hito 1: cuentas, casas e invitaciones cifradas · ✅ hito 2: sincronización cifrada y privacidad · ✅ hito 3a: recuperación con el kit, contraseña, dispositivos y rotación de claves · 🔄 MVP: beta por invitación con licencias, fotos cifradas y prueba con la familia; después el 3b). Repo: https://github.com/juanjpeople/opendomus · App: https://opendomus.juanjpeople.workers.dev
> Mantener este archivo al día al cerrar cada paso.

## Próximas entregas y evidencia necesaria

Esta lista conserva los objetivos pendientes; los controles en CI no prueban por sí
solos una configuración real de producción. El despliegue queda manual.

| Entrega | Estado y condición para darla por terminada |
|---|---|
| Administración privada | Gateway y CLI implementados, sin página `/admin`. Falta verificar en la instalación real identidad permitida + MFA, rechazo de identidad ajena, token vencido y acceso directo al Worker público. Los correos exactos y proveedores se configuran fuera del código público. |
| Google y GitHub para cuentas domésticas | Pendientes. Requieren apps OAuth y un flujo de creación/desbloqueo de identidad cifrada. Probar cuenta nueva y existente, rechazo de vinculación por email no verificado, callback inválido, recuperación y revocación. No conceder permisos de operador por login social. |
| Correos y OTP domésticos | Pendientes de proveedor/remitente verificado. Probar entrega real, expiración, uso único, límites de reenvío/intentos y respuestas sin enumeración de cuentas. OTP no sustituye al kit para descifrar datos. El OTP administrativo pertenece a Access y tiene configuración separada. |
| Métricas | PR #26 prepara estadísticas públicas estáticas y consulta CLI del tráfico privado de GitHub. Contadores propios privados de descargas siguen pendientes de decisión; los contadores de assets de GitHub son públicos y no miden instalaciones. |
| Android | PWA disponible y APK local experimental en PR #31, reutilizando el export web con Capacitor. Pruebas instrumentadas cubren respaldo/restauración, foto, contenido libre y actualización sin desinstalar en Android 15; lector QR local compartido con la PWA. Estado detallado y pendientes en `ANDROID.md`. Falta validar dispositivos físicos y distribución firmada; nube, cookies y retornos OAuth nativos no habilitados. |
| Raspberry, notebook y servidor | Paquete estático local implementado en PR #24; no incluye backend multiusuario. Backend autoalojado pendiente: adaptadores, migraciones, backup/restauración y prueba en arm64/amd64. Especificaciones y comandos actuales en `PLATAFORMAS.md`. |
| ESP32 | Firmware y protocolo pendientes. Requiere identidad de dispositivo con permisos mínimos y revocación; no poner credenciales de operador ni claves generales de la casa en el firmware. |
| Compartir información y proyectos | Sincronización por casa, permisos y listas asociadas a proyectos existentes. Falta concretar y probar el intercambio entre proyectos/casas: qué se comparte, quién lo recibe, copia o vínculo, permisos, revocación y conflictos offline. No asumir que exportar toda la casa resuelve este caso. |
| Taller e inventario | Contenedores con QR, fotos y anotaciones libres implementados en PR #23; revocación reforzada en PR #25. Validar el uso real del taller y mantener herramientas, consumibles e insumos inventariados sin obligar a convertir cada anotación libre en producto. |
| Seguridad y costos | Mantener revisión de permisos, límites de recursos e intentos, auditoría de dependencias y pruebas de aislamiento. Probar cuotas y fallos de proveedores antes de activar nuevas funciones; no prometer inmunidad a ataques ni gasto nulo. |
| Suscripciones, multimedia y soporte | Continúan como entregas futuras detalladas abajo. Proveedores, políticas vigentes y pruebas reales pendientes; las propuestas históricas no son capacidades habilitadas. |

Los PRs se revisan e integran gradualmente. Una integración no publica automáticamente
la app: distinguir siempre código disponible, pruebas aprobadas y función operativa.

## Contexto

OpenDomus tiene un cliente estático (Next + Dexie/IndexedDB), modo local y un backend opcional en Workers con D1 y Durable Objects. El código incluye cuentas, invitaciones, sincronización cifrada, recuperación con kit y revocación de sesiones. Que una función esté en `main` no prueba que esté desplegada ni configurada en producción. Querés:

- que un admin **invite** a la familia y que las apps **se sincronicen** entre sí;
- tenerla **deployada**: en la nube con **suscripción automática** y también **autoalojada** en una Raspberry/NAS (el ESP32, como dispositivo satélite);
- una **app Android en Play Store**;
- **profesionalizar** el proyecto (CI, tests, licencia, releases), sabiendo que va a llevar tiempo y que todavía nadie se suscribe.

Las listas múltiples, presupuestos y proyectos ya están implementados. Las etapas completadas de abajo conservan el detalle histórico; no son instrucciones para volver a implementar esos cambios.

Lo que juega a favor:

- Todas las escrituras pasan por `src/features/*/service.ts`: es el lugar natural para la sincronización.
- Los ids ya son UUID (`src/lib/id.ts`).
- Los permisos son una sola matriz pura (`src/lib/auth/permissions.ts`) que el servidor puede reutilizar tal cual.
- El dominio (`domain.ts`) no depende ni de React ni de la base.

---

## Decisiones de arquitectura

> Actualizadas el 2026-10-04: Workers/D1/Durable Objects, fotos cifradas en Supabase Storage y tres niveles de privacidad. La distribución estática local existe; el backend autoalojado y el ESP32 siguen pendientes. Ver [plataformas](PLATAFORMAS.md) y [límites de seguridad](../SECURITY.md).

### Cómo entra cada persona (✅ hecho: landing + `/empezar`)

1. La primera vez en un dispositivo se ve la **landing**; "Empezar" lleva a **/empezar**.
2. Tres caminos: **Crear mi casa** (admin, nube), **Unirme a una casa** (invitación por link o QR) o **Probar en este dispositivo** (sin cuenta, como hasta ahora).
3. "¿Quién está en casa?" queda para dispositivos compartidos (la tablet de la cocina).
4. Siempre se ve **dónde vive la casa**: el indicador "Este dispositivo" o "Nube cifrada" (abajo del menú, en el selector de perfiles y en Ajustes → Datos). Implementado en `src/store/useDeviceStore.ts` (`mode`: `unset` | `local` | `cloud`).

### Seguridad: cifrado de extremo a extremo (E2EE)

El contenido sincronizado y las fotos se cifran en el cliente. Cuentas, membresías y metadatos operativos no son todos cifrados. Un servidor que distribuya JavaScript malicioso, un XSS o un dispositivo comprometido pueden exponer datos durante el uso: E2EE no protege frente a todos esos escenarios.

- **Claves por alcance**: cada casa tiene una clave para **Familia**, otra para **Adultos** y cada persona una para **Privado** (simétricas, AES-256-GCM).
- **Claves de cada persona**: un par de claves por usuario (X25519 para recibir claves, Ed25519 para firmar cambios). Las claves de alcance se le entregan cifradas con su clave pública.
- **Login con contraseña derivada**: el cliente usa PBKDF2-SHA256 (600.000 iteraciones) y HKDF para separar autenticación y cifrado (`src/lib/crypto`). Envía la clave de autenticación a Better Auth; no envía la contraseña humana ni la clave que abre la identidad. Argon2 no está implementado.
- **Varios dispositivos por persona**: hoy se entra con contraseña y existe recuperación con kit. Hay lista de sesiones y revocación. Passkeys PRF y aprobación desde otro dispositivo por QR siguen pendientes; la huella de un perfil local no equivale a ese mecanismo.
- **Sacar a alguien de la casa** rota las claves de los alcances que tenía: no lee nada nuevo.
- **Recuperación**:
  - un **kit de recuperación** (código para imprimir) abre lo privado;
  - lo compartido, otro miembro (el admin) te lo vuelve a entregar;
  - sin kit ni otro dispositivo, lo privado no se puede recuperar (es el precio de que nadie más pueda leerlo, y se explica antes de crear la cuenta).
- **Pendiente**: Google, GitHub y enlace mágico deben autenticar identidad sin saltarse el desbloqueo de las claves. Todavía no están habilitados para cuentas domésticas.

### Privacidad: tres niveles para cada cosa

**Familia** (todos), **Adultos** (finanzas, regalos sorpresa) y **Privado** (solo yo). Cada lista, receta, evento o proyecto tiene su nivel (por defecto, Familia). Una página de **Privacidad** muestra qué se comparte con quién.

### Nube en Cloudflare (plan gratuito para empezar)

| Pieza | Para qué |
|---|---|
| **Workers** (Hono + Better Auth) | API: cuentas, casas, invitaciones, dispositivos, sincronización. |
| **D1** (SQLite) | Usuarios, casas, membresías, claves cifradas, registro de cambios cifrados. |
| **Durable Objects** (uno por casa) | Orden de los cambios y aviso en tiempo real (WebSocket). Más adelante, el modo party. |
| **Supabase Storage** | Fotos cifradas por el cliente, bucket privado; credencial de servicio solo en el Worker. |
| **Workers con archivos estáticos** | La app (ya publicada). |

El servidor TypeScript está en `server/` y la web en `src/`, con workspaces npm. `packages/core` y un backend Node + SQLite son propuestas futuras, no rutas ni capacidades actuales.

### Sincronización con E2EE

El servidor no puede ejecutar el dominio sobre datos que no lee. Por eso la regla pasa al cliente (✅ implementado en `src/lib/sync` y `server/src/sync.ts`):

- **Captura**: un middleware de Dexie anota cada escritura de los servicios en `syncRecords`, en la misma transacción (sin tocar los servicios). Solo con la casa en la nube.
- **Operaciones**: los cambios se agrupan por nivel, se cifran con la clave de ese nivel (AES-GCM, con casa, id, nivel, versión y autor como datos adicionales) y se firman (Ed25519). En claro viaja solo id, nivel, versión de clave y autor.
- **Servidor**: verifica sesión, membresía, que el rol pueda escribir en ese nivel (un chico no escribe en "Adultos"), la versión vigente de la clave y **la firma**: una cookie robada sola no alcanza para escribir. El Durable Object de la casa les da número de orden, las guarda y avisa por WebSocket (sin contenido). A cada uno le baja solo lo que puede abrir.
- **Cada dispositivo** verifica la firma con la clave del autor (fijada la primera vez que se vio: si el servidor diera otra, la sincronización se frena), abre la operación y revisa con `permissions.ts` que el autor tenga permiso. Lo que no pasa, se descarta y se cuenta.
- **Fusión**: el orden lo da el servidor (no el reloj de cada equipo). Ediciones: gana la última, campo por campo; lo que este dispositivo no subió todavía no se pisa. Cantidades: diferencias que se suman. Borrar gana sobre editar. Cambiar el nivel de algo lo borra del nivel anterior y lo publica entero en el nuevo (con lo que hereda: ítems de la lista, comentarios, historial).
- **Robustez**: el lote se guarda antes de mandarlo y se reintenta idéntico (mismos ids): el servidor no lo duplica y una cantidad no se resta dos veces. Una sola pestaña sincroniza a la vez (Web Locks).
- **No viajan**: el PIN y las huellas de cada perfil (protegen el perfil en ese dispositivo). Las fotos se sincronizan por separado como bytes cifrados en Supabase Storage.
- Local primero: se escribe en IndexedDB al instante y se sube cuando hay conexión.

### Resto (sin cambios)

| Tema | Decisión |
|---|---|
| Web | Sitio estático (`output: "export"`), ✅ publicado en Cloudflare. |
| Android | **Capacitor** sobre el build estático. |
| Suscripciones | Entitlements por casa + proveedor intercambiable (ver "Decisiones abiertas"). |
| Repositorio | Web en `src/`, backend en `server/`; extracción de un core compartido pendiente si aporta valor. |
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
2. 🔄 **Sincronización cifrada** de los datos de la casa.
   - ✅ Durable Object por casa, operaciones cifradas y firmadas, verificación de firma en el servidor y en cada dispositivo, permisos verificados al recibir, fusión por campo con cantidades como diferencias, avisos en tiempo real.
   - ✅ "Crear mi casa" sube la casa de este dispositivo; unirse (o entrar en otro dispositivo) baja la casa y deja elegir un perfil libre ("Adulto" → Flor). El perfil queda atado a la cuenta y el dispositivo entra directo con él.
   - ✅ Indicador "Nube cifrada" con su estado (al día, sincronizando, sin conexión, problema) y Ajustes → Datos: última vez, sincronizar ahora, salir de la nube en este dispositivo (borrando o conservando la copia). Importar se bloquea con la casa en la nube.
   - ✅ Probado: tests de fusión, niveles y permisos; middleware con IndexedDB real (`fake-indexeddb`) y los servicios de verdad; API de punta a punta (incluye firmas falsas, operaciones alteradas, chico escribiendo en Adultos); dos navegadores (Ana y Flor) con consumo en vivo y simultáneo.
   - ✅ Cada lista, proyecto, receta y evento permite elegir Familia, Adultos o Privado. Los perfiles filtran también búsqueda, contadores, detalle e historial; la página de Privacidad muestra qué se comparte con quién (cada nivel con quiénes lo ven) y una marca discreta señala lo que no es de Familia. La lista de la casa siempre es de Familia.
   - ✅ Probado con tres cuentas (Ana admin, Flor adulta, Tomi chico), con la nube habilitada, en escritorio y celular: lo de Adultos y lo Privado de Ana nunca llega al navegador de Tomi (ni nombres, ni ítems, ni historial); lo Privado tampoco al de Flor; cambiar el nivel en vivo lo agrega o lo borra entero de cada dispositivo.
   - Sigue: publicar `NEXT_PUBLIC_CLOUD=1` en producción (decisión: abrirla como beta antes de tener "olvidé mi contraseña", del hito 3).
3. 🔄 **Recuperación y dispositivos.** Se divide en dos: 3a (lo necesario para abrir la nube) y 3b (otros métodos de entrada, que dependen de cuentas externas).
   - ✅ **3a**:
     - **"Olvidé mi contraseña" con el kit, sin email.** Del código del kit salen, en el dispositivo, la clave que abre la copia de las claves y una prueba independiente; el servidor guarda solo el hash de la prueba. Recuperar cambia la contraseña, re-cifra las claves, entrega un kit nuevo (el usado deja de servir) y cierra todas las sesiones, todo en una sola transacción. Tiene límite de intentos y la misma respuesta para un email inexistente.
     - **Cambiar la contraseña** (re-cifra las claves y cierra las otras sesiones) y **generar un kit nuevo** (pide la contraseña).
     - **Tus dispositivos** en Ajustes → Cuenta: dónde está abierta la cuenta (sin exponer tokens) y cerrar la sesión de uno.
     - **Sacar a alguien de la casa**: claves nuevas de Familia (y de Adultos, si no era chico) para los que quedan, el nombre de la casa re-cifrado y las invitaciones pendientes anuladas. Su perfil queda sin cuenta, con su historial. Sus cambios viejos se siguen verificando (ex miembros con su clave de firma). **Pasar a alguien a chico** también rota Adultos.
     - **Motor**: si las claves cambiaron, pide las nuevas y reintenta sin perder nada (no avanza el cursor sobre lo que no puede abrir). A quien sacaron le muestra que ya no es parte de la casa. Volver a entrar en un dispositivo que ya tenía la casa no la baja de nuevo ni pierde lo no subido.
     - Probado con tests de cifrado, la API de punta a punta (incluye kit equivocado, contraseña vieja, sobres incompletos, versión vieja) y tres navegadores: recuperar en un teléfono nuevo, volver a entrar sin perder lo no subido, cerrar un dispositivo, cambiar la contraseña, sacar a Flor y que lo escrito con claves viejas igual llegue.
   - **3b** (siguiente): aprobar un dispositivo nuevo por QR desde otro, passkeys (PRF para abrir las claves), Google, GitHub, enlace mágico y emails (Resend). Necesitan apps OAuth y un dominio para los emails.
   - Con 3a, la nube se puede abrir en producción (`NEXT_PUBLIC_CLOUD=1`), aplicando antes la migración `0003_recovery.sql` en la base de producción.


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

## Etapa 3: propuesta histórica sustituida por la sincronización E2EE

El diseño de comandos, dominio en servidor y SSE que sigue **no es el protocolo actual**. La implementación vigente es la descrita en «Sincronización con E2EE»: captura Dexie, operaciones cifradas y firmadas, Durable Objects y WebSocket. No migrar a este diseño histórico como si fuera trabajo pendiente.

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

- **Nube actual**: Worker con assets estáticos, D1, Durable Objects y Supabase Storage. La propuesta anterior Pages + VPS + Postgres quedó sustituida; no requiere migración a esa arquitectura.
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

> OpenDomus es **gratis y local por defecto**. La nube es **opcional**, con **licencia por casa**. El modelo de cobro está en definición y, por ahora, no se muestra en la app.

- **Licencias y planes por casa** (✅ base técnica en el MVP: `cloud_licenses` y `household_plans`, admin API con token, CLI `npm run admin`, pausa = se baja pero no se sube). La app solo pregunta "¿puede?", como con los permisos.
- **Cobro web**: *checkout* + portal del cliente + webhooks idempotentes → emiten o extienden la licencia de la casa.
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
3. **Backend autoalojado**: decidir cómo abstraer D1/Durable Objects y almacenamiento sin duplicar el dominio. El hosting actual de la API en la nube ya está definido; no confundirlo con esta decisión.

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
