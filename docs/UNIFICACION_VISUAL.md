# Unificación visual

Plan para que toda la app se vea, se mueva y hable como la versión original de OpenDomus.
Está pensado para que lo pueda seguir cualquier persona o agente, una fase por PR.

**La referencia es `/design`.** Usa el código real, y ahí están la firma visual, los tokens de
movimiento, las piezas compartidas y cuatro flujos de referencia:
- **Recetas:** tal como se ve hoy, la referencia de calidad.
- **Almacenamiento:** rehecho como una de las estrellas de la app: vistas a elección, página por recinto, ruta tocable, contenedor por secciones, ficha reordenada y cámara que lee varias etiquetas. Detalle en [INVENTARIO.md](INVENTARIO.md); la medición en un Android real sigue pendiente.
- **Catálogo:** filtrar por rubro, consultar referencias y elegir; usa el selector real sin guardar existencias.
- **Entrada:** casa local, crear cuenta y unirse; sus piezas ya se adoptan en las pantallas de entrada.

Para verla: `npm run build:demo && npm run demo`, entrar a la casa demo con el perfil
Administrador y abrir `/design`.

## Por qué

La primera versión (3 y 4 de octubre de 2026) tenía una identidad fuerte:
- brillo radial del color de marca y cabecera de vidrio;
- la casa que se dibuja sola;
- tarjetas que suben con resorte;
- entradas en cascada;
- textos cortos en voseo.

Las funciones agregadas después la siguieron cada vez menos. Una auditoría del 7 de octubre de 2026 encontró que la base seguía intacta (tema, `lib/motion`, `components/ui`, ilustraciones) y que el problema estaba en las pantallas nuevas:
- **Movimiento:** ninguna pantalla nueva tiene animaciones. Todos los `whileHover`, `whileTap` y `AnimatePresence` son de la primera versión.
- **Encabezados:** había páginas con tres o cuatro estilos distintos de encabezado de sección.
- **Texto:** había muros de `Alert` y párrafos.
- **Componentes reinventados:**
  - cinco formas distintas de "elegir una opción";
  - unas diez copias de "ícono + título + subtítulo";
  - tres indicadores de pasos distintos.
- **Colores y tamaños fijos:** había colores escritos a mano en la cámara y en el AR, y tamaños de ícono fijos en las pantallas de nube.
- **Textos sin traducir:** la configuración de casa, los precios de referencia y el calendario escolar tienen textos por idioma escritos en el componente.
- **Panel de operador:** se compila sin CSS, así que los íconos salen de 24px dentro de botones de 32px.

## Reglas

1. **Nada se usa en una pantalla si antes no está en `/design`.** Primero se arma o arregla la
   pieza en `src/components/ui` (y se exporta en `index.ts`), después se muestra en `/design`
   con un `DemoBlock`, y recién entonces se adopta.
2. **Ante una decisión de UI, gana la mejor calidad visual**, fiel a la firma original.
3. **Tokens siempre:**
   - colores, radios y tamaños con `theme.useToken()`;
   - el color de una entidad con `tint()`;
   - movimiento con `DURATION`, `EASE_OUT`, `SPRING`, `STAGGER`, `HOVER_LIFT` y `TAP` de `src/lib/motion.ts`;
   - se anima solo transform y opacity.
4. **Todo texto por `t()`**, siguiendo "Voz y textos" de `/design`.
5. **Nombres accesibles estables.** Las pruebas e2e buscan los botones por su nombre: si cambia un
   label, se actualiza la spec en el mismo PR.
6. **Sin dependencias nuevas.** Todo se hace con antd, framer-motion y lucide. Ver la regla de
   costos en `AGENTS.md`.
7. **Lo que se quitó a propósito no vuelve.** Por ejemplo, la tarjeta de valores del tablero (#32).

## Barandas

- **`scripts/design-lint.test.mjs`** corre con `npm test` y falla si aparece:
  - un color escrito a mano;
  - un `locale === "es" ? … : …`;
  - un ícono lucide con `size`;
  - un tamaño de letra fijo (`fontSize: 18`);
  - una pieza de `components/ui` o `components/motion` sin documentar en `/design`.

  La deuda que ya existe está anotada en `DEBT`, con un número por archivo. Al arreglar un archivo, ese número baja (y la prueba avisa cuando se puede bajar). Nunca sube.
- **AGENTS.md**, sección "Sistema visual".
- **`/design` → Calidad → "Revisión antes de un PR"**: la lista para repasar.

## Fases

Cada fase es un PR. Antes de empezar una, recorré `/design` y el flujo correspondiente.

### Fase 0: Línea de base y barandas ✅
- [x] Reconstruidas las capturas anteriores desde `f7089e6` limpio y comparadas con la rama de revisión. `playwright.visual.config.ts` recorre los mismos 38 puntos en escritorio (1280 px) y celular (320 px), claro y oscuro: 152 pares. Evidencia local: `.playwright-mcp/baseline-final`, `.playwright-mcp/comparison-final` y el visor `.playwright-mcp/revision-flujos.html`. `VISUAL_BASE_URL` permite apuntar al servidor de la versión anterior. Cada ejecución adjunta su manifiesto de build.
  El recorrido espera fuentes, el dibujo del logo y las entradas de Framer; centra los títulos al desplazarse para activar Reveal también en móvil. La comparación detectó y corrigió el ancho mínimo de los ambientes: el mosaico usa el mismo token que la referencia de `/design`.
- [x] `design-lint` con deuda registrada.
- [x] Sección "Sistema visual" en AGENTS.md.
- [x] `e2e/visual-tour.spec.ts`. Usa la build demo (`playwright.demo.config.ts`, escritorio + Pixel 7) y saca capturas en claro y oscuro de:
  - `/design` (una por sección);
  - landing, `/empezar`, `/cuenta`, `/unirme`;
  - tablero, `/inventario`, un contenedor y la cámara;
  - `/compras`, `/recetas`, `/ajustes`, `/feedback`.

  Seguí el patrón de capturas de `e2e/container-contents.spec.ts` (`animations: "disabled"`). Sirve de "antes" para comparar cada fase.

  Se ejecuta con `npm run e2e:demo`. Las capturas quedan en `test-results/visual-tour-*`
  y el CI las conserva en `demo-test-results` durante 7 días, también cuando pasa.
  Incluye además calendario, familia, proyectos y los tres modos de cámara de la referencia.
  En los recortes de `/design` se oculta solo la cabecera fija para que no tape la pieza.
  **Límite:** en la build demo, cuenta e invitaciones muestran la variante sin servidor;
  sus formularios cloud necesitan un recorrido separado sobre la build normal.

### Revisión iniciada el 7 de octubre de 2026

- `main` en `f7089e6`: CI 37585591101 terminó correctamente. El Android anterior
  fallaba porque su recorrido omitía la configuración de casa incorporada en #36.
  El test ahora elige taller y estantería antes de guardar; el respaldo y el QR usan
  ese contenedor explícito. El emulador Android del CI lo aprobó en el run 37619903081
  (ver «Validación fuera del navegador»).
- Calendario escolar: el CI 37583946966 agotó 60 segundos esperando “Marcar revisada”
  y pasó al reintentar. La suite completa reprodujo una tarjeta con opacidad cero.
  `setFixedTime` también instala el reloj de Playwright y reemplaza performance/RAF,
  lo que puede desfasarlos del timeline nativo de las animaciones. El test ahora
  fija solo `Date` antes de cargar el documento y conserva los temporizadores reales.
  Comprueba el tipo seleccionado, la tarea visible y la opacidad antes de marcarla.
  El CI del PR #38 lo aprobó con `failOnFlakyTests`: un reintento no alcanza para pasar.
- Almacenamiento: se conserva la cámara única con modos y el orden productos →
  compartimentos → anotaciones. En móvil, los selectores de la referencia pasan a
  vertical para que sus nombres sigan siendo legibles.
- Entrada local, alta de cuenta y aceptación de invitación: referencia interactiva
  en `/design`, con volver, validación, carga, error y final. Las pantallas adoptan
  los encabezados, avisos y pasos compartidos; cuenta conserva el ancho al pasar a
  configurar la casa. La configuración usa traducciones y entradas en cascada.
  La configuración ya usa tarjetas con íconos para ambientes, contenedores y
  punto de partida, y permite escribir cantidades o ajustarlas con botones.
- Validación local del bloque de entrada: `npm run check` (177 pruebas), build
  normal y suite completa (52 aprobadas, 2 omisiones preexistentes). Después del
  ajuste del selector de cuenta en móvil, pasaron de nuevo el alta cloud y la
  entrada a 320 px en ES/EN (4 pruebas). El selector muestra las dos opciones
  completas; el test comprueba que no haya desborde ni etiquetas truncadas.
  Build demo y `e2e:demo`: 6 aprobadas, con capturas de escritorio y celular en
  claro y oscuro. No reemplazan la revisión pendiente en Android real ni la
  combinación de marca, radios y tamaño de letra de la lista final.
- Segundo bloque: `ChoiceCards` v2 y cantidades editables adoptados en HouseSetup;
  selector compartido y una sola vista previa en los formularios de almacenamiento.
  La suite completa pasó con 54 aprobadas y 2 omisiones. Las pruebas específicas
  de configuración y formularios pasaron en escritorio y móvil (6): teclado,
  límite cero, exclusión de artículos, nombre conservado al cambiar de tipo,
  vista previa única y persistencia del contenedor después de recargar.

### Fase 1: `/design` como estándar ✅
- [x] Nuevo índice:
  - Fundamentos (con Firma visual y Voz);
  - Componentes antd;
  - Componentes propios (Estructura, Estados, Selección, Datos, Espacios);
  - Flujos;
  - Calidad;
  - Seguridad.
- [x] Piezas nuevas: `SectionHeader`, `VisualTile`, `RoomFloor`, `ListRow`, `StatTile`, `CameraViewport`, `NavCard` (salió del tablero), `PulseDot` y `PageHeader.leading`.
- [x] `ContainerScene`: la silueta es fluida (no se recorta en fichas angostas) y tiene una variante `bare` sin fondo, para usarla sobre el visor de cámara.
- [x] Tokens `HOVER_LIFT` y `TAP`.
- [x] `AnimatedNumber` sigue el idioma activo.
- [x] Clase `.od-focusable` para el foco visible.
- [x] Flujos de almacenamiento (objetivo) y recetas (adoptado).
- [x] Piezas para los flujos de entrada. Cada una va con su `DemoBlock` y un flujo "Alta de cuenta" en `/design`:

  | Pieza | Qué es | Reemplaza |
  |---|---|---|
  | `PanelHeader` | IconTile + título h3 + subtítulo + extra | ~10 copias en cloud, feedback y operador |
  | `Callout` | Tonos neutral, primary, warning y danger, con IconTile | Muros de `Alert`, "dónde viven tus datos", nota de seguridad, DemoNotice |
  | `StepFlow` | Encabezado, progreso, `AnimatePresence mode="wait"` con `DURATION.base`/`EASE_OUT`, ancho estable, pie con volver + primario | Los pasos de AccountPage, JoinPage y HouseSetup |
  | `ResultState` | Hermano de EmptyState para "listo" | Finales de AccountPage y JoinPage |
  | `TrustNote` | Nota de cifrado | AccountPage, AuthForm, JoinPage |
  | `ChoiceCards` v2 | Modo lista, ranura de ícono o avatar, multi-selección, compacto | KindPicker, ChooseProfile, los radios de HouseSetup y LeaveCloud |
  | `SettingRow` | Compartida en `components/ui` | Ajustes y acceso social, con grupo accesible |
  | `ProviderButton` | Botón de proveedor con SVG monocromo | Espera y vinculación documentadas en Entrada |

  Implementadas y documentadas: `PanelHeader`, `Callout`, `StepFlow`, `ResultState` y
  `TrustNote`. El flujo de entrada ya permite recorrer los tres caminos y mostrar
  error, envío en curso y resultado. Es una referencia en memoria, sin crear cuentas
  ni escribir en la casa. `StepFlow` permite `framed={false}` para pasos embebidos,
  sin duplicar bordes ni márgenes. `ChoiceCards` v2 agrega lista, variante compacta,
  selección múltiple, ranura de ícono/avatar y opciones deshabilitadas. Radios con
  flechas y selección múltiple con Tab/Espacio. `QuantityStepper` admite edición
  directa, límites y estado deshabilitado, documentados en Selección. `SettingRow` se movió a UI y quedó documentado junto a `ProviderButton` en Entrada.

  Utilidades:
  - `formatQuantity(t, qty, unit, format.number)` y `formatUnit(t, qty, unit)` implementados en `features/inventory/format.ts`: comparten plurales y preservan unidades propias. El cuarto parámetro usa el formato numérico del idioma en inventario, compras, recetas, cámara/AR e historial;
  - `useOverlayPalette()` implementado: resuelve los tokens como colores hex/rgba para el canvas del AR (`storage/spatial/renderer.ts`), sin perder transparencia.

### Fase 2: Almacenamiento e inventario (prioridad)
Seguí el flujo "Almacenamiento" de `/design`, que usa las mismas piezas.

**Plano de la casa**
- [x] **StoragePage:**
  - un solo botón de cámara en la cabecera;
  - buscador en `Reveal`, oculto si no hay recintos;
  - ambientes con `RoomFloor`.
- [x] **ContainerTiles:** pasa a `VisualTile`, con tres líneas como mucho (título, tipo · cantidad, barra de stock). Se borran las reglas de hover de `storage.module.css`.
- [x] **StorageSearch:** resultados en `ListRow` con el término resaltado, `EmptyState` y código en mono.

**Página de un contenedor**
- [x] **ContainerPage:**
  - `PageHeader leading` con el IconTile del contenedor;
  - dos acciones visibles y el resto en ⋯;
  - `StatTile` × 3;
  - un `SectionHeader` por sección;
  - orden: productos → compartimentos → anotaciones, en cascada.
- [x] **ContainerContents:** `ListRow` + input en línea (sin Modal para editar una línea); corregir la clave `nameRequired`.
- [x] **InventoryList:** pasa a `ListRow` (vuelve el foco visible), con la columna de ícono siempre presente y un respaldo genérico.
- [x] **InventoryForm:** título de Card y el botón principal al final.

El plano y el contenedor ya usan las piezas de la referencia. La búsqueda conserva
la navegación por enlace y resalta coincidencias sin perder tildes. La edición de
anotaciones ocurre en la fila; Escape cancela y guardar devuelve el foco al botón.
Los encabezados de sección se parten en líneas en anchos pequeños.

`storage-overview.spec.ts`, `container-contents.spec.ts` e `inventory-controls.spec.ts`
verifican búsqueda, QR, fotos, edición sin red, consumo, deshacer e historial.
Los casos móviles de estos recorridos usan 320 px y comprueban que no haya
scroll horizontal. El acceso al historial, la edición y el borrado conserva sus permisos.

Validación local del bloque: `npm run check` (180 pruebas), build normal y demo,
suite e2e completa (60 aprobadas, 2 omitidas) y demo (6 aprobadas). Las capturas
quedaron en `.playwright-mcp/storage-final` y `.playwright-mcp/storage-demo-final`.
Se revisó además marca violeta, letra extra grande, redondeo 0/20 y movimiento
reducido en la demo. La primera corrida general se descartó porque el servidor
local acumulado se cerró con `EMFILE`; la repetición con servidor nuevo pasó.

**Formularios y catálogo**
- [x] **StorageForms:** `KindPicker` → `ChoiceCards` v2; una sola vista previa. El cambio de tipo conserva un nombre escrito y permite navegar con flechas.
  Color e ícono quedan plegados detrás de la vista previa, que funciona como encabezado.
  Al editar sin abrirlos, se conservan los elegidos (`forceRender`).
- [x] **CatalogPicker:**
  - categorías como chips de color;
  - entradas con `VisualTile`;
  - precio de referencia en un popover;
  - aviso al elegir.

  `FilterChips` y el selector real están documentados en `/design#flujo-catalogo`.
  La búsqueda y el rubro se combinan; el estado vacío permite limpiar ambos.
  Consultar una referencia no selecciona el producto. Escape cierra el popover
  sin cerrar el catálogo y devuelve el foco. Elegir completa el formulario;
  solo **Agregar** crea las existencias.

  Validación del catálogo: `npm run check` (180 pruebas), regresión general
  (64 aprobadas, 2 omitidas), demo (6 aprobadas) y los cuatro casos de
  `catalog.spec.ts` repetidos tras el ajuste final del foco. La referencia
  completa queda dentro del viewport de 320 px; Tab alcanza el comercio.
  Se probaron ES/EN, una referencia publicada y un producto sin referencia,
  filtros combinados y valores iniciales de consumibles y herramientas.
  Capturas finales: `.playwright-mcp/catalog-verified`; recorrido demo:
  `.playwright-mcp/catalog-demo-final`.

**Cámara y AR**
- [x] **Cámara:**
  - `ScanPage` y `CameraInventory` → una pantalla con `CameraViewport` y `Segmented` de modos (Escanear QR · Mirar y encontrar · AR);
  - un solo `useCameraScanner`;
  - `StockTag` en vez del mapeo a mano;
  - la ruta `/inventario/escanear` sigue funcionando y abre el modo QR.
- [x] **AR:** `SpatialPanel` y `renderer.ts` con colores de tokens (el `<select>` nativo se queda, porque WebXR lo necesita). La vista previa usa los mismos datos filtrados. El anclaje real queda pendiente de validación en un teléfono compatible.

  La selección y la búsqueda se conservan al cambiar de modo. El lector se detiene
  antes de cambiar; los permisos y videos que llegan tarde se descartan. QR abre
  la ficha y «Mirar y encontrar» conserva la vista de cámara. AR explica cuando
  no hay soporte y mantiene disponible la entrada por QR. No pide permisos al
  abrir la pantalla. El canvas recibe la paleta resuelta por `useOverlayPalette`.

  Verificado en escritorio y 320 px: permiso denegado y entrada manual, permiso
  tardío al salir o cambiar de modo, video pendiente, primera lectura QR offline
  sin BarcodeDetector, productos y anotaciones filtrados, y apertura de la ficha.
  Evidencia: `.playwright-mcp/camera-modes`. WebXR físico y Android nativo siguen
  pendientes; las pruebas del navegador no sustituyen esa verificación.

  Validación de este bloque: `npm run check` (180 pruebas), builds normal/demo,
  14 casos de cámara en escritorio/celular y 6 pruebas demo (claro/oscuro).
  La regresión general terminó con 69 aprobadas, 2 omitidas y un timeout del
  alta cifrada en escritorio mientras corría el recorrido visual. Ese caso pasó
  dos veces al repetirlo solo (13,7 y 13,1 s); no se modificó su límite de tiempo.
  Trazas: `.playwright-mcp/camera-regression` y `camera-cloud-recheck`.
  Recorrido demo: `.playwright-mcp/camera-demo`; captura final: `camera-final`.

- [x] **`storage.module.css`:** conserva geometría adaptable y proporciones del dibujo.
  `ContainerScene` le pasa escala, radios e insignias desde los tokens. Se quitó
  una transición CSS que no estaba controlada por la preferencia de movimiento.
  Los nombres de ambientes se leen completos: se parten en líneas y las acciones
  bajan cuando falta espacio, tanto en la pantalla como en la referencia.

  Verificación de personalización: ocho casos de almacenamiento/formularios en
  escritorio y celular, con 320 px, marca violeta, letra muy grande, radios base
  0/20, movimiento reducido y claro/oscuro. En la demo se comprobaron manualmente
  marca, letra, movimiento reducido y radios efectivos 0/16 (el algoritmo de
  Ant Design limita `borderRadiusLG` a 16 para radio base 20).
  Evidencia: `.playwright-mcp/storage-theme-final`. `npm run check`: 180 pruebas.
  Demo: seis pruebas aprobadas; capturas en `.playwright-mcp/storage-adopted-demo`.
  El flujo de almacenamiento en `/design` pasa a «Así se ve hoy en la app»;
  la validación física de AR/Android conserva su pendiente explícito.

- [x] **Táctiles a 44px:** QR de las fichas y `ConsumeButton`.

### Fase 3: Flujos de entrada y cuenta
- [x] **Onboarding:**
  - [x] las tres opciones primero;
  - [x] demo y cuentas debajo, con `Reveal`;
  - [x] el paso a HouseSetup con `StepFlow`.
  - Las tres entradas conservan acciones de navegación; no son radios de un formulario.
- [x] **HouseSetup:**
  - [x] todo por `t()` (claves `houseSetup.*`);
  - [x] `StepFlow`;
  - [x] `ChoiceCards` v2 con íconos;
  - [x] `QuantityStepper` con edición directa;
  - [x] un `Callout` en lugar de tres descargos;
  - [x] «Empezar sin precarga» en el pie, como `secondary` de `StepFlow`, junto a la acción principal.
- [x] **AccountPage y JoinPage:** `StepFlow` con ancho estable, `PanelHeader`, `ResultState` y `TrustNote`.
- [x] **SocialAccess:**
  - logos de proveedor en SVG inline y divisor "o";
  - un `Callout`;
  - `Link` en vez de `<a>`;
  - dentro de un `SettingRow`.
- [x] **Cloud:** se sacan los `size={n}` de los íconos y se baja `DEBT`.
- [x] **FeedbackPage y LocalOnlyPage:**
  - `Reveal` y `PanelHeader`;
  - carga en el envío;
  - mensajes de validación en voseo.

  `SettingRow` conserva el diseño adaptable de Ajustes y agrega agrupación
  accesible con título y descripción. `ProviderButton` usa SVG monocromos y
  conserva su nombre accesible durante la espera (`aria-busy`). La referencia
  en `/design` permite simular espera y vinculación sin abrir OAuth ni escribir
  en una cuenta. En la app solo aparecen los proveedores habilitados.

  Comentarios conserva el borrador ante un fallo, bloquea envíos repetidos y
  valida entre 10 y 2000 caracteres tras quitar espacios de los extremos. El correo es opcional;
  se omite del envío cuando está vacío. El error queda junto al formulario.
  La pantalla de instalación local usa el mismo encabezado y entrada animada.

  Verificación dirigida: 16 pruebas aprobadas de cuenta/comentarios (ES/EN,
  320 px, carga/fallo/reintento, contraseña disponible, retorno social sin sesión,
  alta cifrada en dos dispositivos y vinculación desde Ajustes). OAuth y feedback
  se prueban con transporte simulado; no se vincularon cuentas ni se enviaron
  mensajes reales. Capturas y trazas: `.playwright-mcp/account-verified`.
  - Validación final del bloque: `npm run check` (180 pruebas), compilación normal y demo,
    recorrido demo (6 pruebas) y regresión completa (80 aprobadas, 2 omisiones previstas).
    Evidencias: `.playwright-mcp/account-demo` y `.playwright-mcp/account-regression`.

### Fase 4: Inserciones sobre pantallas originales
- [x] **Demo:**
  - `DemoNotice` es un indicador en la cabecera adulta e infantil. `ContextBadge`, documentado en `/design`, abre el detalle con teclado, mueve el foco al panel y lo devuelve al cerrar con Escape;
  - `DemoLauncher` usa una misma tarjeta adaptable en todas sus ubicaciones. Conserva navegación completa para cambiar de base de datos;
  - las acciones de administración usan `Can`; restablecer conserva su confirmación y cargar ejemplos bloquea el doble envío;
  - cabecera adaptable a 320 px y controles táctiles de 44 px. Validación de aislamiento, persistencia, reinicio y permisos en escritorio y celular.
  - Verificado: `npm run check` (180 pruebas), compilaciones normal y demo, 8 recorridos demo y 2 pruebas de cambio entre casas. Capturas: `.playwright-mcp/demo-header-verified` y `.playwright-mcp/demo-houses-verified`.
- [x] **Landing:**
  - `ProjectIntroduction`, `ProjectStats`, `AccountLinks` y `DemoLauncher` usan `SectionTitle`, eyebrow, `clamp` y cascada;
  - las cifras usan `StatTile`; conservan la fecha UTC, la fuente y el alcance de los datos.
  - `SectionTitle` se comparte desde UI y se documenta en `/design`. El acceso a cuenta mantiene una variante compacta para Empezar.
  - Portada y entrada verificadas en 320 px, ES/EN y claro/oscuro (6 pruebas). Evidencias: `.playwright-mcp/landing-final`. También aprobaron `npm run check` (180 pruebas), ambas compilaciones y los 8 recorridos demo (`.playwright-mcp/landing-demo`).
- [x] **ReferencePrice:**
  - por `t()`;
  - fecha con `format.date`;
  - enlace con ícono;
  - `Callout` compacto debajo de los precios.
- [x] **Calendario escolar** (CalendarOptions, EventModal, SchoolToday): textos centralizados en `school.*`, incluido el país interpolado.
  - Configuración con tokens, entrada `Reveal` y ayuda `Callout`. Guardar configuración, eventos y tareas bloquea envíos duplicados; el formulario y sus salidas quedan bloqueados mientras se guarda el evento.
  - `CalendarPage` conserva el cálculo de inicio de semana por locale. Es una excepción legítima del chequeo, no una traducción pendiente.
  - Cuatro pruebas en paralelo aprobaron feriados offline, materias y tareas por hijo, días sin clases, validación inglesa y guardado único a 320 px. Evidencias: `.playwright-mcp/school-verified`. También aprobaron las 180 pruebas de base y los 8 recorridos demo (`.playwright-mcp/school-demo`). La demo compiló; Windows bloqueó el renombrado de salida y se recuperó copiando el export verificado a `demo-dist`. La compilación normal se restauró correctamente.
  - El CI del PR #38 reveló otra intermitencia al seleccionar «Sin clases / vacaciones» en Chromium móvil. Se reprodujo una vez en ocho ejecuciones paralelas sin reintentos. La prueba ahora espera las transiciones del modal y del menú antes de seleccionar; las ocho repeticiones equivalentes pasaron (`.playwright-mcp/school-animation-check`). `failOnFlakyTests` impide que CI quede verde gracias a un reintento.
- [x] **Retoques:**
  - navegación activa y nombre de la app usan el color de texto del tema; el fondo y el ícono conservan la marca. Eyebrows de `PageHeader`, inicio y referencia visual usan texto secundario, escalado por tokens;
  - prueba con marca violeta, texto XL, claro/oscuro y 320 px: contraste calculado mayor o igual a 4,5:1 para navegación activa y eyebrow sobre el fondo de marca;
  - cumpleaños con `Cake` de lucide, fecha legible y tamaño heredado;
  - PrivacyPage usa `ListRow`: hover de framer, foco visible, enlace real y nombres completos. Se eliminó el CSS inyectado;
  - el QR usa `token.colorWhite`;
  - los tamaños de letra fijos pasan a tokens (`fontSizeSM`, `fontSizeLG`, `fontSizeXL`, `fontSizeHeadingN`); el modo chicos usa `FONT_SIZES.xl`. CookModal usa `IconTile`;
  - las caritas del puntaje infantil y el castillo del título quedan como excepción documentada en Fundamentos;
  - verificados navegación, teclado y permisos por perfil: 9 pruebas aprobadas y una omisión prevista. Capturas: `.playwright-mcp/privacy-verified`. También aprobaron `npm run check` (180 pruebas), compilaciones normal y demo y los 8 recorridos demo (`.playwright-mcp/privacy-demo`).

### Fase 5: Panel de operador
- [x] **Tema compartido:** `ThemeProvider` exporta un constructor de tema y `operator/main.tsx` lo usa con `DEFAULT_PREFERENCES`.
- [x] **CSS en el bundle:** `scripts/build-operator.mjs` empaqueta un CSS mínimo con `.lucide`, la fuente y el fondo que sigue al modo oscuro.
- [x] **Datos en pantalla:**
  - todo por i18n;
  - enums con etiquetas legibles;
  - fechas con locale;
  - el riesgo en `Descriptions`, no en JSON.
- [x] **Cabecera:** `HouseMark` + "OpenDomus" + Tag "Operador".

Verificado: 180 checks (`npm run check`), build normal y bundle de operador.
El recorrido privado pasó en escritorio y a 320 px con clave/TOTP sintéticos:
rechazo, cinco secciones, riesgos legibles, fechas, generación única de licencia,
fallo de consulta, recuperación, revocación de identidad y cierre de sesión.
El tema cambia con el sistema sin recargar. En móvil, un selector reemplaza las
pestañas recortadas. La hoja `/admin/panel.css` conserva los encabezados de seguridad.
Las 6 pruebas de entrada y privacidad verifican que el constructor compartido
conserve idioma, color violeta, letra grande, contraste y permisos de la app.
Capturas: `.playwright-mcp/operator-complete/` (datos sintéticos).

### Fase 6: Voz
- [x] **Revisión de `es.ts`/`en.ts`** con "Voz y textos" de `/design`:
  - `storage.contents.summary` se eliminó: estaba sin uso desde la migración de las fichas, por lo que no vuelve el resumen incorrecto «1 anotaciones · 0 fotos»;
  - `camera.*` y `spatial.*` reescritos;
  - un solo nombre para la cámara;
  - `social.*` y `demo.*` en una oración;
  - un solo `errors.validation.nameRequired` para dominio y formularios.

  Aplicado en ambos idiomas: las ayudas principales de demo y acceso social se
  acortaron; el alcance de los datos y la necesidad de contraseña permanecen en
  líneas separadas. Las cantidades comparten singular/plural y formato decimal;
  las unidades personalizadas se conservan. `npm run check`: 181 pruebas, incluido
  el caso de cero, uno, decimales y unidad libre en ES/EN. La suite web completa
  dio 80 aprobadas, 2 omisiones previstas y 10 fallas por selectores anteriores.
  Actualizadas las comprobaciones de textos y cifras, las 14 pruebas de los tres
  archivos afectados pasaron completas (alta cifrada, acceso social y estadísticas).
  Evidencia: `.playwright-mcp/voice-regression/` y `.playwright-mcp/voice-verified/`.
  Las 8 pruebas demo también pasaron (`.playwright-mcp/voice-demo/`), con recorridos
  en claro/oscuro y escritorio/móvil. Se restauró el build normal (`demo: false`).
- [x] **Pasada final por `/design`:** piezas documentadas, entrada y almacenamiento adoptados, catálogo y recetas disponibles como referencia.
  `SecuritySection` distingue permisos locales, verificaciones del servidor (sesión,
  pertenencia, nivel de acceso y firmas) y validación del autor en cada dispositivo
  después de descifrar. La explicación se contrastó con la API y `sync/policy.ts`,
  y se comprobó en la vista compilada. El servidor no puede leer el contenido cifrado.

### Cierre: pendientes del plan original (8 de octubre de 2026)
Tras el PR #38 quedaban cuatro detalles del plan original sin aplicar. Ya están resueltos:
- **Color e ícono plegados en StorageForms.** La vista previa es el encabezado de la sección.
  Muestra si se usa la apariencia del tipo o una elegida. El patrón (`Collapse` ghost con
  `forceRender`) quedó documentado en `/design#formularios`. Los formularios ahora se llaman
  `space` y `container`: sus ids ya no chocan con el formulario de productos. Antes, en la
  página del contenedor, el campo «Nombre» del modal de edición se quedaba sin etiqueta.
  La vista previa ya no tapa el nombre.
- **«Empezar sin precarga» en el pie de HouseSetup.** `StepFlow` suma `secondary`, que va
  junto a la acción principal. En pantallas angostas, las dos ocupan el ancho. La referencia
  de entrada en `/design` usa la misma pieza.
- **Tamaños de letra por tokens** en la app y en `/design`. `design-lint` agrega la regla
  `fontSize` sin deuda registrada.
- **Excepción de emojis infantiles** documentada en Fundamentos.

`eslint` ignora `.playwright-mcp/`, donde se guardan las evidencias locales: un informe del
CI descargado ahí hacía fallar `npm run check`.

Verificación: `npm run check` (181 pruebas), compilaciones normal y demo, suite e2e completa
(90 aprobadas, 2 omisiones previstas) y demo (8 aprobadas, con el recorrido visual).
`storage-forms.spec.ts` comprueba que la sección empieza plegada y que se puede elegir un
color. También comprueba que, al editar sin abrirla, el color elegido se conserva.

### Validación fuera del navegador
El CI de Android del PR #38 (`37619903081`, commit `9bb410c`) aprobó sus cinco
pruebas nativas sin fallas ni omisiones, incluida `offlineOnboardingAndReloadKeepTheHouse`.
También cubrió permisos e inicio/cierre de cámara, exportación UTF-8, cancelación
y fallo/reintento del respaldo. Los informes y el APK están en los artefactos de ese run.
Cámara y AR en un Android físico siguen pendientes: el emulador no verifica
anclajes reales ni las condiciones de iluminación y movimiento del teléfono.

**Primera prueba física (Galaxy A55, Chrome, 8 de octubre de 2026), sobre `8c959f5`:**
- Escanear QR solo lee la etiqueta muy de cerca. La cámara se pide sin lente,
  resolución ni enfoque (`facingMode` solamente), y cada cuadro se achica a 640 px
  antes de buscar el QR. Con el gran angular, la etiqueta queda en pocos píxeles.
- «Mirar y encontrar» falla por la misma lectura.
- AR no funcionó en ningún intento. Además, WebXR no conserva las posiciones entre
  sesiones: no sirve para encontrar lo que se guardó días atrás.
- La navegación de inventario se siente aparte del resto de la app.

Estos problemas son de funcionamiento y de flujo, no de unificación visual. Se trataron
en el plan de cámara e inventario: ver [INVENTARIO.md](INVENTARIO.md). Falta repetir la
prueba en el A55 y anotar ahí las distancias medidas.

### Cierre del inventario y cámara (8 de octubre de 2026)

El inventario incorpora Lugares, Plano, Lista y Tarjetas, páginas de recintos y enlaces
directos a productos. Las preferencias se guardan por perfil. `/design` muestra los
recorridos y las piezas compartidas `PathCrumbs`, `PlaceCard`, `PlaceChip` y `ViewSwitcher`.
“Para reponer” usa los mismos accesos compactos en la app y en el flujo de referencia.

La búsqueda de cámara abre el contenedor exacto del producto, incluso si lo detecta a
través de la etiqueta del mueble padre. Una prueba en escritorio y celular verifica
ambos accesos: resultado de búsqueda y burbuja sobre la etiqueta. El test de edición
espera llegar al contenedor antes de abrir “Más acciones”, para no tocar el menú del
recinto anterior durante la navegación.

Verificación local: `npm run check` (194 pruebas, tipos y lint), compilaciones normal
y demo, 28 pruebas de inventario, cámara, formularios y temas, y las ocho pruebas de
demo aprobadas (recorrido visual en claro/oscuro y escritorio/celular). La primera
suite general dio 93 aprobadas, dos omisiones previstas y la carrera de navegación
del test de edición; ese test pasó en ambas pantallas después del ajuste. La evidencia
está en `.playwright-mcp/inventory-final/`. La validación física de cámara/AR en el A55
sigue pendiente; las capturas y las cámaras simuladas no miden distancias de lectura.

## Cómo verificar cada fase
1. Corre `npm run check` (typecheck + lint + tests, incluye `design-lint`).
2. Corren `npm run e2e` y `npm run e2e:demo`; para el operador, `playwright.operator.config.ts`.
3. Se compara el recorrido visual (Fase 0) antes y después.
4. Manual, en la demo:
   - color de marca no azul;
   - redondeo en 0 y en 20;
   - letra extra grande;
   - "Movimiento: reducidas" (nada se mueve);
   - 320px de ancho (sin scroll horizontal);
   - claro y oscuro.
5. Cámara y AR: en un Android real (WebXR no se prueba en Playwright).
