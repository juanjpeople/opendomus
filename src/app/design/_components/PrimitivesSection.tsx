"use client";

import { Button, Card, Col, Flex, Row, Segmented, Typography } from "antd";
import { AnimatePresence } from "framer-motion";
import { Boxes, LayoutGrid, List, PackageOpen, Plus, QrCode, Refrigerator, RotateCcw, Shuffle, Trash2, Wrench } from "lucide-react";
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
  PrivacyBadge,
  PrivacySelect,
  PulseDot,
  QuantityStepper,
  RoomFloor,
  SectionHeader,
  StatTile,
  StockTag,
  VisualTile,
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
      title="Estructura: PageHeader y SectionHeader"
      description="Una página tiene un solo PageHeader (eyebrow, título, descripción, como mucho dos acciones; en páginas de detalle, leading con el IconTile de la entidad). Cada sección abre con SectionHeader, o con el title de su Card si la sección es una sola tarjeta (como en Recetas). Lo que nunca: mezclar los dos estilos, Title sueltos o <strong> como encabezado en la misma página."
      code={`
import { PageHeader, SectionHeader } from "@/components/ui";

<PageHeader eyebrow="Inventario" title="Alacena" description="..." extra={<Button type="primary" icon={<Plus />}>Agregar</Button>} />
<SectionHeader icon={Boxes} title="Productos" description="12 productos · 2 para reponer" extra={<Button>Ordenar</Button>} />
`}
    >
      <DemoLabel>PageHeader</DemoLabel>
      <PageHeader eyebrow="Inventario" title="Título de página" description="Descripción breve de la sección." extra={<Button type="primary" icon={<Plus />}>Acción</Button>} />
      <DemoLabel>PageHeader con leading (página de detalle)</DemoLabel>
      <PageHeader leading={<IconTile icon={Refrigerator} color="volcano" size={56} solid />} eyebrow="Cocina" title="Heladera" description="Heladera · Código H3LD" />

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

  return (
    <DemoBlock
      id="componentes-seleccion"
      title="Selección: ChoiceCards, ColorSwatches, IconGrid y privacidad"
      description="Para elegir una opción con explicación o vista previa, ChoiceCards (con teclado y un borde que se desliza). No armar grillas de radios a mano. Color e ícono de una entidad: ColorSwatches + IconGrid. Quién ve algo: PrivacySelect y PrivacyBadge."
      code={`
<ChoiceCards aria-label="Vista" value={view} onChange={setView} options={[
  { value: "grid", title: "Grilla", description: "...", preview: <LayoutGrid /> },
  { value: "list", title: "Lista", description: "...", preview: <List /> },
]} />
<ColorSwatches value={color} fallback="blue" onChange={setColor} />
<IconGrid value={icon} fallback="box" color={color ?? "blue"} onChange={setIcon} />
<PrivacySelect value={privacy} onChange={setPrivacy} />
<PrivacyBadge privacy="adults" />
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
      description="StatTile resume con una cifra que cuenta. ListRow es la fila estándar de una lista en Card (entra y sale deslizándose, el detalle se abre desde la izquierda con foco visible, los controles van a la derecha). Si una fila tiene ícono, todas lo tienen. Para navegar, usa href: conserva abrir en otra pestaña. Para un diálogo, onOpen. Las anotaciones usan wrapTitle para mostrar el texto completo y se editan en la misma fila (ver el flujo de almacenamiento)."
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
function SpacesBlock() {
  const [selected, setSelected] = useState("pantry");
  const [mode, setMode] = useState<"qr" | "find">("find");

  return (
    <DemoBlock
      id="componentes-espacios"
      title="Espacios: VisualTile, RoomFloor y CameraViewport"
      description="VisualTile es la ficha de una entidad con ilustración: sube, el borde toma su color y la ilustración se acerca. Como mucho tres líneas (título, una de contexto, un pie); el resto va al detalle. RoomFloor es el piso de un ambiente. ContainerScene conserva las proporciones del dibujo y toma escala, insignia y radios del tema; el CSS solo resuelve la geometría adaptable. CameraViewport es el único visor de cámara: fondo oscuro en ambos temas y todo animado con transform. useOverlayPalette resuelve los colores del tema para las tarjetas y el indicador de superficie del canvas de AR."
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

<CameraViewport videoRef={videoRef} active={active} frame
  detection={{ x: 0.5, y: 0.4, title: "Alacena", detail: "Yerba · Arroz", tone: "match" }} />
`}
    >
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
            { value: "find", label: "Mirar y encontrar" },
          ]}
        />
      </Flex>
      <div style={{ maxWidth: 520 }}>
        <CameraViewport
          frame={mode === "qr"}
          placeholder={<div style={{ width: "62%", transform: "scale(1.6)" }}><ContainerScene container={{ kind: "box", color: "gold" }} bare /></div>}
          detection={mode === "find" ? { x: 0.5, y: 0.32, title: "Caja de recuerdos", detail: "Fotos de viajes · Cables viejos", tone: "match" } : null}
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

