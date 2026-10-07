"use client";

import { App, Button, Card, Col, Dropdown, Flex, Input, Popconfirm, Row, Segmented, Space, Tooltip, Typography, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { Box, Boxes, Camera, EllipsisVertical, ExternalLink, Layers, NotebookPen, PackageOpen, Pencil, Plus, Printer, QrCode, ScanLine, Search, SearchX, Trash2 } from "lucide-react";
import { useState } from "react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { CameraViewport, EmptyState, IconTile, ListRow, PageHeader, QuantityStepper, RoomFloor, SectionHeader, StatTile, StockTag, VisualTile, type FloorPattern } from "@/components/ui";
import type { CatalogCategory } from "@/features/inventory/catalog";
import { CATEGORY_APPEARANCE } from "@/features/inventory/catalog-appearance";
import { getStockStatus, isUnit } from "@/features/inventory/domain";
import { ContainerScene } from "@/features/storage/components/ContainerScene";
import { AddTile, StockBar } from "@/features/storage/components/ContainerTiles";
import { containerAppearance, spaceAppearance, type ContainerKind, type SpaceKind } from "@/features/storage/domain";
import { useT } from "@/i18n";
import { tint } from "@/lib/appearance";
import { SPRING } from "@/lib/motion";
import { containerHref } from "@/lib/navigation/routes";
import { DemoBlock, NoNavigate } from "./DemoBlock";
import { FlowFrame } from "./FlowFrame";

// ── Casa de ejemplo (solo en memoria: nada de esto toca la base) ─────────────────────────────

interface DemoItem {
  id: string;
  name: string;
  quantity: number;
  minThreshold: number;
  unit: string;
  category: CatalogCategory;
}

interface DemoContainer {
  id: string;
  name: string;
  kind: ContainerKind;
  code: string;
  items: DemoItem[];
  notes: string[];
  children?: DemoContainer[];
}

interface DemoSpace {
  id: string;
  name: string;
  kind: SpaceKind;
  containers: DemoContainer[];
}

const HOUSE: DemoSpace[] = [
  {
    id: "cocina",
    name: "Cocina",
    kind: "kitchen",
    containers: [
      {
        id: "heladera",
        name: "Heladera",
        kind: "fridge",
        code: "H3LD",
        notes: [],
        items: [
          { id: "leche", name: "Leche", quantity: 2, minThreshold: 2, unit: "litros", category: "food" },
          { id: "manteca", name: "Manteca", quantity: 0, minThreshold: 1, unit: "unidades", category: "food" },
          { id: "huevos", name: "Huevos", quantity: 6, minThreshold: 6, unit: "unidades", category: "food" },
        ],
      },
      {
        id: "alacena",
        name: "Alacena",
        kind: "pantry",
        code: "K7QM",
        notes: ["Bolsas de tela para el súper", "Moldes de budín"],
        items: [
          { id: "yerba", name: "Yerba", quantity: 1, minThreshold: 2, unit: "kg", category: "food" },
          { id: "arroz", name: "Arroz largo fino", quantity: 4, minThreshold: 2, unit: "paquetes", category: "food" },
          { id: "aceite", name: "Aceite de girasol", quantity: 0, minThreshold: 1, unit: "litros", category: "food" },
          { id: "detergente", name: "Detergente", quantity: 2, minThreshold: 1, unit: "unidades", category: "cleaning" },
        ],
        children: [
          {
            id: "estante",
            name: "Estante de arriba",
            kind: "compartment",
            code: "E5TA",
            notes: [],
            items: [{ id: "harina", name: "Harina 0000", quantity: 2, minThreshold: 1, unit: "kg", category: "food" }],
          },
          { id: "canasto", name: "Canasto de papas", kind: "basket", code: "C4NP", notes: ["Papas y cebollas"], items: [] },
        ],
      },
      { id: "cubiertos", name: "Cajón de cubiertos", kind: "drawer", code: "C8BT", notes: ["Cubiertos de fiesta"], items: [] },
    ],
  },
  {
    id: "taller",
    name: "Taller",
    kind: "workshop",
    containers: [
      {
        id: "herramientas",
        name: "Caja de herramientas",
        kind: "toolbox",
        code: "TR4X",
        notes: [],
        items: [
          { id: "destornillador", name: "Destornillador Phillips", quantity: 2, minThreshold: 1, unit: "unidades", category: "tools" },
          { id: "cinta", name: "Cinta aisladora", quantity: 0, minThreshold: 1, unit: "unidades", category: "electrical" },
        ],
      },
      {
        id: "estanteria",
        name: "Estantería",
        kind: "shelf",
        code: "S7NT",
        notes: ["Cables viejos", "Piezas de la impresora"],
        items: [{ id: "tornillos", name: "Tornillos 6 mm", quantity: 40, minThreshold: 10, unit: "unidades", category: "hardware" }],
      },
    ],
  },
];

const FLOOR: Record<SpaceKind, FloorPattern> = {
  kitchen: "tiles",
  bathroom: "tiles",
  bedroom: "boards",
  living: "boards",
  garden: "diagonal",
  workshop: "dots",
  shed: "dots",
  garage: "dots",
  other: "dots",
};

const ALL = HOUSE.flatMap((space) => space.containers.flatMap((container) => [container, ...(container.children ?? [])].map((entry) => ({ space, container: entry }))));
const find = (id: string) => ALL.find((entry) => entry.container.id === id) ?? ALL[1];

/** Totales del contenedor y de sus compartimentos. */
function stats(container: DemoContainer) {
  const items = [container, ...(container.children ?? [])].flatMap((entry) => entry.items);
  const low = items.filter((item) => getStockStatus(item) === "low").length;
  const empty = items.filter((item) => getStockStatus(item) === "empty").length;
  return { total: items.length, low, empty, ok: items.length - low - empty };
}

/** Minúsculas y sin tildes, con el mismo largo que el original (para resaltar en el lugar justo). */
const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function Highlight({ text, query }: { text: string; query: string }) {
  const at = normalize(text).indexOf(normalize(query));
  if (!query || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <Typography.Text mark>{text.slice(at, at + query.length)}</Typography.Text>
      {text.slice(at + query.length)}
    </>
  );
}

const idFromHref = (href: string) => new URLSearchParams(href.split("?")[1] ?? "").get("id") ?? "";

// ── Pantallas ────────────────────────────────────────────────────────────────────────────────

function ContainerTileDemo({ container }: { container: DemoContainer }) {
  const t = useT();
  const { message } = App.useApp();
  const { color } = containerAppearance(container);
  const total = stats(container);
  // El tipo solo suma si el nombre no lo dice ya ("Heladera" no necesita "Heladera · …").
  const kind = t(`storage.containerKinds.${container.kind}`);
  const meta = [normalize(container.name).includes(normalize(kind)) ? null : kind, total.total > 0 ? t("storage.itemCount", { count: total.total }) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <VisualTile
      href={containerHref(container.id)}
      color={color}
      media={<ContainerScene container={container} />}
      title={container.name}
      meta={meta || undefined}
      footer={total.total > 0 ? <StockBar ok={total.ok} low={total.low} empty={total.empty} /> : undefined}
      action={{ icon: <QrCode />, label: `${t("storage.label")}: ${container.name}`, onClick: () => message.info(`Acá se imprime la etiqueta de ${container.name}`) }}
    />
  );
}

function RoomPanel({ space, onOpen }: { space: DemoSpace; onOpen: (id: string) => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const { color, Icon } = spaceAppearance(space);
  const palette = tint(token, color);
  const itemCount = space.containers.reduce((sum, container) => sum + stats(container).total, 0);

  return (
    <section
      style={{
        padding: 16,
        borderRadius: token.borderRadiusLG * 2,
        border: `1px solid ${palette.border}`,
        background: `linear-gradient(160deg, ${palette.bg} 0%, ${token.colorBgContainer} 55%)`,
        boxShadow: token.boxShadowTertiary,
      }}
    >
      <Flex align="center" justify="space-between" gap={12} style={{ marginBottom: 14 }}>
        <Flex align="center" gap={12} style={{ minWidth: 0 }}>
          <IconTile icon={Icon} color={color} size={44} solid />
          <div style={{ minWidth: 0 }}>
            <Typography.Title level={4} style={{ margin: 0, letterSpacing: "-0.02em" }} ellipsis>
              {space.name}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {t("storage.containerCount", { count: space.containers.length })} · {t("storage.itemCount", { count: itemCount })}
            </Typography.Text>
          </div>
        </Flex>
        <Flex gap={4} style={{ flexShrink: 0 }}>
          <Tooltip title={t("storage.printLabels")}>
            <Button type="text" icon={<Printer />} aria-label={t("storage.printLabels")} style={{ width: 44, height: 44 }} />
          </Tooltip>
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                { key: "add", icon: <Plus />, label: t("storage.addContainer") },
                { key: "edit", icon: <Pencil />, label: t("storage.edit") },
                { type: "divider" },
                { key: "delete", danger: true, icon: <Trash2 />, label: t("storage.delete") },
              ],
            }}
          >
            <Button type="text" icon={<EllipsisVertical />} aria-label={t("storage.edit")} style={{ width: 44, height: 44 }} />
          </Dropdown>
        </Flex>
      </Flex>
      <NoNavigate onLink={(href) => onOpen(idFromHref(href))}>
        <RoomFloor pattern={FLOOR[space.kind]} color={color}>
          {space.containers.map((container) => (
            <ContainerTileDemo key={container.id} container={container} />
          ))}
          <AddTile color={palette.solid} label={t("storage.addContainer")} onClick={() => undefined} />
        </RoomFloor>
      </NoNavigate>
    </section>
  );
}

function SearchResults({ query, onOpen }: { query: string; onOpen: (id: string) => void }) {
  const { token } = theme.useToken();
  const words = normalize(query.trim());
  const results = ALL.flatMap(({ space, container }) => {
    const path = `${space.name} › ${container.name}`;
    const hits = [container.name, ...container.items.map((item) => item.name), ...container.notes].filter((text) => normalize(text).includes(words));
    return hits.map((text) => ({ key: `${container.id}:${text}`, text, path, container }));
  });

  if (results.length === 0) {
    return (
      <Card>
        <EmptyState icon={SearchX} title={`No encontramos “${query}”`} description="Probá con otra palabra o con el código de la etiqueta." />
      </Card>
    );
  }

  return (
    <Card styles={{ body: { padding: 0 } }}>
      <AnimatePresence initial={false}>
        {results.map((result, index) => {
          const { color, Icon } = containerAppearance(result.container);
          return (
            <ListRow
              key={result.key}
              index={index}
              divider={index < results.length - 1}
              leading={<IconTile icon={Icon} color={color} size={36} />}
              title={<Highlight text={result.text} query={query.trim()} />}
              meta={
                <>
                  <span>{result.path}</span>
                  <span style={{ fontFamily: "var(--font-geist-mono)", letterSpacing: "0.08em", color: token.colorTextTertiary }}>{result.container.code}</span>
                </>
              }
              onOpen={() => onOpen(result.container.id)}
              openLabel={`Abrir ${result.container.name}`}
            />
          );
        })}
      </AnimatePresence>
    </Card>
  );
}

function PlanScreen({ onOpen, onCamera }: { onOpen: (id: string) => void; onCamera: () => void }) {
  const t = useT();
  const [query, setQuery] = useState("");

  return (
    <>
      <PageHeader
        eyebrow={t("storage.eyebrow")}
        title={t("storage.title")}
        description={t("storage.description")}
        extra={
          <>
            <Button icon={<Camera />} onClick={onCamera}>
              Cámara
            </Button>
            <Button type="primary" icon={<Plus />}>
              {t("storage.addSpace")}
            </Button>
          </>
        }
      />
      <Reveal delay={0.05}>
        <Input
          size="large"
          allowClear
          prefix={<Search />}
          placeholder={t("storage.search.placeholder")}
          aria-label={t("storage.search.placeholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ maxWidth: 440, marginBottom: 24 }}
        />
      </Reveal>
      {query.trim() ? (
        <SearchResults query={query} onOpen={onOpen} />
      ) : (
        <Stagger delay={0.1} stagger={0.08} style={{ columnWidth: 400, columnGap: 20 }}>
          {HOUSE.map((space) => (
            <StaggerItem key={space.id} style={{ breakInside: "avoid", marginBottom: 20 }}>
              <RoomPanel space={space} onOpen={onOpen} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </>
  );
}

function ContainerScreen({ id, onOpen, onCamera }: { id: string; onOpen: (id: string) => void; onCamera: () => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { space, container } = find(id);
  const { color, Icon } = containerAppearance(container);
  const [items, setItems] = useState(container.items);
  const [notes, setNotes] = useState(container.notes.map((text, index) => ({ id: `${container.id}-${index}`, text })));
  const [draft, setDraft] = useState("");
  const unit = (value: string, count: number) => (isUnit(value) ? t(`inventory.units.${value}`, { count }) : value);
  const toRestock = items.filter((item) => getStockStatus(item) !== "ok").length;
  const children = container.children ?? [];

  const adjust = (itemId: string, delta: number) => setItems((current) => current.map((item) => (item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item)));
  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    setNotes((current) => [...current, { id: `${Date.now()}`, text }]);
    setDraft("");
  };

  return (
    <>
      <PageHeader
        leading={<IconTile icon={Icon} color={color} size={56} solid />}
        eyebrow={space.name}
        title={container.name}
        description={
          <>
            {t(`storage.containerKinds.${container.kind}`)} · {t("storage.code")}{" "}
            <span style={{ fontFamily: "var(--font-geist-mono)", letterSpacing: "0.08em" }}>{container.code}</span>
          </>
        }
        extra={
          <>
            <Button icon={<Camera />} onClick={onCamera}>
              Cámara
            </Button>
            <Button type="primary" icon={<Plus />}>
              {t("inventory.form.title")}
            </Button>
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  { key: "label", icon: <QrCode />, label: t("storage.label") },
                  { key: "edit", icon: <Pencil />, label: t("storage.editContainer") },
                  { type: "divider" },
                  { key: "delete", danger: true, icon: <Trash2 />, label: t("storage.delete") },
                ],
              }}
            >
              <Button icon={<EllipsisVertical />} aria-label="Más acciones" />
            </Dropdown>
          </>
        }
      />

      <Stagger delay={0.05}>
        <Row gutter={[12, 12]} style={{ marginBottom: 32 }}>
          <Col xs={8}>
            <StaggerItem style={{ height: "100%" }}>
              <StatTile label="Productos" value={items.length} tone="primary" />
            </StaggerItem>
          </Col>
          <Col xs={8}>
            <StaggerItem style={{ height: "100%" }}>
              <StatTile label="Para reponer" value={toRestock} tone={toRestock > 0 ? "warning" : "success"} />
            </StaggerItem>
          </Col>
          <Col xs={8}>
            <StaggerItem style={{ height: "100%" }}>
              <StatTile label="Anotaciones" value={notes.length} />
            </StaggerItem>
          </Col>
        </Row>
      </Stagger>

      <Reveal delay={0.1} style={{ marginBottom: 32 }}>
        <SectionHeader icon={Boxes} title={t("storage.contents.inventory")} description={t("storage.itemCount", { count: items.length })} />
        <Card styles={{ body: { padding: 0 } }}>
          {items.length === 0 && <EmptyState icon={PackageOpen} title={t("inventory.list.emptyTitle")} description="Cargá lo que tenga cantidad: así te avisa cuando quede poco." />}
          <AnimatePresence initial={false}>
            {items.map((item, index) => {
              const appearance = CATEGORY_APPEARANCE[item.category];
              return (
                <ListRow
                  key={item.id}
                  index={index}
                  divider={index < items.length - 1}
                  leading={<IconTile icon={appearance.Icon} color={appearance.color} size={36} />}
                  title={item.name}
                  meta={
                    <>
                      <StockTag status={getStockStatus(item)} />
                      <span>{t("inventory.list.min", { min: item.minThreshold, unit: unit(item.unit, item.minThreshold) })}</span>
                    </>
                  }
                  onOpen={() => message.info(`Acá se abre el detalle de ${item.name}`)}
                  openLabel={t("inventory.list.openAria", { name: item.name })}
                  trailing={
                    <>
                      <QuantityStepper value={item.quantity} unit={unit(item.unit, item.quantity)} onStep={(delta) => adjust(item.id, delta)} />
                      <Popconfirm
                        title={t("inventory.list.deleteConfirm", { name: item.name })}
                        okText={t("inventory.list.deleteOk")}
                        okButtonProps={{ danger: true }}
                        cancelText={t("common.cancel")}
                        onConfirm={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
                      >
                        <Button type="text" danger aria-label={t("inventory.list.deleteAria", { name: item.name })} icon={<Trash2 />} />
                      </Popconfirm>
                    </>
                  }
                />
              );
            })}
          </AnimatePresence>
        </Card>
      </Reveal>

      {children.length > 0 && (
        <Reveal delay={0.15} style={{ marginBottom: 32 }}>
          <SectionHeader
            icon={Layers}
            title={t("storage.subcontainers")}
            description={t("storage.childCount", { count: children.length })}
            extra={<Button icon={<Plus />}>{t("storage.addSubcontainer")}</Button>}
          />
          <NoNavigate onLink={(href) => onOpen(idFromHref(href))}>
            <RoomFloor color={color} minTileWidth={150}>
              {children.map((child) => (
                <ContainerTileDemo key={child.id} container={child} />
              ))}
            </RoomFloor>
          </NoNavigate>
        </Reveal>
      )}

      <Reveal delay={0.2}>
        <SectionHeader icon={NotebookPen} title={t("storage.contents.title")} description="Lo que guardás sin contarlo: cables, recuerdos, piezas sueltas." />
        <Card styles={{ body: { padding: 0 } }}>
          <AnimatePresence initial={false}>
            {notes.map((note, index) => (
              <ListRow
                key={note.id}
                index={index}
                title={note.text}
                trailing={
                  <>
                    <Button type="text" aria-label={t("storage.contents.edit", { name: note.text })} icon={<Pencil />} />
                    <Button
                      type="text"
                      danger
                      aria-label={t("storage.contents.delete", { name: note.text })}
                      icon={<Trash2 />}
                      onClick={() => setNotes((current) => current.filter((entry) => entry.id !== note.id))}
                    />
                  </>
                }
              />
            ))}
          </AnimatePresence>
          <Flex gap={8} style={{ padding: "12px 24px" }}>
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onPressEnter={addNote}
              placeholder={t("storage.contents.placeholder")}
              aria-label={t("storage.contents.input")}
            />
            <Button icon={<Plus />} disabled={!draft.trim()} onClick={addNote}>
              {t("storage.contents.add")}
            </Button>
          </Flex>
        </Card>
        <Typography.Paragraph type="secondary" style={{ margin: "8px 0 0", fontSize: token.fontSizeSM }}>
          Fotos del contenedor: van en su propia sección, debajo (sin cambios respecto de hoy).
        </Typography.Paragraph>
      </Reveal>
    </>
  );
}

type CameraMode = "qr" | "find" | "ar";

function CameraScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const [mode, setMode] = useState<CameraMode>("find");
  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");
  const { space, container } = find("alacena");
  const { color, Icon } = containerAppearance(container);
  const matches = (text: string) => !query.trim() || normalize(text).includes(normalize(query.trim()));
  const items = container.items.filter((item) => matches(item.name));
  const notes = container.notes.filter(matches);
  const hasMatch = items.length + notes.length > 0;
  const preview = [...items.slice(0, 2).map((item) => item.name), ...notes.slice(0, 1)].join(" · ");
  const unit = (value: string, count: number) => (isUnit(value) ? t(`inventory.units.${value}`, { count }) : value);
  const codeMatch = ALL.find((entry) => entry.container.code === code.toUpperCase());

  return (
    <>
      <PageHeader eyebrow={t("storage.eyebrow")} title="Cámara" description="Apuntá a una etiqueta y te muestra qué hay guardado adentro." />
      <Reveal delay={0.05}>
        <Segmented<CameraMode>
          value={mode}
          onChange={setMode}
          style={{ marginBottom: 16 }}
          options={[
            { value: "qr", label: "Escanear QR", icon: <ScanLine /> },
            { value: "find", label: "Mirar y encontrar", icon: <Search /> },
            { value: "ar", label: "AR", icon: <Box /> },
          ]}
        />
      </Reveal>
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Reveal delay={0.1}>
            <CameraViewport
              frame={mode === "qr"}
              placeholder={<div style={{ width: "62%", transform: "scale(1.6)" }}><ContainerScene container={container} bare /></div>}
              detection={mode === "find" ? { x: 0.5, y: 0.3, title: container.name, detail: hasMatch ? preview : `Sin “${query}” acá`, tone: hasMatch ? "match" : "unknown" } : null}
            >
              {mode === "ar" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={SPRING.soft}
                  style={{
                    position: "absolute",
                    top: "10%",
                    left: "6%",
                    width: "min(46%, 220px)",
                    padding: 12,
                    borderRadius: token.borderRadiusLG,
                    border: `1px solid ${token.colorPrimaryBorder}`,
                    background: `color-mix(in srgb, ${token.colorBgElevated} 94%, transparent)`,
                    backdropFilter: "blur(8px)",
                    boxShadow: token.boxShadowSecondary,
                    color: token.colorText,
                    transform: "perspective(600px) rotateY(10deg)",
                  }}
                >
                  <Typography.Text strong style={{ display: "block" }}>
                    {space.name} › {container.name}
                  </Typography.Text>
                  {container.items.slice(0, 3).map((item) => (
                    <Typography.Text key={item.id} style={{ display: "block", fontSize: token.fontSizeSM }}>
                      {item.name}: {item.quantity} {unit(item.unit, item.quantity)}
                    </Typography.Text>
                  ))}
                  <Typography.Text type="secondary" style={{ display: "block", marginTop: 4, fontFamily: "var(--font-geist-mono)", fontSize: token.fontSizeSM }}>
                    {container.code}
                  </Typography.Text>
                </motion.div>
              )}
            </CameraViewport>
            <Flex gap={12} wrap align="center" style={{ marginTop: 16 }}>
              <Button type="primary" size="large" icon={<Camera />}>
                {mode === "ar" ? "Entrar en AR" : "Activar cámara"}
              </Button>
              <Typography.Text type="secondary">Todo pasa en este teléfono: las imágenes no salen de acá.</Typography.Text>
            </Flex>
          </Reveal>
        </Col>

        <Col xs={24} lg={10}>
          <Reveal delay={0.15}>
            {mode === "qr" ? (
              <Card>
                <SectionHeader icon={ScanLine} title="¿No lee la etiqueta?" description="Escribí el código de cuatro letras." />
                <Space.Compact style={{ width: "100%" }}>
                  <Input
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    maxLength={4}
                    placeholder="K7QM"
                    aria-label={t("storage.code")}
                    style={{ fontFamily: "var(--font-geist-mono)", letterSpacing: "0.2em", textTransform: "uppercase" }}
                  />
                  <Button type="primary" disabled={!codeMatch} onClick={() => codeMatch && onOpen(codeMatch.container.id)}>
                    Ir
                  </Button>
                </Space.Compact>
                <Typography.Paragraph type="secondary" style={{ margin: "12px 0 0", fontSize: token.fontSizeSM }}>
                  Probá con K7QM o TR4X.
                </Typography.Paragraph>
              </Card>
            ) : (
              <Card styles={{ body: { padding: 0 } }}>
                <div style={{ padding: "16px 24px 4px" }}>
                  <SectionHeader
                    icon={Icon}
                    color={color}
                    title={container.name}
                    description={`${space.name} · ${container.code}`}
                    extra={
                      <Button icon={<ExternalLink />} onClick={() => onOpen(container.id)}>
                        Abrir
                      </Button>
                    }
                  />
                  <Input allowClear prefix={<Search />} placeholder="¿Qué buscás?" aria-label="¿Qué buscás?" value={query} onChange={(event) => setQuery(event.target.value)} style={{ marginBottom: 12 }} />
                </div>
                {!hasMatch && (
                  <Typography.Paragraph type="secondary" style={{ margin: 0, padding: "12px 24px 20px" }}>
                    No hay “{query}” en {container.name}. Probá apuntando a otra etiqueta.
                  </Typography.Paragraph>
                )}
                <AnimatePresence initial={false}>
                  {items.map((item, index) => (
                    <ListRow
                      key={item.id}
                      index={index}
                      title={<Highlight text={item.name} query={query.trim()} />}
                      meta={<StockTag status={getStockStatus(item)} />}
                      trailing={
                        <Typography.Text strong style={{ whiteSpace: "nowrap" }}>
                          {item.quantity} {unit(item.unit, item.quantity)}
                        </Typography.Text>
                      }
                    />
                  ))}
                  {notes.map((note, index) => (
                    <ListRow key={note} index={items.length + index} divider={index < notes.length - 1} title={<Highlight text={note} query={query.trim()} />} meta="Anotación" />
                  ))}
                </AnimatePresence>
              </Card>
            )}
          </Reveal>
        </Col>
      </Row>
    </>
  );
}

// ── Flujo ────────────────────────────────────────────────────────────────────────────────────

type Step = "plan" | "container" | "camera";

export function StorageFlow() {
  const [step, setStep] = useState<Step>("plan");
  const [containerId, setContainerId] = useState("alacena");
  const open = (id: string) => {
    setContainerId(id);
    setStep("container");
  };

  return (
    <DemoBlock
      id="flujo-almacenamiento"
      title="Flujo: almacenamiento"
      description="Cómo tienen que verse Inventario, la página de un contenedor y la cámara. Tocá una ficha, buscá “yerba”, sumá una anotación, cambiá de modo en la cámara. Decisiones: una sola cámara con modos; fichas con tres líneas como mucho; un encabezado por sección (SectionHeader); como mucho dos acciones visibles y el resto en ⋯; botones táctiles de 44px; el orden del contenedor es productos → compartimentos → anotaciones. Los textos de la cámara son la propuesta de la revisión de voz; en la app van por t()."
      code={`
// Página de un contenedor: el esqueleto que tienen que seguir ContainerPage y ContainerContents.
<PageHeader leading={<IconTile icon={Icon} color={color} size={56} solid />} eyebrow={space.name} title={container.name}
  description={<>{kind} · {t("storage.code")} {code}</>}
  extra={<><Button icon={<Camera />}>Cámara</Button><Button type="primary" icon={<Plus />}>Agregar producto</Button><Dropdown …><Button icon={<EllipsisVertical />} aria-label="Más acciones" /></Dropdown></>} />

<Stagger><Row gutter={[12, 12]}>{/* StatTile × 3 */}</Row></Stagger>

<Reveal delay={0.1}>
  <SectionHeader icon={Boxes} title={t("storage.contents.inventory")} description={…} />
  <Card styles={{ body: { padding: 0 } }}><AnimatePresence>{items.map((item, i) => <ListRow … />)}</AnimatePresence></Card>
</Reveal>
<Reveal delay={0.15}>
  <SectionHeader icon={Layers} title={t("storage.subcontainers")} />
  <RoomFloor color={color}>{children.map((child) => <VisualTile … />)}</RoomFloor>
</Reveal>
<Reveal delay={0.2}>{/* Anotaciones: ListRow + Input en línea, sin Modal para editar una línea */}</Reveal>

// Plano: un panel por ambiente (IconTile solid + título + RoomFloor con VisualTile).
// Cámara: un solo visor (CameraViewport) con Segmented de modos.
`}
    >
      <FlowFrame<Step>
        steps={[
          { value: "plan", label: "1 · Plano de la casa" },
          { value: "container", label: "2 · Contenedor" },
          { value: "camera", label: "3 · Cámara" },
        ]}
        step={step}
        onStep={setStep}
        status="reference"
        screenKey={step === "container" ? `container:${containerId}` : step}
      >
        {step === "plan" && <PlanScreen onOpen={open} onCamera={() => setStep("camera")} />}
        {step === "container" && <ContainerScreen key={containerId} id={containerId} onOpen={open} onCamera={() => setStep("camera")} />}
        {step === "camera" && <CameraScreen onOpen={open} />}
      </FlowFrame>
    </DemoBlock>
  );
}
