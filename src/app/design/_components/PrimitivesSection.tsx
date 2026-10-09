"use client";

import { Button, Card, Col, Flex, Row, Segmented, Typography, theme } from "antd";
import { AnimatePresence } from "framer-motion";
import { Archive, Box, Boxes, CookingPot, Hammer, LayoutGrid, LayoutList, List, MapPinned, PackageOpen, Plus, QrCode, Refrigerator, RotateCcw, Shuffle, SquareDashed, SwitchCamera, ToolCase, Trash2, Wrench } from "lucide-react";
import { useState } from "react";
import { Stagger, StaggerItem } from "@/components/motion";
import {
  CameraViewport,
  ChoiceCards,
  ColorSwatches,
  EmptyState,
  IconGrid,
  IconTile,
  ListRow,
  MemberAvatar,
  PageHeader,
  PathCrumbs,
  PlaceCard,
  PlaceChip,
  PrivacyBadge,
  PrivacySelect,
  PulseDot,
  QuantityStepper,
  RoomFloor,
  SectionHeader,
  StatTile,
  StockTag,
  ViewSwitcher,
  VisualTile,
  type CameraDetection,
  type FloorPattern,
} from "@/components/ui";
import { getStockStatus, isUnit } from "@/features/inventory/domain";
import { ContainerScene } from "@/features/storage/components/ContainerScene";
import { useT } from "@/i18n";
import { StockBar } from "@/features/storage/components/ContainerTiles";
import type { Privacy } from "@/lib/sync/scope";
import type { AppearanceColor, AppearanceIcon } from "@/lib/appearance";
import { DemoBlock, DemoLabel } from "./DemoBlock";

/** Estructura: cómo se encabeza una página y cada una de sus secciones. */
function StructureBlock() {
  return (
    <DemoBlock
      id="componentes-estructura"
      title="Estructura: PageHeader, SectionHeader y PathCrumbs"
      description="Una página tiene un solo PageHeader (eyebrow, título, descripción, como mucho dos acciones; en páginas de detalle, leading con el IconTile o la escena de la entidad). Cada sección abre con SectionHeader, o con el title de su Card si la sección es una sola tarjeta (como en Recetas). Lo que nunca: mezclar los dos estilos, Title sueltos o <strong> como encabezado en la misma página. En una página anidada (un recinto, un contenedor, un compartimento), PathCrumbs va en crumbs del PageHeader en lugar del eyebrow: cada tramo abre su página y mide 44 px, porque en celular las migas de la cabecera no se ven. La ruta se parte en líneas, nunca recorta un nombre."
      code={`
import { PageHeader, SectionHeader } from "@/components/ui";

<PageHeader eyebrow="Inventario" title="Alacena" description="..." extra={<Button type="primary" icon={<Plus />}>Agregar</Button>} />
<SectionHeader icon={Boxes} title="Productos" description="12 productos · 2 para reponer" extra={<Button>Ordenar</Button>} />

// Página anidada: la ruta tocable reemplaza al eyebrow.
<PageHeader
  crumbs={<PathCrumbs items={[{ label: "Inventario", href: "/inventario", icon: Boxes }, { label: "Taller", href: spaceHref(id) }, { label: "Estantería" }]} />}
  leading={<ContainerScene container={container} compact open />}
  title="Estantería"
/>
`}
    >
      <DemoLabel>PageHeader</DemoLabel>
      <PageHeader eyebrow="Inventario" title="Título de página" description="Descripción breve de la sección." extra={<Button type="primary" icon={<Plus />}>Acción</Button>} />
      <DemoLabel>PageHeader con leading (página de detalle)</DemoLabel>
      <PageHeader leading={<IconTile icon={Refrigerator} color="volcano" size={56} solid />} eyebrow="Cocina" title="Heladera" description="Heladera · Código H3LD" />

      <DemoLabel>PageHeader con crumbs (página anidada: tocá un tramo, en esta demo no navega)</DemoLabel>
      <div onClickCapture={(event) => { if ((event.target as Element).closest("a")) event.preventDefault(); }}>
        <PageHeader
          crumbs={<PathCrumbs items={[{ label: "Inventario", href: "/inventario", icon: Boxes }, { label: "Taller", href: "/inventario/lugar?id=taller", icon: Hammer }, { label: "Estantería de herramientas", href: "/inventario/ver?id=estanteria" }, { label: "Cajón de tornillos" }]} />}
          leading={<ContainerScene container={{ kind: "drawer", color: "gold" }} compact open />}
          title="Cajón de tornillos"
          description="Cajón · Código D4RT"
        />
      </div>

      <DemoLabel>SectionHeader (con y sin ícono)</DemoLabel>
      <SectionHeader icon={Boxes} title="Productos" description="12 productos · 2 para reponer" extra={<Button>Ordenar</Button>} />
      <SectionHeader title="Anotaciones" description="Lo que hay adentro sin contarlo" />
    </DemoBlock>
  );
}

/** Estados: vacío, vivo y de stock. */
function StatesBlock() {
  return (
    <DemoBlock
      id="componentes-estados"
      title="Estados: EmptyState, PulseDot y StockTag"
      description="EmptyState para 'todavía no hay nada' (siempre con una acción si se puede), PulseDot para algo que está pasando ahora y StockTag para el estado de un producto."
      code={`
<Card><EmptyState icon={PackageOpen} title="Todavía no hay productos" description="..." action={<Button type="primary">Agregar</Button>} /></Card>
<PulseDot tone="success" />   {/* success · warning · error · primary */}
<StockTag status={getStockStatus(item)} />
`}
    >
      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <DemoLabel>StockTag</DemoLabel>
          <Flex gap={8}>
            <StockTag status="ok" />
            <StockTag status="low" />
            <StockTag status="empty" />
          </Flex>
        </Col>
        <Col xs={24} md={12}>
          <DemoLabel>PulseDot</DemoLabel>
          <Flex gap={20} align="center">
            <PulseDot />
            <PulseDot tone="warning" />
            <PulseDot tone="error" />
            <PulseDot tone="primary" />
          </Flex>
        </Col>
        <Col xs={24}>
          <DemoLabel>EmptyState (dentro de una Card)</DemoLabel>
          <Card>
            <EmptyState
              icon={PackageOpen}
              title="Todavía no hay productos"
              description="Cargá el primero y OpenDomus te avisa cuando quede poco."
              action={
                <Button type="primary" icon={<Plus />}>
                  Agregar
                </Button>
              }
            />
          </Card>
        </Col>
      </Row>
    </DemoBlock>
  );
}

/** Selección: elegir entre opciones con vista previa, colores, íconos y privacidad. */
function SelectionBlock() {
  const [view, setView] = useState<"list" | "grid">("grid");
  const [color, setColor] = useState<AppearanceColor | undefined>();
  const [icon, setIcon] = useState<AppearanceIcon | undefined>();
  const [privacy, setPrivacy] = useState<Privacy>("family");
  const [rooms, setRooms] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(3);
  const [layout, setLayout] = useState<"places" | "plan" | "list" | "cards">("places");

  return (
    <DemoBlock
      id="componentes-seleccion"
      title="Selección: ChoiceCards, ViewSwitcher, ColorSwatches, IconGrid y privacidad"
      description="Para elegir una opción con explicación o vista previa, ChoiceCards (con teclado y un borde que se desliza). No armar grillas de radios a mano. Para cambiar cómo se ve una misma lista, ViewSwitcher: íconos con nombre (en celular, solo íconos; el nombre queda para lectores de pantalla), y la elección se guarda como preferencia del perfil. Color e ícono de una entidad: ColorSwatches + IconGrid. Quién ve algo: PrivacySelect y PrivacyBadge."
      code={`
<ChoiceCards aria-label="Vista" value={view} onChange={setView} options={[
  { value: "grid", title: "Grilla", description: "...", preview: <LayoutGrid /> },
  { value: "list", title: "Lista", description: "...", preview: <List /> },
]} />
<ColorSwatches value={color} fallback="blue" onChange={setColor} />
<IconGrid value={icon} fallback="box" color={color ?? "blue"} onChange={setIcon} />
<PrivacySelect value={privacy} onChange={setPrivacy} />
<PrivacyBadge privacy="adults" />
<ViewSwitcher label="Cómo ver tus lugares" value={inventoryView} options={options} onChange={(view) => setPreference("inventoryView", view)} />
PRIVACY_META.adults   // { icon, color }: para mostrar un nivel en otro formato (leyendas, filtros)
`}
    >
      <Row gutter={[24, 24]}>
        <Col xs={24}>
          <DemoLabel>ChoiceCards (probá con las flechas del teclado)</DemoLabel>
          <ChoiceCards
            aria-label="Vista"
            value={view}
            onChange={setView}
            options={[
              { value: "grid", title: "Grilla", description: "Fichas con ilustración, para mirar.", preview: <IconTile icon={LayoutGrid} size={40} /> },
              { value: "list", title: "Lista", description: "Filas compactas, para cargar rápido.", preview: <IconTile icon={List} size={40} /> },
            ]}
          />
        </Col>
        <Col xs={24}>
          <DemoLabel>ChoiceCards · selección múltiple, ícono o avatar, lista compacta y opción deshabilitada. Tab recorre las opciones; Espacio cambia la selección.</DemoLabel>
          <ChoiceCards multiple compact layout="list" aria-label="Ambientes de ejemplo" value={rooms} onChange={setRooms} options={[
            { value: "kitchen", title: "Cocina", leading: <IconTile icon={Refrigerator} /> },
            { value: "workshop", title: "Taller", leading: <IconTile icon={Wrench} color="gold" /> },
            { value: "later", title: "Disponible después", disabled: true, description: "Las opciones deshabilitadas no se eligen ni reciben foco." },
          ]} />
          <DemoLabel>ViewSwitcher (en Inventario se recuerda por perfil)</DemoLabel>
          <div style={{ marginBottom: 16 }}>
            <ViewSwitcher label="Vista de ejemplo" value={layout} onChange={setLayout} options={[
              { value: "places", label: "Lugares", icon: MapPinned },
              { value: "plan", label: "Plano", icon: SquareDashed },
              { value: "list", label: "Lista", icon: LayoutList },
              { value: "cards", label: "Tarjetas", icon: LayoutGrid },
            ]} />
          </div>
          <DemoLabel>QuantityStepper · edición directa, límites y botones. El campo conserva su nombre accesible.</DemoLabel>
          <QuantityStepper aria-label="Cantidad de ejemplo" value={quantity} onChange={setQuantity} min={0} max={10} precision={0} />
        </Col>
        <Col xs={24} md={12}>
          <DemoLabel>ColorSwatches</DemoLabel>
          <ColorSwatches value={color} fallback="blue" onChange={setColor} />
          <div style={{ height: 16 }} />
          <DemoLabel>IconGrid</DemoLabel>
          <IconGrid value={icon} fallback="box" color={color ?? "blue"} onChange={setIcon} />
        </Col>
        <Col xs={24} md={12}>
          <DemoLabel>PrivacySelect y PrivacyBadge</DemoLabel>
          <PrivacySelect value={privacy} onChange={setPrivacy} />
          <Flex gap={12} align="center" style={{ marginTop: 16 }}>
            <PrivacyBadge privacy="family" />
            <PrivacyBadge privacy="adults" />
            <PrivacyBadge privacy="private" />
          </Flex>
        </Col>
      </Row>
    </DemoBlock>
  );
}

const SAMPLE_ROWS = [
  { id: "1", name: "Yerba", quantity: 1, minThreshold: 2, unit: "kg", icon: Refrigerator, color: "green" as const },
  { id: "2", name: "Arroz largo fino", quantity: 4, minThreshold: 2, unit: "paquetes", icon: Boxes, color: "gold" as const },
  { id: "3", name: "Destornillador", quantity: 0, minThreshold: 1, unit: "unidades", icon: Wrench, color: "geekblue" as const },
];

/** Datos: cifras, cantidades, filas y personas. */
function DataBlock() {
  const [rows, setRows] = useState(SAMPLE_ROWS);
  const [stats, setStats] = useState({ products: 128, low: 3, notes: 14 });
  const t = useT();
  const unit = (value: string, count: number) => (isUnit(value) ? t(`inventory.units.${value}`, { count }) : value);
  const step = (id: string, delta: number) => setRows((current) => current.map((row) => (row.id === id ? { ...row, quantity: Math.max(0, row.quantity + delta) } : row)));

  return (
    <DemoBlock
      id="componentes-datos"
      title="Datos: StatTile, ListRow, QuantityStepper, IconTile y MemberAvatar"
      description="StatTile resume con una cifra que cuenta. ListRow es la fila estándar de una lista en Card (entra y sale deslizándose, el detalle se abre desde la izquierda con foco visible, los controles van a la derecha). Si una fila tiene ícono, todas lo tienen. Para navegar, usa href: conserva abrir en otra pestaña. Para un diálogo, onOpen. Las anotaciones usan wrapTitle para mostrar el texto completo y se editan en la misma fila (ver el flujo de almacenamiento). highlighted marca la fila a la que se llegó desde otra pantalla (una búsqueda, un aviso), con id para llevarla a la vista."
      code={`
<Stagger><Row gutter={[12, 12]}>
  <Col xs={8}><StaggerItem><StatTile label="Productos" value={128} tone="primary" /></StaggerItem></Col>
</Row></Stagger>

<Card styles={{ body: { padding: 0 } }}>
  <AnimatePresence>
    {items.map((item, index) => (
      <ListRow key={item.id} index={index}
        leading={<IconTile icon={Boxes} size={36} />}
        title={item.name}
        meta={<StockTag status={getStockStatus(item)} />}
        onOpen={() => open(item.id)} openLabel={\`Ver \${item.name}\`}
        trailing={<QuantityStepper value={item.quantity} unit={item.unit} onStep={(d) => adjust(item.id, d)} />}
      />
    ))}
  </AnimatePresence>
</Card>

<IconTile icon={Wrench} color="geekblue" />   {/* solid para destacado; size 36–64 */}
<MemberAvatar member={{ name: "Ana", color: "magenta" }} size={40} />
`}
    >
      <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
        <DemoLabel>StatTile</DemoLabel>
        <Button size="small" icon={<Shuffle />} onClick={() => setStats({ products: Math.round(Math.random() * 300), low: Math.round(Math.random() * 9), notes: Math.round(Math.random() * 40) })}>
          Cambiar cifras
        </Button>
      </Flex>
      <Stagger>
        <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
          <Col xs={8}>
            <StaggerItem style={{ height: "100%" }}>
              <StatTile label="Productos" value={stats.products} tone="primary" />
            </StaggerItem>
          </Col>
          <Col xs={8}>
            <StaggerItem style={{ height: "100%" }}>
              <StatTile label="Para reponer" value={stats.low} tone="warning" hint="Entran solos a la lista" />
            </StaggerItem>
          </Col>
          <Col xs={8}>
            <StaggerItem style={{ height: "100%" }}>
              <StatTile label="Anotaciones" value={stats.notes} />
            </StaggerItem>
          </Col>
        </Row>
      </Stagger>

      <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
        <DemoLabel>ListRow (borrá una fila para ver la salida)</DemoLabel>
        <Button size="small" icon={<RotateCcw />} disabled={rows === SAMPLE_ROWS} onClick={() => setRows(SAMPLE_ROWS)}>
          Restaurar
        </Button>
      </Flex>
      <Card styles={{ body: { padding: 0 } }} style={{ marginBottom: 24 }}>
        <AnimatePresence initial={false}>
          {rows.map((row, index) => (
            <ListRow
              key={row.id}
              index={index}
              divider={index < rows.length - 1}
              leading={<IconTile icon={row.icon} color={row.color} size={36} />}
              title={row.name}
              meta={
                <>
                  <StockTag status={getStockStatus(row)} />
                  <span>{t("inventory.list.min", { min: row.minThreshold, unit: unit(row.unit, row.minThreshold) })}</span>
                </>
              }
              onOpen={() => undefined}
              openLabel={`Ver ${row.name}`}
              trailing={
                <>
                  <QuantityStepper value={row.quantity} unit={unit(row.unit, row.quantity)} onStep={(delta) => step(row.id, delta)} />
                  <Button type="text" danger aria-label={`Borrar ${row.name}`} icon={<Trash2 />} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} />
                </>
              }
            />
          ))}
        </AnimatePresence>
      </Card>

      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <DemoLabel>IconTile (tintado · solid · tamaños)</DemoLabel>
          <Flex gap={12} align="center" wrap>
            <IconTile icon={Refrigerator} color="volcano" size={36} />
            <IconTile icon={Boxes} />
            <IconTile icon={Wrench} color="geekblue" solid />
            <IconTile icon={QrCode} color="purple" size={64} />
          </Flex>
        </Col>
        <Col xs={24} md={12}>
          <DemoLabel>MemberAvatar</DemoLabel>
          <Flex gap={12} align="center">
            <MemberAvatar member={{ name: "Ana", color: "magenta" }} size={40} />
            <MemberAvatar member={{ name: "Beto", color: "cyan" }} size={40} />
            <MemberAvatar member={{ name: "Cami", color: "gold", emoji: "🦊" }} size={40} />
          </Flex>
        </Col>
      </Row>
    </DemoBlock>
  );
}

const FLOORS: { pattern: FloorPattern; label: string; color: AppearanceColor }[] = [
  { pattern: "tiles", label: "tiles · cocina, baño", color: "volcano" },
  { pattern: "boards", label: "boards · dormitorio, living", color: "purple" },
  { pattern: "diagonal", label: "diagonal · jardín", color: "green" },
  { pattern: "dots", label: "dots · el resto", color: "geekblue" },
];

/** Espacios: fichas, pisos y el visor de cámara. */
const BUBBLES: CameraDetection[] = [
  { id: "K7QM", x: 0.28, y: 0.3, title: "Caja de cables", detail: "3 coincidencias", tone: "match" },
  { id: "S7NT", x: 0.7, y: 0.36, title: "Caja de pintura", detail: "Sin coincidencias", tone: "dim" },
  { id: "X2ZZ", x: 0.5, y: 0.72, title: "Etiqueta desconocida", tone: "unknown" },
];

function SpacesBlock() {
  const { token } = theme.useToken();
  const [selected, setSelected] = useState("pantry");
  const [mode, setMode] = useState<"qr" | "find">("find");
  const [scene, setScene] = useState(0);
  const [zoom, setZoom] = useState(1);

  return (
    <DemoBlock
      id="componentes-espacios"
      title="Espacios: PlaceCard, PlaceChip, VisualTile, RoomFloor, ContainerScene y CameraViewport"
      description="PlaceCard es un lugar de la casa con su mini plano: el encabezado abre el lugar y cada mueble del plano abre ese mueble (44 px, con punto de alerta si hay algo para reponer); lo que no entra se resume en +N. VisualTile es la ficha de una entidad con ilustración: sube, el borde toma su color y la ilustración se acerca. Como mucho tres partes (título de hasta dos líneas, una de contexto, un pie); el resto va al detalle. RoomFloor es el piso de un ambiente. ContainerScene conserva las proporciones del dibujo y toma escala, insignia y radios del tema; con open, la tapa, el cajón o la manija se mueve y asoma lo de adentro (solo transform: reducir movimiento lo frena). CameraViewport es el único visor de cámara: fondo oscuro en ambos temas, una burbuja por etiqueta (coincide, atenuada o desconocida, tocable) y controles de zoom y lente abajo. useOverlayPalette resuelve los colores del tema para las tarjetas y el indicador de superficie del canvas de AR."
      code={`
<RoomFloor pattern="tiles" color="volcano">
  <VisualTile
    href={containerHref(container.id)}
    color="volcano"
    media={<ContainerScene container={container} />}
    title={container.name}
    meta="12 productos"
    footer={<StockBar ok={9} low={2} empty={1} />}
    action={{ icon: <QrCode />, label: "Etiqueta", onClick: printLabel }}
  />
</RoomFloor>

<PlaceCard href={spaceHref(space.id)} title="Taller" icon={Hammer} color="volcano" floor="dots"
  meta="6 contenedores · 17 productos"
  shortcuts={[{ key: id, href: containerHref(id), name: "Caja de herramientas", label: "Caja de herramientas · 2 para reponer", icon: ToolCase, color: "volcano", alert: true }]}
  more={{ count: 2, label: "2 contenedores más en Taller" }}
  status={{ tone: "warning", text: "2 para reponer" }} />

<ContainerScene container={container} compact open />   {/* la escena de la página del contenedor */}

<CameraViewport videoRef={videoRef} active={active}
  detections={seen.map((label) => ({ id: label.code, x: label.x, y: label.y, title: label.name, detail: "3 coincidencias", tone: "match", onSelect: () => open(label), label: "Abrir " + label.name }))}
  controls={<Segmented options={["1×", "2×", "3×"]} />} />
`}
    >
      <DemoLabel>PlaceChip: acceso compacto a un producto para reponer o a un lugar reciente. El nombre y el contexto se ajustan al ancho; el título completa el estado.</DemoLabel>
      <div onClickCapture={(event) => { if ((event.target as Element).closest("a")) event.preventDefault(); }}>
        <Flex wrap gap={token.marginXS} style={{ marginBottom: token.marginLG }}>
          <PlaceChip href="#" label="Yerba" detail="Alacena" dot={token.colorWarning} title="Poco · Cocina › Alacena" ariaLabel="Abrir Yerba en Cocina › Alacena" />
          <PlaceChip href="#" label="Leche" detail="Heladera" dot={token.colorError} title="Agotado · Cocina › Heladera" ariaLabel="Abrir Leche en Cocina › Heladera" />
          <PlaceChip href="#" label="Caja de herramientas" detail="Taller" icon={ToolCase} color="volcano" />
        </Flex>
      </div>
      <DemoLabel>PlaceCard (el inicio de Inventario en la vista Lugares; acá no navega)</DemoLabel>
      <div onClickCapture={(event) => { if ((event.target as Element).closest("a")) event.preventDefault(); }} style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <PlaceCard href="#" title="Taller" icon={Hammer} color="volcano" floor="dots" meta="8 contenedores · 17 productos"
              shortcuts={[
                { key: "toolbox", href: "#", name: "Caja de herramientas", label: "Caja de herramientas · 2 para reponer", icon: ToolCase, color: "volcano", alert: true },
                { key: "shelf", href: "#", name: "Estantería", label: "Estantería", icon: Archive, color: "purple" },
                { key: "box", href: "#", name: "Caja de cables", label: "Caja de cables", icon: Box, color: "gold" },
              ]}
              more={{ count: 5, label: "5 contenedores más en Taller" }}
              status={{ tone: "warning", text: "2 para reponer" }} />
          </Col>
          <Col xs={24} md={12}>
            <PlaceCard href="#" title="Cocina" icon={CookingPot} color="orange" floor="tiles" meta="3 contenedores · 22 productos"
              shortcuts={[
                { key: "fridge", href: "#", name: "Heladera", label: "Heladera", icon: Refrigerator, color: "cyan" },
                { key: "pantry", href: "#", name: "Alacena", label: "Alacena", icon: Archive, color: "orange" },
              ]}
              status={{ tone: "success", text: "Todo en orden" }} />
          </Col>
        </Row>
      </div>

      <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 8 }}>
        <DemoLabel>ContainerScene con open (la escena de la página del contenedor)</DemoLabel>
        <Button size="small" icon={<RotateCcw />} onClick={() => setScene((current) => current + 1)}>Abrir de nuevo</Button>
      </Flex>
      <Flex gap={16} wrap style={{ marginBottom: 24 }}>
        {(["box", "drawer", "toolbox", "freezer", "basket", "shelf"] as const).map((kind) => (
          <ContainerScene key={kind + "-" + scene} container={{ kind, color: "gold" }} compact open />
        ))}
      </Flex>

      <DemoLabel>VisualTile sobre RoomFloor (navega · elegible · con acción)</DemoLabel>
      <div style={{ marginBottom: 24 }}>
        <RoomFloor pattern="tiles" color="volcano" minTileWidth={150}>
          <VisualTile
            color="volcano"
            media={<ContainerScene container={{ kind: "fridge", color: "volcano" }} />}
            title="Heladera"
            meta="18 productos"
            footer={<StockBar ok={15} low={2} empty={1} />}
            onClick={() => setSelected("fridge")}
            selected={selected === "fridge"}
            action={{ icon: <QrCode />, label: "Imprimir etiqueta de Heladera", onClick: () => undefined }}
          />
          <VisualTile
            color="gold"
            media={<ContainerScene container={{ kind: "pantry", color: "gold" }} />}
            title="Alacena"
            meta="12 productos"
            footer={<StockBar ok={9} low={2} empty={1} />}
            onClick={() => setSelected("pantry")}
            selected={selected === "pantry"}
            action={{ icon: <QrCode />, label: "Imprimir etiqueta de Alacena", onClick: () => undefined }}
          />
          <VisualTile color="cyan" media={<ContainerScene container={{ kind: "drawer", color: "cyan" }} />} title="Cajón de cubiertos" meta="Cajón · vacío" />
        </RoomFloor>
      </div>

      <DemoLabel>RoomFloor: un patrón por tipo de ambiente</DemoLabel>
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        {FLOORS.map(({ pattern, label, color }) => (
          <Col key={pattern} xs={12} md={6}>
            <RoomFloor pattern={pattern} color={color}>
              <div style={{ height: 72 }} />
            </RoomFloor>
            <Typography.Text type="secondary" style={{ display: "block", marginTop: 6 }}>
              {label}
            </Typography.Text>
          </Col>
        ))}
      </Row>

      <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 8 }}>
        <DemoLabel>CameraViewport (vista previa, sin pedir la cámara)</DemoLabel>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "qr", label: "Escanear QR" },
            { value: "find", label: "Buscar" },
          ]}
        />
      </Flex>
      <div style={{ maxWidth: 520 }}>
        <CameraViewport
          frame={mode === "qr"}
          placeholder={<div style={{ width: "62%", transform: "scale(1.6)" }}><ContainerScene container={{ kind: "shelf", color: "gold" }} bare /></div>}
          detections={mode === "find" ? BUBBLES : []}
          controls={mode === "find" ? (
            <Flex align="center" gap={4}>
              <Segmented<number> aria-label="Zoom" value={zoom} onChange={setZoom} options={[1, 2, 3].map((value) => ({ value, label: value + "×" }))} />
              <Button type="text" icon={<SwitchCamera />} aria-label="Cambiar de lente" />
            </Flex>
          ) : undefined}
        />
      </div>
    </DemoBlock>
  );
}

export function PrimitivesSection() {
  return (
    <>
      <StructureBlock />
      <StatesBlock />
      <SelectionBlock />
      <DataBlock />
      <SpacesBlock />
    </>
  );
}

