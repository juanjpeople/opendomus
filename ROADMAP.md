# Refugiar: hoja de ruta

Qué hay, qué se está haciendo y qué ideas quedan anotadas. Sin fechas ni promesas.
El detalle de cada funcionalidad está en [docs/features](docs/features/).

**Estados:** 🔨 Ahora · ⏭️ Después · 💡 Ideas · ✅ Hecho · 🗑️ Descartado

## 🔨 Ahora

- **Android en Play Store**: prueba interna, después prueba cerrada (12 testers, 14 días). → [Play Store](docs/PLAY_STORE.md)
- **Más skins** con vista previa en Ajustes. → [ajustes](docs/features/ajustes.md)
- **2FA y passkeys para el admin**: acceso seguro a todo lo de la nube. → [nube](docs/features/nube.md)
- **Esta hoja de ruta** y una página por funcionalidad.

## ⏭️ Después

- **Ajustes en dos paneles** y apariencia rápida desde el avatar.
- **Plantillas de página** (`ListPage`, `DetailPage`) y registro de funcionalidades. → [unificación visual](docs/UNIFICACION_VISUAL.md)
- **Votaciones** ("¿qué comemos?"). → [especificación](PLAN.md#4-votaciones)
- **Cifrado local** de la base del dispositivo. → [seguridad](PLAN.md#-seguridad-qué-hay-y-qué-sigue)
- **Google y GitHub reales**: configurar y probar las apps OAuth. → [acceso social](docs/ACCESO_SOCIAL.md)
- **Hoja de ruta de la landing** al día con este archivo.
- **Nombres internos de la nube** (Worker, D1, bucket) a Refugiar. Prioridad baja.

## 💡 Ideas

Anotadas para no perderlas. Pasan a ⏭️ cuando se decide hacerlas.

- Mails automáticos de invitación. Necesita un proveedor de correo.
- Avisos por WhatsApp Business. Es pago; el link compartido ya llega por WhatsApp.
- Sincronizar celulares sin nube. Mucho esfuerzo; hoy alcanza con exportar e importar.
- Finanzas: quién pagó qué, balances, presupuestos y metas.
- Préstamo de herramientas e inventarios temporales.
- Bóveda de documentos: garantías, pólizas, manuales.
- Chat interno con avisos de la casa.
- Servidor autoalojado (Raspberry, NAS) y sensores ESP32. → [plataformas](docs/PLATAFORMAS.md)
- Multimedia en la NAS (Jellyfin, Plex) y modo party.
- Suscripciones por casa para la nube. → [plan de producción](docs/PLAN_PRODUCCION.md#etapa-6-suscripciones-automáticas)

## ✅ Hecho

Lo último arriba. El PR que termina algo lo agrega acá.

| Cuándo | Qué | PR |
| --- | --- | --- |
| 2026-10 | El deploy aplica las migraciones de D1 | #54 |
| 2026-10 | Tests de PR reducidos a un núcleo; el resto corre en main | #53 |
| 2026-10 | Android: release firmado, política de privacidad pública, guía de Play Store | #52 |
| 2026-10 | Compartir acceso por persona, con aprobación del admin y explicación del modo local | #51 |
| 2026-10 | Inventario: herramientas aparte, agotados ocultos, menú Vista | #50 |
| 2026-10 | refugi.ar apunta a la app | #49 |
| 2026-10 | Nombre nuevo: Refugiar | #48 |
| 2026-10 | Navegación más suave: fundido entre páginas, sin parpadeo | #47 |
| 2026-10 | Política de tests: lo lento sale del camino de los PR | #45 |
| 2026-10 | Invitaciones visibles, registro y landing más claros | #44 |
| 2026-10 | Skins: Casa, Cálido y Sobrio | #43 |
| 2026-10 | Inventario: navegación, vistas y escaneo con cámara | #41, #42 |
| 2026-10 | Nube cifrada: cuentas, casas, sincronización, privacidad y recuperación | [etapa 2](docs/PLAN_PRODUCCION.md#-etapa-2-nube-cloudflare-cuentas-casas-invitaciones-y-cifrado) |
| Antes | Inventario con QR, compras, precios, consumo, recetas, calendario, proyectos, PWA | [funcionalidades](#funcionalidades) |

## 🗑️ Descartado

- **Copia local aparte para un miembro nuevo**: la app con nube ya funciona sin conexión.
- **Gestor de contraseñas propio**: demasiado sensible; si hace falta, se integra Vaultwarden.

## Funcionalidades

Cada página dice qué hace hoy, cómo se usa y qué límites tiene. No describe planes.

| Funcionalidad | Página |
| --- | --- |
| Inventario, contenedores y QR | [inventario](docs/features/inventario.md) |
| Compras, listas, proyectos y precios | [compras](docs/features/compras.md) |
| Recetas | [recetas](docs/features/recetas.md) |
| Calendario | [calendario](docs/features/calendario.md) |
| Familia, perfiles y acceso | [familia](docs/features/familia.md) |
| Nube cifrada y privacidad | [nube](docs/features/nube.md) |
| Apariencia, ajustes y datos | [ajustes](docs/features/ajustes.md) |
| Android | [android](docs/ANDROID.md) |

## Cómo se mantiene

- Una idea nueva entra a 💡 con una línea.
- 🔨 Ahora tiene cinco cosas como máximo.
- El PR que termina algo lo mueve a ✅ y actualiza la página de esa funcionalidad.
- Arquitectura y especificaciones viven en [PLAN.md](PLAN.md); el camino a producción, en [PLAN_PRODUCCION.md](docs/PLAN_PRODUCCION.md).
