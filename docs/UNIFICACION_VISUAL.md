# Unificación visual

Plan para que toda la app se vea, se mueva y hable como la versión original de OpenDomus.
Está pensado para que lo pueda seguir cualquier persona o agente, una fase por PR.

**La referencia es `/design`.** Usa el código real, y ahí están la firma visual, los tokens de
movimiento, las piezas compartidas y dos flujos completos:
- **Recetas:** tal como se ve hoy, la referencia de calidad.
- **Almacenamiento:** el objetivo; falta migrar las pantallas reales.

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
  - una pieza de `components/ui` o `components/motion` sin documentar en `/design`.

  La deuda que ya existe está anotada en `DEBT`, con un número por archivo. Al arreglar un archivo, ese número baja (y la prueba avisa cuando se puede bajar). Nunca sube.
- **AGENTS.md**, sección "Sistema visual".
- **`/design` → Calidad → "Revisión antes de un PR"**: la lista para repasar.

## Fases

Cada fase es un PR. Antes de empezar una, recorré `/design` y el flujo correspondiente.

### Fase 0: Línea de base y barandas ✅ (parcial)
- [x] `design-lint` con deuda registrada.
- [x] Sección "Sistema visual" en AGENTS.md.
- [ ] `e2e/visual-tour.spec.ts`. Usa la build demo (`playwright.demo.config.ts`, escritorio + Pixel 7) y saca capturas en claro y oscuro de:
  - `/design` (una por sección);
  - landing, `/empezar`, `/cuenta`, `/unirme`;
  - tablero, `/inventario`, un contenedor y la cámara;
  - `/compras`, `/recetas`, `/ajustes`, `/feedback`.

  Seguí el patrón de capturas de `e2e/container-contents.spec.ts` (`animations: "disabled"`). Sirve de "antes" para comparar cada fase.

### Fase 1: `/design` como estándar ✅ (parcial)
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
- [ ] Piezas para los flujos de entrada. Cada una va con su `DemoBlock` y un flujo "Alta de cuenta" en `/design`:

  | Pieza | Qué es | Reemplaza |
  |---|---|---|
  | `PanelHeader` | IconTile + título h3 + subtítulo + extra | ~10 copias en cloud, feedback y operador |
  | `Callout` | Tonos neutral, primary, warning y danger, con IconTile | Muros de `Alert`, "dónde viven tus datos", nota de seguridad, DemoNotice |
  | `StepFlow` | Encabezado, progreso, `AnimatePresence mode="wait"` con `DURATION.base`/`EASE_OUT`, ancho estable, pie con volver + primario | Los pasos de AccountPage, JoinPage y HouseSetup |
  | `ResultState` | Hermano de EmptyState para "listo" | Finales de AccountPage y JoinPage |
  | `TrustNote` | Nota de cifrado | AccountPage, AuthForm, JoinPage |
  | `ChoiceCards` v2 | Modo lista, ranura de ícono o avatar, multi-selección, compacto | KindPicker, el ChoiceCard de Onboarding, ChooseProfile, los radios de HouseSetup y LeaveCloud |
  | `SettingRow` | Se mueve a `components/ui` | Ya la usa cloud |

  Utilidades:
  - `formatQuantity(t, qty, unit)`, que reemplaza cinco copias;
  - `useOverlayPalette()`, que pasa tokens a hex para el canvas del AR (`storage/spatial/renderer.ts`).

### Fase 2: Almacenamiento e inventario (prioridad)
Seguí el flujo "Almacenamiento" de `/design`, que usa las mismas piezas.

**Plano de la casa**
- [ ] **StoragePage:**
  - un solo botón de cámara en la cabecera;
  - buscador en `Reveal`, oculto si no hay recintos;
  - ambientes con `RoomFloor`.
- [ ] **ContainerTiles:** pasa a `VisualTile`, con tres líneas como mucho (título, tipo · cantidad, barra de stock). Se borran las reglas de hover de `storage.module.css`.
- [ ] **StorageSearch:** resultados en `ListRow` con el término resaltado, `EmptyState` y código en mono.

**Página de un contenedor**
- [ ] **ContainerPage:**
  - `PageHeader leading` con el IconTile del contenedor;
  - dos acciones visibles y el resto en ⋯;
  - `StatTile` × 3;
  - un `SectionHeader` por sección;
  - orden: productos → compartimentos → anotaciones, en cascada.
- [ ] **ContainerContents:** `ListRow` + input en línea (sin Modal para editar una línea); corregir la clave `nameRequired`.
- [ ] **InventoryList:** pasa a `ListRow` (vuelve el foco visible), con la columna de ícono siempre presente y un respaldo genérico.
- [ ] **InventoryForm:** título de Card y el botón principal al final.

**Formularios y catálogo**
- [ ] **StorageForms:** `KindPicker` → `ChoiceCards` v2; una sola vista previa.
- [ ] **CatalogPicker:**
  - categorías como chips de color;
  - entradas con `VisualTile`;
  - precio de referencia en un popover;
  - aviso al elegir.

**Cámara y AR**
- [ ] **Cámara:**
  - `ScanPage` y `CameraInventory` → una pantalla con `CameraViewport` y `Segmented` de modos (Escanear QR · Mirar y encontrar · AR);
  - un solo `useCameraScanner`;
  - `StockTag` en vez del mapeo a mano;
  - la ruta `/inventario/escanear` sigue funcionando y abre el modo QR.
- [ ] **AR:** `SpatialPanel` y `renderer.ts` con colores de tokens (el `<select>` nativo se queda, porque WebXR lo necesita).
- [ ] **`storage.module.css`:** queda solo lo que no se puede expresar con tokens.
- [ ] **Táctiles a 44px:** QR de las fichas y `ConsumeButton`.

### Fase 3: Flujos de entrada y cuenta
- [ ] **Onboarding:**
  - las tres opciones primero;
  - demo y cuentas debajo, con `Reveal`;
  - el paso a HouseSetup con `StepFlow`.
- [ ] **HouseSetup:**
  - todo por `t()` (claves `houseSetup.*`);
  - `StepFlow`;
  - `ChoiceCards` v2 con íconos;
  - `QuantityStepper`;
  - un `Callout` en lugar de tres descargos.
- [ ] **AccountPage y JoinPage:** `StepFlow` con ancho estable, `PanelHeader`, `ResultState` y `TrustNote`.
- [ ] **SocialAccess:**
  - logos de proveedor en SVG inline y divisor "o";
  - un `Callout`;
  - `Link` en vez de `<a>`;
  - dentro de un `SettingRow`.
- [ ] **Cloud:** se sacan los `size={n}` de los íconos y se baja `DEBT`.
- [ ] **FeedbackPage y LocalOnlyPage:**
  - `Reveal` y `PanelHeader`;
  - carga en el envío;
  - mensajes de validación en voseo.

### Fase 4: Inserciones sobre pantallas originales
- [ ] **Demo:**
  - `DemoNotice` deja de ser un `Alert` en cada página: pasa a ser un indicador en la cabecera, como `DataModeBadge`, con un popover de acciones;
  - un solo `DemoLauncher` en forma de tarjeta.
- [ ] **Landing:**
  - `ProjectIntroduction`, `ProjectStats`, `AccountLinks` y `DemoLauncher` usan `SectionTitle`, eyebrow, `clamp` y cascada;
  - las cifras usan `StatTile`.
- [ ] **ReferencePrice:**
  - por `t()`;
  - fecha con `format.date`;
  - enlace con ícono;
  - `Callout` compacto debajo de los precios.
- [ ] **Calendario escolar** (CalendarOptions, EventModal, SchoolToday): todo por `t()`. Hoy suma 36 textos por idioma.
- [ ] **Retoques:**
  - el 🎂 de Members pasa a lucide;
  - el `<style>` de PrivacyPage pasa a hover con framer;
  - el `#fff` del QR pasa a `token.colorWhite`.

### Fase 5: Panel de operador
- [ ] **Tema compartido:** `ThemeProvider` exporta un constructor de tema y `operator/main.tsx` lo usa con `DEFAULT_PREFERENCES`.
- [ ] **CSS en el bundle:** `scripts/build-operator.mjs` empaqueta un CSS mínimo con `.lucide`, la fuente y el fondo que sigue al modo oscuro.
- [ ] **Datos en pantalla:**
  - todo por i18n;
  - enums con etiquetas legibles;
  - fechas con locale;
  - el riesgo en `Descriptions`, no en JSON.
- [ ] **Cabecera:** `HouseMark` + "OpenDomus" + Tag "Operador".

### Fase 6: Voz
- [ ] **Revisión de `es.ts`/`en.ts`** con "Voz y textos" de `/design`:
  - plurales en `storage.contents.summary`;
  - `camera.*` y `spatial.*` reescritos;
  - un solo nombre para la cámara;
  - `social.*` y `demo.*` en una oración;
  - un solo `nameRequired`.
- [ ] **Pasada final por `/design`:** cada patrón nuevo queda en Flujos y el flujo de almacenamiento pasa a "adoptado".

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
