# 🏠 OpenDomus: Plan de Implementación y Estado Actual

Este documento consolida el plan de trabajo, el estado del proyecto y el diseño de las próximas funcionalidades, para poder retomarlo en cualquier momento. Los principios que guían cada decisión están en [VALORES.md](VALORES.md); las convenciones de código, en la página **`/design`** de la app.

---

## 🛠️ Arquitectura (offline-first y self-hosted)

- **Cliente:** Next.js 16 + React 19, Ant Design 6 (tokens, sin Tailwind), framer-motion, lucide-react. Pensado para instalarse como **PWA**.
- **Datos locales:** **Dexie.js** (IndexedDB). Cada cambio de esquema es una versión nueva con migración (`src/lib/db.ts`); hoy vamos por la **v5**.
- **Servidor / sincronización:** a definir (Node.js o Go + SQLite/PostgreSQL). Hasta que exista, los datos viven en cada dispositivo.
- **Despliegue:** Docker en una NAS o servidor de la casa.

---

## 🗺️ Roadmap

### 📍 Fase 1: Los cimientos y el pañol (MVP)
1. ✅ **Base:** sistema de diseño, permisos, ajustes por perfil, navegación, historial de acciones, español e inglés.
2. ✅ **Lugares e inventario:** recintos → contenedores (anidables) → productos, con color e ícono, etiquetas QR imprimibles y escaneo.
3. ✅ **Precios:** historial por producto, el más barato y dónde, comparación online a pedido.
4. ⏳ **Consumo:** descontar insumos al usar o cocinar → [especificación](#1-consumo-y-descuento-de-insumos).
5. ⏳ **Lista de compras:** candidatos automáticos que se confirman o descartan → [especificación](#2-lista-de-compras-con-candidatos-automáticos).
6. ⏳ **PWA:** manifest + service worker para instalar y usar sin conexión.

### 📍 Fase 2: Cocina y vida en común
1. ✅ **Miembros de la familia** (alta, roles, avatar, cumpleaños) con **PIN, biometría y bloqueo automático**.
2. ✅ **Calendario compartido** (semana/mes, repetición, participantes, cumpleaños automáticos) → [especificación](#5-calendario-compartido).
3. **Comidas y recetas** con fotos y comentarios → [especificación](#3-comidas-y-recetas).
4. **Votaciones** (empezando por "¿qué comemos?") → [especificación](#4-votaciones).

### 📍 Fase 3: Cuentas claras y economía
1. Registro de transacciones y orígenes de fondos (los precios de Fase 1 alimentan esto).
2. Panel de transparencia: quién pagó qué, balances.
3. Presupuestos y metas.

### 📍 Fase 4: Proyectos, préstamos y roles
1. Gestión de usuarios y roles reales (hoy los perfiles son fijos).
2. Inventarios temporales y préstamo de herramientas.

### 📍 Fase 5: Hub familiar y bóveda
1. Caja fuerte documental (PDFs, fotos, garantías).
2. Chat interno con avisos automáticos del sistema.

### 📍 Fase 6: Entretenimiento (NAS) y preparación SaaS
1. Integración NAS (Jellyfin/Plex) y modo party sincronizado.
2. Estructura multitenant para un SaaS público.

---

## 📝 Estado actual

- **Sistema de diseño (`/design`, solo admin):** principios, tokens, movimiento, componentes, formularios, tablas y permisos, con código de ejemplo.
- **Shell:** menú completo / solo íconos / oculto, atrás-adelante, migas de pan, búsqueda global `Ctrl/⌘+K` (páginas, contenedores por nombre o código, acciones) y atajos.
- **Ajustes por perfil (`/ajustes`):** tema, color de marca, tamaño de letra, densidad, animaciones, idioma, menú. Datos: exportar a JSON, borrar caché, borrar todo (con confirmación escrita).
- **Sesión y permisos:** selector de perfiles y política RBAC única en `src/lib/auth/permissions.ts`. Fail-closed.
  - ⚠️ Mientras la app sea 100 % cliente, los permisos ordenan la experiencia pero no son seguridad real: la matriz se evalúa en el servidor cuando exista.
- **Historial de acciones:** cada servicio registra quién hizo qué dentro de la misma transacción; ajustes seguidos se agrupan.
- **Inventario (`/inventario`):** plano de la casa con recintos (color, ícono) y contenedores adentro, con barra de stock. Los contenedores se anidan hasta 3 niveles (placard → puerta → cajón; cama → cajones), cada uno con su etiqueta QR. Página por contenedor con productos, detalle, precios, etiqueta e historial. QR en `/c/<código>` y escáner en `/inventario/escanear`.
- **Internacionalización:** español e inglés, con diccionario tipado (`src/i18n/messages/`).
- **Patrón por módulo** en `src/features/<modulo>/`: `domain.ts` (tipos, reglas, validación) → `service.ts` (único que escribe + permisos + historial) → `hooks.ts` (lecturas reactivas y acciones) → `components/`.

---

## 📐 Especificaciones de las próximas funcionalidades

Orden sugerido, porque cada una se apoya en la anterior: **consumo → lista de compras → recetas → votaciones → calendario**.

### 1. Consumo y descuento de insumos

**Qué resuelve:** que el inventario refleje la realidad sin tener que restar a mano después de cada uso.

- **Consumir un producto:** acción explícita "Usé / consumí" en el producto (cantidad configurable, por defecto 1). Es distinto del ajuste manual: queda registrado como *consumo*, que es lo que después alimenta estadísticas ("cuánta yerba usamos por mes").
- **Consumir una receta:** al marcar "Cociné esto", se descuentan sus ingredientes del inventario (ver [Recetas](#3-comidas-y-recetas)). Antes de confirmar se muestra qué se va a descontar y de qué contenedor, y se puede ajustar.
- **Reglas:**
  - Nunca deja cantidades negativas: si no alcanza, descuenta hasta 0 y avisa.
  - Si un producto está en varios contenedores, se descuenta primero del que tenga menos stock (para ir vaciando).
  - Todo consumo se registra en el historial (acción `consume`) y se puede deshacer desde ahí.
- **Modelo:** reutiliza `inventory`; agrega a `ActivityAction` el valor `consume`. Para estadísticas futuras alcanza con el historial (no hace falta otra tabla).
- **Permisos:** `inventory.consume` (adultos y admin; los chicos pueden pedir permiso en una versión futura).

### 2. Lista de compras con candidatos automáticos

**Qué resuelve:** que lo que se acaba aparezca solo para comprar, pero sin llenar la lista de cosas que no queremos reponer.

- **Candidatos:** cuando un producto pasa a *stock bajo* o *agotado* (por consumo o ajuste), entra automáticamente en una bandeja de **"Para revisar"**.
- **Revisión:** cada candidato se **confirma** (pasa a la próxima lista de compras, con cantidad sugerida = mínimo − actual) o se **descarta** (con opción "no volver a sugerir este producto").
- **Lista de compras:** ítems confirmados más ítems manuales. Al marcarlos como comprados se puede:
  - sumar la cantidad al inventario, en su contenedor;
  - registrar el precio pagado (alimenta el historial de precios y, más adelante, las cuentas).
- **Estimación:** total estimado de la lista usando el último precio conocido de cada producto.
- **Modelo:** `shoppingList` ya existe en la base (v1). Agregar:
  - `ShoppingCandidate { id, itemId, reason: "low" | "empty", createdAt, status: "pending" | "confirmed" | "dismissed" }`
  - en el producto, `autoSuggest: boolean` (default `true`).
- **Reglas:** un producto no genera un candidato nuevo si ya tiene uno pendiente o si ya está en la lista. Si vuelve a tener stock antes de revisarlo, el candidato se descarta solo.
- **Permisos:** `shopping.view` (todos), `shopping.manage` (adultos y admin).

### 3. Comidas y recetas

**Qué resuelve:** tener las recetas de la casa en un solo lugar, con fotos y la opinión de la familia, conectadas al inventario.

- **Receta:** nombre, foto principal y galería, porciones, tiempo, pasos, etiquetas (vegetariana, rápida, para chicos…) e **ingredientes vinculados a productos del inventario** (o texto libre si no está cargado).
- **Disponibilidad:** cada receta muestra si se puede cocinar **con lo que hay** (✅ todo / ⚠️ falta algo / ❌ falta mucho). Desde ahí, "Agregar lo que falta a la lista de compras".
- **Cociné esto:** descuenta los ingredientes (ver [Consumo](#1-consumo-y-descuento-de-insumos)) escalados por porciones.
- **Comentarios y valoraciones:** cada perfil puede comentar ("le puse menos sal") y puntuar; los chicos también pueden puntuar, con caritas.
- **Fotos (offline):** se guardan como `Blob` en IndexedDB, comprimidas en el dispositivo antes de guardar (máximo ~1600 px, WebP/JPEG ~80 %), con miniatura aparte para las listas. Límite por foto y aviso de espacio usado en Ajustes. Nada se sube a ningún lado hasta que exista la sincronización.
- **Modelo:**
  - `Recipe { id, name, servings, minutes, steps[], tags[], coverPhotoId?, createdBy, createdAt }`
  - `RecipeIngredient { recipeId, itemId?, name, quantity, unit }`
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
- **Exportación:** el JSON de Ajustes incluye las tablas nuevas; las fotos van en un `.zip` aparte.
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

**¿Vault de contraseñas?** Decisión: **no construir un gestor de contraseñas propio** (es de lo más sensible que existe y un error es carísimo). Para eso, **integrar Vaultwarden** (compatible con Bitwarden, self-hosted en la misma NAS): enlace desde OpenDomus y, a futuro, SSO. La **bóveda** de OpenDomus (Fase 5) guarda información de la casa (wifi, pólizas, garantías, documentos), cifrada con el mismo esquema que el cifrado local.

## 🚀 Pendientes técnicos

1. **Importar** el JSON exportado (cierra el círculo de "Exportable, siempre").
2. **Deshacer** desde el historial (empezando por el consumo y los ajustes).
3. **Cifrado local** de la base (ver Seguridad).
4. **Tests** unitarios de `domain.ts`, `permissions.ts` y del traductor (lógica pura, fáciles de cubrir).
5. **Sincronización** entre dispositivos (servidor): habilita el QR desde cualquier celular, las votaciones y el calendario compartido de verdad.
