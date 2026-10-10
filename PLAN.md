# 🏠 Refugiar: arquitectura y especificaciones

Este documento guarda la arquitectura y el diseño de las funcionalidades. Qué hay y qué sigue está en [ROADMAP.md](ROADMAP.md). Los principios que guían cada decisión están en [VALORES.md](VALORES.md); las convenciones de código, en la página **`/design`** de la app y en [CONTRIBUTING.md](CONTRIBUTING.md). El camino a producción (cuentas, sincronización, deploy, Android, suscripciones) está en [docs/PLAN_PRODUCCION.md](docs/PLAN_PRODUCCION.md).

---

## 🛠️ Arquitectura (offline-first y self-hosted)

- **Cliente:** Next.js 16 + React 19, Ant Design 6 (tokens, sin Tailwind), framer-motion, lucide-react. Se instala como **PWA** y funciona sin conexión.
- **Datos locales:** **Dexie.js** (IndexedDB). Cada cambio de esquema es una versión nueva con migración (`declareSchema` en `src/lib/db.ts`); hoy vamos por la **v9**. La misma cadena de migraciones actualiza los exports viejos al importarlos.
- **Servidor / sincronización:** Cloudflare Worker + D1 + Durable Objects, con cifrado de extremo a extremo; las fotos cifradas van a Supabase Storage. Sin cuenta, los datos viven en cada dispositivo. Detalle en [docs/PLAN_PRODUCCION.md](docs/PLAN_PRODUCCION.md).
- **Despliegue:** sitio estático (`out/`, sin servidor de Next): Cloudflare Pages en la nube o cualquier servidor web en la NAS. Más adelante, el servidor de sincronización en Docker (ver el plan de producción).

---

## 🗺️ Hoja de ruta y estado actual

Lo que está hecho, lo que se está haciendo y las ideas anotadas viven en [ROADMAP.md](ROADMAP.md). Cada funcionalidad tiene su página en [docs/features](docs/features/). Este archivo guarda la arquitectura, las especificaciones y la seguridad.

---

## 📐 Especificaciones de las próximas funcionalidades

Consumo, lista de compras, calendario y recetas ya están hechos (ver [docs/features](docs/features/)). Sigue: **votaciones**.

### 1. Consumo y descuento de insumos

**Qué resuelve:** que el inventario refleje la realidad sin tener que restar a mano después de cada uso.

- **Consumir un producto:** acción explícita "Usé / consumí" en el producto (cantidad configurable, por defecto 1). Es distinto del ajuste manual: queda registrado como *consumo*, que es lo que después alimenta estadísticas ("cuánta yerba usamos por mes").
- **Consumir una receta:** al marcar "Cociné esto", se descuentan sus ingredientes del inventario (ver [Recetas](#3-comidas-y-recetas)). Antes de confirmar se muestra qué se va a descontar y de qué contenedor, y se puede ajustar.
- **Reglas:**
  - Nunca deja cantidades negativas: si no alcanza, descuenta hasta 0 y avisa.
  - Si un producto está en varios contenedores, se descuenta primero del que tenga menos stock (para ir vaciando).
  - Todo consumo se registra en el historial (acción `consume`) y se puede deshacer desde ahí.
- **Modelo:** reutiliza `inventory`; agrega a `ActivityAction` el valor `consume`. Para estadísticas futuras alcanza con el historial (no hace falta otra tabla).
- **Hecho:** consumo de un producto, aviso con deshacer, deshacer desde el historial, estadística de 30 días y "Cociné esto". **Pendiente:** la regla de varios contenedores (hoy cada producto vive en uno solo; haría falta agrupar productos iguales).
- **Permisos:** `inventory.consume` (adultos y admin; los chicos pueden pedir permiso en una versión futura).

### 2. Lista de compras con candidatos automáticos

**Qué resuelve:** que lo que se acaba aparezca solo para comprar, pero sin llenar la lista de cosas que no queremos reponer.

- **Candidatos:** cuando un producto pasa a *stock bajo* o *agotado* (por consumo o ajuste), entra automáticamente en una bandeja de **"Para revisar"**.
- **Revisión:** cada candidato se **confirma** (pasa a la próxima lista de compras, con cantidad sugerida = mínimo − actual) o se **descarta** (con opción "no volver a sugerir este producto").
- **Lista de compras:** ítems confirmados más ítems manuales. Al marcarlos como comprados se puede:
  - sumar la cantidad al inventario, en su contenedor;
  - registrar el precio pagado (alimenta el historial de precios y, más adelante, las cuentas).
- **Estimación:** total estimado de la lista usando el último precio conocido de cada producto.
- **Modelo (v7):** `shoppingList` con `status: "pending" | "bought"` (indexable; reemplaza a `isCompleted`), `restocked` para poder desmarcar sin dejar stock de más.
  - `ShoppingCandidate { id, itemId, reason: "low" | "empty", createdAt, status: "pending" | "confirmed" | "dismissed" }`
  - en el producto, `autoSuggest?: boolean` (sin definir = `true`).
  - Una sugerencia nace solo al **cruzar** el mínimo (ok → bajo/agotado): así descartarla no la hace volver con el próximo clic.
- **Reglas:** un producto no genera un candidato nuevo si ya tiene uno pendiente o si ya está en la lista. Si vuelve a tener stock antes de revisarlo, el candidato se descarta solo.
- **Permisos:** `shopping.view` (todos), `shopping.manage` (adultos y admin).

### 3. Comidas y recetas

**Qué resuelve:** tener las recetas de la casa en un solo lugar, con fotos y la opinión de la familia, conectadas al inventario.

- **Receta:** nombre, foto principal y galería, porciones, tiempo, pasos, etiquetas (vegetariana, rápida, para chicos…) e **ingredientes vinculados a productos del inventario** (o texto libre si no está cargado).
- **Disponibilidad:** cada receta muestra si se puede cocinar **con lo que hay** (✅ todo / ⚠️ falta algo / ❌ falta mucho). Desde ahí, "Agregar lo que falta a la lista de compras".
- **Cociné esto:** descuenta los ingredientes (ver [Consumo](#1-consumo-y-descuento-de-insumos)) escalados por porciones.
- **Comentarios y valoraciones:** cada perfil puede comentar ("le puse menos sal") y puntuar; los chicos también pueden puntuar, con caritas.
- **Fotos (offline):** se guardan como `Blob` en IndexedDB, comprimidas en el dispositivo antes de guardar (máximo ~1600 px, WebP/JPEG ~80 %), con miniatura aparte para las listas. Límite por foto y aviso de espacio usado en Ajustes. Nada se sube a ningún lado hasta que exista la sincronización.
- **Modelo (v8):**
  - `Recipe { id, name, servings, minutes, ingredients[], steps[], tags[], coverPhotoId?, createdBy, createdAt, updatedAt }`
  - Los ingredientes (`{ itemId?, name, quantity, unit }`) viven **dentro** de la receta: se guardan y se exportan juntos, siempre coherentes. Vinculados: cantidad entera en la unidad del producto; al escalar porciones se redondea para arriba.
  - `Photo { id, ownerType, ownerId, blob, thumb, width, height, createdAt }`
  - `Comment { id, ownerType, ownerId, authorId, text, rating?, createdAt }`
  - `Photo` y `Comment` son **genéricos** (`ownerType` + `ownerId`): sirven después para la bóveda, los productos, etc.
- **Permisos:** `recipes.view` (todos), `recipes.manage` (adultos y admin), `comments.create` (todos).

### 4. Votaciones

**Qué resuelve:** decidir en familia de forma simple y justa ("¿qué comemos el sábado?", "¿adónde vamos?").

- **Votación:** pregunta, opciones (texto libre o **recetas**, con su foto), tipo (una opción / varias / ranking), quién puede votar, fecha de cierre opcional y si los votos son anónimos.
- **Resultados** en vivo, con animación; al cerrar queda la opción ganadora. Si la ganadora es una receta: "Planificar en el calendario" y "Agregar lo que falta a la lista de compras".
- **Para chicos:** interfaz con tarjetas grandes y fotos; su voto vale igual que el de los demás, salvo que el admin configure otra cosa.
- **Reglas:** un voto por perfil (se puede cambiar hasta el cierre); quien crea la votación puede cerrarla antes de tiempo. Todo queda en el historial.
- **Modelo:**
  - `Poll { id, question, kind: "single" | "multiple" | "ranking", options[], anonymous, closesAt?, createdBy, status }`
  - `Vote { pollId, profileId, choices[] , at }`, con clave única `[pollId+profileId]`.
- **Permisos:** `polls.vote` (todos), `polls.create` (adultos y admin; configurable para chicos).
- ⚠️ Mientras no haya sincronización, votar exige usar el mismo dispositivo (por ejemplo, la tablet de la cocina). Es el primer módulo que de verdad pide el servidor.

### 5. Calendario compartido

**Qué resuelve:** que la casa tenga una sola agenda: comidas planificadas, turnos, cumpleaños, vencimientos.

- **Eventos:** título, fecha y hora (o día completo), repetición, quiénes participan, color e ícono (mismo selector de apariencia que los recintos), recordatorio.
- **Vistas:** semana (la principal, pensada para la heladera / tablet), mes y "hoy" en el inicio.
- **Integraciones internas:**
  - **Comidas:** planificar recetas por día (desde una votación o a mano). Opción "preparar la lista de compras de la semana" con todo lo que falta.
  - **Vencimientos:** productos con fecha de vencimiento (campo opcional futuro) y garantías de la bóveda.
  - **Tareas de la casa** (futuro): turnos rotativos.
- **Calendarios externos:** exportar e importar **iCal (.ics)** como formato abierto (valor "Exportable, siempre"). La sincronización bidireccional con Google/Apple sería un conector **opcional y explícito** del servidor ("Nada sale sin permiso").
- **Modelo:** `CalendarEvent { id, title, start, end?, allDay, rrule?, participantIds[], color?, icon?, link?: { type: "recipe" | "item" | "poll", id }, createdBy }`. Repeticiones con RRULE (estándar iCal).
- **Permisos:** `calendar.view` (todos), `calendar.manage` (adultos y admin); los chicos ven su propia agenda.

### Transversal a todo lo anterior

- **Historial:** cada módulo suma su `ActivityModule` y registra sus acciones en la transacción del servicio.
- **Búsqueda (`Ctrl+K`):** recetas, votaciones abiertas y eventos aparecen como resultados.
- **Idiomas:** todo texto nuevo entra por el diccionario (`es` es la fuente de verdad).
- **Exportación:** el JSON de Ajustes incluye todas las tablas; las fotos viajan adentro en base64 (`{ "$blob": …, "type": … }`) y se reconstruyen al importar.
- **Para chicos:** cada módulo define qué ve y qué puede hacer un perfil infantil.

---

## 🔐 Seguridad: qué hay y qué sigue

**Hoy (todo en el dispositivo):**
- **PIN por perfil:** PBKDF2-SHA256 (310 000 iteraciones, sal aleatoria), comparación en tiempo constante, espera progresiva tras 5 intentos fallidos.
- **Biometría (WebAuthn / passkeys del dispositivo):** huella, rostro o Windows Hello, con verificación de usuario obligatoria. Se verifica la firma, el desafío, el origen y el sitio contra la clave pública registrada. Requiere HTTPS (o `localhost`).
- **Bloqueo automático** por inactividad (por perfil) y al recargar la pestaña después del tiempo configurado.
- **Modelo de amenaza:** esto impide que otra persona use un perfil en el dispositivo (chicos, visitas). **No** protege los datos ante alguien con acceso técnico al equipo.

**Siguiente paso (alto impacto): cifrado local.** Cifrar IndexedDB con una clave de datos (AES-GCM) envuelta por una clave derivada del PIN (PBKDF2/Argon2) y/o de la passkey (extensión PRF de WebAuthn). Sin desbloquear, los datos son ilegibles incluso con DevTools.

**Con el servidor de sincronización:**
- **2FA real:** TOTP (apps de autenticación) y passkeys verificadas en el servidor. Sin servidor, un segundo factor guardado en el mismo dispositivo que los datos no agrega seguridad, por eso no se implementó.
- La matriz de permisos se evalúa también en el servidor.

**¿Vault de contraseñas?** Decisión: **no construir un gestor de contraseñas propio** (es de lo más sensible que existe y un error es carísimo). Para eso, **integrar Vaultwarden** (compatible con Bitwarden, self-hosted en la misma NAS): enlace desde Refugiar y, a futuro, SSO. La **bóveda** de Refugiar (Fase 5) guarda información de la casa (wifi, pólizas, garantías, documentos), cifrada con el mismo esquema que el cifrado local.

## 🚀 Pendientes técnicos

1. ✅ **Importar** el JSON exportado, con migración de exports viejos.
2. ✅ **Deshacer** cambios de cantidad desde el historial.
3. ✅ **Tests** unitarios (`npm test`) de dominio, permisos y traductor.
4. **Cifrado local** de la base (ver Seguridad).
5. **Sincronización** entre dispositivos (servidor): habilita el QR desde cualquier celular, las votaciones y el calendario compartido de verdad.
6. **Tests de integración** de los servicios (Dexie en memoria con `fake-indexeddb`) y de punta a punta (Playwright).
7. **Exportar a CSV** la lista de compras y el inventario (el JSON ya existe).
