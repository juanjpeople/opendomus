"use client";

import { App, Button, Card, Col, Collapse, Divider, Dropdown, Flex, Grid, Input, Row, Segmented, Select, Tag, Typography, theme } from "antd";
import { AnimatePresence } from "framer-motion";
import { Boxes, Camera, ClipboardList, EllipsisVertical, ExternalLink, Layers, ListPlus, NotebookPen, PackageMinus, PackageOpen, Pencil, Plus, QrCode, ScanLine, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Reveal } from "@/components/motion";
import { CameraViewport, EmptyState, IconTile, ListRow, PageHeader, PathCrumbs, PlaceChip, QuantityStepper, RoomFloor, SectionHeader, StockTag, ViewSwitcher, type CameraDetection } from "@/components/ui";
import type { CatalogCategory } from "@/features/inventory/catalog";
import { CATEGORY_APPEARANCE } from "@/features/inventory/catalog-appearance";
import { getStockStatus, isUnit } from "@/features/inventory/domain";
import { ContainerScene } from "@/features/storage/components/ContainerScene";
import { AddTile, ContainerTile } from "@/features/storage/components/ContainerTiles";
import { CardsView, ListView, PlacesView, PlanView, useViewOptions, ViewStage } from "@/features/storage/components/StorageViews";
import { containerAppearance, spaceAppearance, type ContainerKind, type SpaceKind } from "@/features/storage/domain";
import type { ContainerOverview, SpaceOverview } from "@/features/storage/hooks";
import { flattenOverview, spaceTotals } from "@/features/storage/views";
import { useT } from "@/i18n";
import { tint } from "@/lib/appearance";
import type { InventoryView, SpaceView } from "@/lib/preferences";
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
        id: "heladera", name: "Heladera", kind: "fridge", code: "H3LD", notes: [],
        items: [
          { id: "leche", name: "Leche", quantity: 2, minThreshold: 2, unit: "litros", category: "food" },
          { id: "manteca", name: "Manteca", quantity: 0, minThreshold: 1, unit: "unidades", category: "food" },
          { id: "huevos", name: "Huevos", quantity: 6, minThreshold: 6, unit: "unidades", category: "food" },
        ],
      },
      {
        id: "alacena", name: "Alacena", kind: "pantry", code: "K7QM", notes: ["Bolsas de tela para el súper", "Moldes de budín"],
        items: [
          { id: "yerba", name: "Yerba", quantity: 1, minThreshold: 2, unit: "kg", category: "food" },
          { id: "arroz", name: "Arroz largo fino", quantity: 4, minThreshold: 2, unit: "paquetes", category: "food" },
          { id: "aceite", name: "Aceite de girasol", quantity: 0, minThreshold: 1, unit: "litros", category: "food" },
          { id: "detergente", name: "Detergente", quantity: 2, minThreshold: 1, unit: "unidades", category: "cleaning" },
        ],
        children: [
          { id: "estante", name: "Estante de arriba", kind: "compartment", code: "E5TA", notes: [], items: [{ id: "harina", name: "Harina 0000", quantity: 2, minThreshold: 1, unit: "kg", category: "food" }] },
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
        id: "herramientas", name: "Caja de herramientas", kind: "toolbox", code: "TR4X", notes: [],
        items: [
          { id: "destornillador", name: "Destornillador Phillips", quantity: 2, minThreshold: 1, unit: "unidades", category: "tools" },
          { id: "cinta", name: "Cinta aisladora", quantity: 0, minThreshold: 1, unit: "unidades", category: "electrical" },
        ],
      },
      {
        id: "estanteria", name: "Estantería de herramientas", kind: "shelf", code: "S7NT", notes: ["Piezas de la impresora"],
        items: [{ id: "tornillos", name: "Tornillos 6 mm", quantity: 40, minThreshold: 10, unit: "unidades", category: "hardware" }],
        children: [
          { id: "cables", name: "Caja de cables", kind: "box", code: "C4BL", notes: ["Cables USB viejos", "Cargador de notebook"], items: [] },
          { id: "pintura", name: "Caja de pintura", kind: "box", code: "P1NT", notes: ["Rodillos", "Pinceles"], items: [] },
        ],
      },
      { id: "vacia", name: "Caja para ordenar", kind: "box", code: "V4CA", notes: [], items: [] },
    ],
  },
];

/** La casa de ejemplo con la misma forma que \`useStorageOverview\`: las vistas reales la dibujan igual. */
function toOverview(container: DemoContainer, spaceId: string, depth: number, parentId?: string): ContainerOverview {
  const children = (container.children ?? []).map((child) => toOverview(child, spaceId, depth + 1, container.id));
  const statuses = container.items.map(getStockStatus);
  const own = {
    itemCount: container.items.length,
    needsAttention: statuses.filter((status) => status !== "ok").length,
    low: statuses.filter((status) => status === "low").length,
    empty: statuses.filter((status) => status === "empty").length,
    contentCount: container.notes.length,
    photoCount: 0,
  };
  const total = children.reduce((sum, child) => ({
    itemCount: sum.itemCount + child.itemCount, needsAttention: sum.needsAttention + child.needsAttention, low: sum.low + child.low,
    empty: sum.empty + child.empty, contentCount: sum.contentCount + child.contentCount, photoCount: 0,
  }), own);
  return {
    id: container.id, spaceId, parentId, name: container.name, kind: container.kind, code: container.code, createdAt: 0, updatedAt: 0,
    ...total, children, depth, preview: [...container.items.map((item) => item.name), ...container.notes].slice(0, 3),
  };
}

const SPACES: SpaceOverview[] = HOUSE.map((space) => ({
  id: space.id, name: space.name, kind: space.kind, createdAt: 0, updatedAt: 0,
  containers: space.containers.map((container) => toOverview(container, space.id, 1)),
}));

const ALL = HOUSE.flatMap((space) => {
  const walk = (container: DemoContainer, ancestors: DemoContainer[]): { space: DemoSpace; container: DemoContainer; ancestors: DemoContainer[] }[] =>
    [{ space, container, ancestors }, ...(container.children ?? []).flatMap((child) => walk(child, [...ancestors, container]))];
  return space.containers.flatMap((container) => walk(container, []));
});
const find = (id: string) => ALL.find((entry) => entry.container.id === id) ?? ALL[1];
const findItem = (id: string) => ALL.flatMap((entry) => entry.container.items.map((item) => ({ ...entry, item }))).find((entry) => entry.item.id === id);
const pathOf = (entry: (typeof ALL)[number]) => [entry.space.name, ...entry.ancestors.map((ancestor) => ancestor.name)].join(" › ");

/** Minúsculas y sin tildes, con el mismo largo que el original (para resaltar en el lugar justo). */
const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const params = (href: string) => new URLSearchParams(href.split("?")[1] ?? "");

interface Navigate {
  onSpace: (id: string) => void;
  onContainer: (id: string, item?: string) => void;
  onItem: (id: string) => void;
  onCamera: () => void;
  onHome: () => void;
}

/** En la demo los enlaces de las vistas reales cambian de paso en lugar de navegar. */
function DemoLinks({ go, children }: { go: Navigate; children: ReactNode }) {
  return (
    <NoNavigate onLink={(href) => {
      const query = params(href);
      if (href.startsWith("/inventario/lugar")) go.onSpace(query.get("id") ?? "");
      else if (href.startsWith("/inventario/ver")) go.onContainer(query.get("id") ?? "", query.get("item") ?? undefined);
      else go.onHome();
    }}>
      {children}
    </NoNavigate>
  );
}

// ── 1 · Inventario ───────────────────────────────────────────────────────────────────────────

function InventoryScreen({ go }: { go: Navigate }) {
  const t = useT();
  const { token } = theme.useToken();
  const options = useViewOptions();
  const [view, setView] = useState<InventoryView>("places");
  const [query, setQuery] = useState("");
  const attention = ALL.flatMap((entry) => entry.container.items.filter((item) => getStockStatus(item) !== "ok").map((item) => ({ ...entry, item })));
  const words = normalize(query.trim());
  const results = words ? ALL.flatMap((entry) => {
    const hit = entry.container.items.find((item) => normalize(item.name).includes(words));
    const note = entry.container.notes.find((text) => normalize(text).includes(words));
    return hit || note || normalize(entry.container.name).includes(words) ? [{ entry, hit, note }] : [];
  }) : [];

  return (
    <>
      <PageHeader
        eyebrow={t("storage.eyebrow")}
        title={t("storage.title")}
        description={t("storage.description")}
        extra={<><Button icon={<Camera />} onClick={go.onCamera}>{t("camera.openMode")}</Button><Button type="primary" icon={<Plus />}>{t("storage.addSpace")}</Button></>}
      />
      <Reveal delay={0.05}>
        <Card style={{ marginBottom: token.marginLG }}>
          <Input size="large" allowClear prefix={<Search />} placeholder={t("storage.search.placeholder")} aria-label={t("storage.search.placeholder")} value={query} onChange={(event) => setQuery(event.target.value)} />
          {!query.trim() && <Typography.Paragraph type="secondary" style={{ margin: "8px 0 0" }}>Probá con “yerba” o “cables”: un producto abre su ficha; una anotación, su caja.</Typography.Paragraph>}
          {!!query.trim() && (
            <div style={{ marginTop: token.marginSM }}>
              <AnimatePresence initial={false}>
                {results.map(({ entry, hit, note }, index) => {
                  const { color, Icon } = containerAppearance(entry.container);
                  return (
                    <ListRow key={entry.container.id} index={index} divider={index < results.length - 1}
                      leading={<IconTile icon={Icon} color={color} size={token.controlHeight} />}
                      title={hit?.name ?? note ?? entry.container.name}
                      meta={<span>{pathOf(entry)} › {entry.container.name}</span>}
                      onOpen={() => (hit ? go.onContainer(entry.container.id, hit.id) : go.onContainer(entry.container.id))}
                      openLabel={hit ? `Abrir ${hit.name}` : `Abrir ${entry.container.name}`} />
                  );
                })}
              </AnimatePresence>
              {results.length === 0 && <Typography.Paragraph type="secondary" style={{ margin: 0 }}>{t("storage.search.empty")}</Typography.Paragraph>}
            </div>
          )}
        </Card>
      </Reveal>
      <Reveal delay={0.08}>
        <Card style={{ marginBottom: token.marginLG }}>
          <SectionHeader icon={ShoppingCart} color="gold" title={t("storage.highlights.restock")} description={t("storage.highlights.restockCount", { count: attention.length })} />
          <DemoLinks go={go}>
            <Flex wrap gap={token.marginXS}>
              {attention.slice(0, 8).map((entry) => (
                <PlaceChip key={entry.item.id} href={`/inventario/ver?id=${entry.container.id}&item=${entry.item.id}`}
                  label={entry.item.name} detail={entry.container.name}
                  ariaLabel={t("storage.highlights.openItem", { name: entry.item.name, place: `${pathOf(entry)} › ${entry.container.name}` })}
                  title={`${t(`inventory.stock.${getStockStatus(entry.item)}`)} · ${pathOf(entry)} › ${entry.container.name}`}
                  dot={getStockStatus(entry.item) === "empty" ? token.colorError : token.colorWarning} />
              ))}
            </Flex>
          </DemoLinks>
        </Card>
      </Reveal>
      <Reveal delay={0.1}>
        <SectionHeader
          title={t("storage.yourPlaces")}
          description={`${t("storage.spaceCount", { count: SPACES.length })} · ${t("storage.containerCount", { count: flattenOverview(SPACES).length })}`}
          extra={<ViewSwitcher label={t("storage.views.label")} value={view} options={options.inventory} onChange={setView} />}
        />
      </Reveal>
      <div style={{ marginTop: token.marginSM }}>
        <DemoLinks go={go}>
          <ViewStage view={view}>
            {view === "places" && <PlacesView spaces={SPACES} />}
            {view === "plan" && <PlanView spaces={SPACES} actions={{ onLabels: () => undefined, onAddContainer: () => undefined, onEditSpace: () => undefined, onDeleteSpace: () => undefined }} />}
            {view === "list" && <ListView spaces={SPACES} />}
            {view === "cards" && <CardsView spaces={SPACES} actions={{ onLabels: () => undefined }} />}
          </ViewStage>
        </DemoLinks>
      </div>
    </>
  );
}

// ── 2 · Recinto ──────────────────────────────────────────────────────────────────────────────

function SpaceScreen({ id, go }: { id: string; go: Navigate }) {
  const t = useT();
  const { token } = theme.useToken();
  const options = useViewOptions();
  const [view, setView] = useState<SpaceView>("plan");
  const space = SPACES.find((candidate) => candidate.id === id) ?? SPACES[1];
  const { color, Icon } = spaceAppearance(space);
  const totals = spaceTotals(space);

  return (
    <DemoLinks go={go}>
      <PageHeader
        crumbs={<PathCrumbs items={[{ label: t("storage.title"), href: "/inventario", icon: Boxes }, { label: space.name }]} />}
        leading={<IconTile icon={Icon} color={color} size={token.controlHeightLG + token.padding} solid />}
        title={space.name}
        description={`${t("storage.containerCount", { count: totals.containers })} · ${t("storage.itemCount", { count: totals.items })}`}
        extra={<><Button icon={<Camera />} onClick={go.onCamera}>{t("camera.openMode")}</Button><Button type="primary" icon={<Plus />}>{t("storage.addContainer")}</Button><Button icon={<EllipsisVertical />} aria-label={t("common.moreActions")} /></>}
      />
      <Reveal delay={0.1}>
        <SectionHeader title={t("storage.inThisSpace")} description={t("storage.containerCount", { count: totals.containers })}
          extra={<ViewSwitcher label={t("storage.views.label")} value={view} options={options.space} onChange={setView} />} />
      </Reveal>
      <div style={{ marginTop: token.marginSM }}>
        <ViewStage view={view}>
          {view === "plan" && <PlanView spaces={[space]} actions={{ onLabels: () => undefined, onAddContainer: () => undefined }} single />}
          {view === "list" && <ListView spaces={[space]} single />}
          {view === "cards" && <CardsView spaces={[space]} actions={{ onLabels: () => undefined }} single />}
        </ViewStage>
      </div>
    </DemoLinks>
  );
}

// ── 3 · Contenedor ───────────────────────────────────────────────────────────────────────────

function ContainerScreen({ id, highlight, go }: { id: string; highlight?: string; go: Navigate }) {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const entry = find(id);
  const { space, container, ancestors } = entry;
  const node = flattenOverview(SPACES).find((candidate) => candidate.container.id === id)?.container;
  const { color } = containerAppearance(container);
  const [items, setItems] = useState(container.items);
  const [notes, setNotes] = useState(container.notes.map((text, index) => ({ id: `${container.id}-${index}`, text })));
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const unit = (value: string, count: number) => (isUnit(value) ? t(`inventory.units.${value}`, { count }) : value);
  const children = node?.children ?? [];
  const empty = items.length + notes.length + children.length === 0;
  const touch = { minWidth: token.controlHeightLG + token.paddingXXS, minHeight: token.controlHeightLG + token.paddingXXS };
  const adjust = (itemId: string, delta: number) => setItems((current) => current.map((item) => (item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item)));
  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    setNotes((current) => [...current, { id: `${Date.now()}`, text }]);
    setDraft("");
  };
  const parts = [
    children.length ? t("storage.childCount", { count: children.length }) : null,
    items.length ? t("storage.itemCount", { count: items.length }) : null,
    notes.length ? t("storage.noteCount", { count: notes.length }) : null,
  ].filter(Boolean);

  return (
    <DemoLinks go={go}>
      <PageHeader
        crumbs={<PathCrumbs items={[{ label: t("storage.title"), href: "/inventario", icon: Boxes }, { label: space.name, href: `/inventario/lugar?id=${space.id}`, icon: spaceAppearance(space).Icon }, ...ancestors.map((ancestor) => ({ label: ancestor.name, href: `/inventario/ver?id=${ancestor.id}` })), { label: container.name }]} />}
        leading={<ContainerScene key={container.id} container={container} compact open />}
        title={container.name}
        description={<>{t(`storage.containerKinds.${container.kind}`)} · {t("storage.code")} <span style={{ fontFamily: "var(--font-geist-mono)", letterSpacing: "0.08em" }}>{container.code}</span></>}
        extra={
          <>
            <Button icon={<Camera />} onClick={go.onCamera}>{t("camera.openMode")}</Button>
            <Button icon={<QrCode />}>{t("storage.label")}</Button>
            <Dropdown trigger={["click"]} menu={{ items: [{ key: "edit", icon: <Pencil />, label: t("storage.edit") }, { key: "child", icon: <Layers />, label: t("storage.addSubcontainer") }, { type: "divider" }, { key: "delete", danger: true, icon: <Trash2 />, label: t("storage.delete") }] }}>
              <Button icon={<EllipsisVertical />} aria-label={t("common.moreActions")} />
            </Dropdown>
          </>
        }
      />
      {!empty && <Typography.Text type="secondary" style={{ display: "block", marginTop: -token.marginLG, marginBottom: token.marginLG }}>{parts.join(" · ")}</Typography.Text>}

      {empty && (
        <Card style={{ marginBottom: token.marginXL }}>
          <Flex vertical align="center" gap={token.marginSM} style={{ padding: token.paddingLG, textAlign: "center" }}>
            <Typography.Title level={4} style={{ margin: 0 }}>{t("storage.emptyContainer.title")}</Typography.Title>
            <Typography.Paragraph type="secondary" style={{ margin: 0, maxWidth: 420 }}>{t("storage.emptyContainer.text")}</Typography.Paragraph>
            <Flex gap={token.marginXS} wrap justify="center">
              <Button type="primary" icon={<Plus />}>{t("inventory.form.title")}</Button>
              <Button icon={<NotebookPen />} onClick={() => setAdding(true)}>{t("storage.contents.new")}</Button>
              <Button icon={<Layers />}>{t("storage.addSubcontainer")}</Button>
            </Flex>
          </Flex>
        </Card>
      )}

      {children.length > 0 && (
        <Reveal delay={0.1} style={{ marginBottom: token.marginXL }}>
          <SectionHeader icon={Layers} color={color} title={t("storage.subcontainers")} description={t("storage.childCount", { count: children.length })} extra={<Button icon={<Plus />}>{t("storage.addSubcontainer")}</Button>} />
          <RoomFloor color={color} minTileWidth={token.controlHeightLG * 3}>
            {children.map((child) => <ContainerTile key={child.id} container={child} onLabel={() => message.info(`Acá se imprime la etiqueta de ${child.name}`)} />)}
            <AddTile color={tint(token, color).solid} label={t("storage.addSubcontainer")} onClick={() => message.info("Acá se abre el formulario de subcontenedor")} />
          </RoomFloor>
        </Reveal>
      )}

      {!empty && (
        <Reveal delay={0.15} style={{ marginBottom: token.marginXL }}>
          <SectionHeader icon={Boxes} title={t("storage.contents.inventory")} description={items.length ? t("storage.itemCount", { count: items.length }) : t("inventory.list.emptyHint")} extra={<Button type="primary" icon={<Plus />}>{t("inventory.form.title")}</Button>} />
          <Card styles={{ body: { padding: 0 } }}>
            {items.length === 0 && <EmptyState icon={PackageOpen} title={t("inventory.list.emptyShort")} description={t("inventory.list.emptyHint")} />}
            <AnimatePresence initial={false}>
              {items.map((item, index) => {
                const appearance = CATEGORY_APPEARANCE[item.category];
                return (
                  <ListRow key={item.id} index={index} divider={index < items.length - 1} highlighted={item.id === highlight}
                    leading={<IconTile icon={appearance.Icon} color={appearance.color} size={token.controlHeight} />}
                    title={item.name}
                    meta={<><StockTag status={getStockStatus(item)} /><span>{t("inventory.list.min", { min: item.minThreshold, unit: unit(item.unit, item.minThreshold) })}</span></>}
                    onOpen={() => go.onItem(item.id)} openLabel={t("inventory.list.openAria", { name: item.name })}
                    trailing={<>
                      <Button icon={<PackageMinus />} aria-label={t("inventory.consume.aria", { name: item.name })} disabled={item.quantity <= 0} onClick={() => adjust(item.id, -1)} style={touch} />
                      <QuantityStepper value={item.quantity} unit={unit(item.unit, item.quantity)} onStep={(delta) => adjust(item.id, delta)} />
                    </>} />
                );
              })}
            </AnimatePresence>
          </Card>
        </Reveal>
      )}

      {(!empty || adding) && (
        <Reveal delay={0.2} style={{ marginBottom: token.marginXL }}>
          <SectionHeader icon={NotebookPen} title={t("storage.contents.title")} description={notes.length ? t("storage.noteCount", { count: notes.length }) : t("storage.contents.short")}
            extra={!adding && <Button icon={<Plus />} onClick={() => setAdding(true)}>{t("storage.contents.new")}</Button>} />
          <Card styles={{ body: { padding: 0 } }}>
            {adding && (
              <Flex gap={token.marginXS} wrap style={{ padding: `${token.padding}px ${token.paddingLG}px`, borderBottom: `1px solid ${token.colorBorderSecondary}`, background: token.colorFillQuaternary }}>
                <Input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onPressEnter={addNote} onKeyDown={(event) => { if (event.key === "Escape") setAdding(false); }} placeholder={t("storage.contents.placeholder")} aria-label={t("storage.contents.input")} style={{ flex: "1 1 220px" }} />
                <Button type="primary" icon={<Plus />} disabled={!draft.trim()} onClick={addNote}>{t("storage.contents.add")}</Button>
                <Button icon={<ClipboardList />}>{t("storage.contents.bulk")}</Button>
                <Button type="text" onClick={() => setAdding(false)}>{t("common.close")}</Button>
              </Flex>
            )}
            <AnimatePresence initial={false}>
              {notes.map((note, index) => (
                <ListRow key={note.id} index={index} divider={index < notes.length - 1} title={note.text} wrapTitle
                  trailing={<>
                    <Button type="text" icon={<Pencil />} aria-label={t("storage.contents.edit", { name: note.text })} style={touch} />
                    <Button type="text" icon={<Trash2 />} aria-label={t("storage.contents.delete", { name: note.text })} style={{ ...touch, color: token.colorTextSecondary }} onClick={() => setNotes((current) => current.filter((entry) => entry.id !== note.id))} />
                  </>} />
              ))}
            </AnimatePresence>
          </Card>
        </Reveal>
      )}

      <Reveal delay={0.25}>
        <SectionHeader icon={Camera} title={t("storage.contents.photos")} description={t("storage.contents.photosHint")} />
        <Card><Typography.Text type="secondary">Acá va la galería real (PhotoGallery), con el botón para sumar fotos.</Typography.Text></Card>
      </Reveal>
    </DemoLinks>
  );
}

// ── 4 · Ficha del producto ───────────────────────────────────────────────────────────────────

function ItemScreen({ id, go }: { id: string; go: Navigate }) {
  const t = useT();
  const { token } = theme.useToken();
  const found = findItem(id) ?? findItem("yerba")!;
  const [quantity, setQuantity] = useState(found.item.quantity);
  const item = { ...found.item, quantity };
  const unit = (count: number) => (isUnit(item.unit) ? t(`inventory.units.${item.unit}`, { count }) : item.unit);

  return (
    <DemoLinks go={go}>
      <Card style={{ maxWidth: 480, marginInline: "auto" }} title={<Flex align="center" gap={token.marginXS}><IconTile icon={CATEGORY_APPEARANCE[found.item.category].Icon} color={CATEGORY_APPEARANCE[found.item.category].color} size={token.controlHeight} solid /><span>{item.name}</span><StockTag status={getStockStatus(item)} /></Flex>} extra={<Button type="text" icon={<X />} aria-label={t("common.close")} onClick={() => go.onContainer(found.container.id)} />}>
        <Flex vertical gap={token.margin} style={{ padding: token.padding, borderRadius: token.borderRadiusLG * 2, border: `${token.lineWidth}px solid ${tint(token, CATEGORY_APPEARANCE[found.item.category].color).border}`, background: `linear-gradient(160deg, ${tint(token, CATEGORY_APPEARANCE[found.item.category].color).bg} 0%, ${token.colorBgContainer} 70%)` }}>
          <Flex align="center" justify="space-between" gap={token.marginSM} wrap>
            <Typography.Text type="secondary">{t("inventory.item.quantity")}</Typography.Text>
            <div style={{ fontSize: token.fontSizeHeading4 }}><QuantityStepper value={quantity} unit={unit(quantity)} onStep={(delta) => setQuantity((current) => Math.max(0, current + delta))} /></div>
          </Flex>
          <Flex gap={token.marginXS} wrap>
            <Button icon={<PackageMinus />} disabled={quantity <= 0} onClick={() => setQuantity((current) => Math.max(0, current - 1))}>{t("inventory.consume.one")}</Button>
            <Button icon={<ListPlus />}>{t("shopping.addToList")}</Button>
          </Flex>
        </Flex>
        <Divider />
        <Typography.Title level={5} style={{ margin: "0 0 12px" }}>{t("inventory.item.where")}</Typography.Title>
        <PathCrumbs label={t("inventory.item.where")} items={[{ label: found.space.name, href: `/inventario/lugar?id=${found.space.id}`, icon: Boxes }, ...found.ancestors.map((ancestor) => ({ label: ancestor.name, href: `/inventario/ver?id=${ancestor.id}` })), { label: found.container.name, href: `/inventario/ver?id=${found.container.id}` }]} />
        <Select aria-label={t("inventory.item.moveTo")} placeholder={t("inventory.item.moveTo")} value={null} style={{ width: "100%", marginTop: token.marginXS }}
          options={HOUSE.map((space) => ({ label: space.name, options: ALL.filter((entry) => entry.space.id === space.id && entry.container.id !== found.container.id).map((entry) => ({ value: entry.container.id, label: [...entry.ancestors.map((ancestor) => ancestor.name), entry.container.name].join(" › ") })) }))} />
        <Divider />
        <Typography.Title level={5} style={{ margin: "0 0 12px" }}>{t("inventory.consume.title")}</Typography.Title>
        <div style={{ padding: token.paddingSM, borderRadius: token.borderRadiusLG, background: token.colorFillQuaternary }}>
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{t("inventory.consume.last30")}</Typography.Text>
          <div style={{ fontSize: token.fontSizeHeading4, fontWeight: 600, letterSpacing: "-0.02em" }}>3 {unit(3)}</div>
        </div>
        <Divider />
        <Collapse ghost style={{ marginInline: -token.padding }} items={[{ key: "details", label: <Typography.Text strong>{t("inventory.item.details")}</Typography.Text>, children: <Typography.Text type="secondary">Nombre, mínimo, unidad y sugerencias: plegados, porque se tocan poco.</Typography.Text> }]} />
        <Divider />
        <Typography.Title level={5} style={{ margin: "0 0 12px" }}>{t("prices.title")}</Typography.Title>
        <Typography.Text type="secondary">Historial de precios del producto (PricePanel).</Typography.Text>
      </Card>
    </DemoLinks>
  );
}

// ── 5 · Cámara ───────────────────────────────────────────────────────────────────────────────

type CameraMode = "qr" | "find" | "ar";

/** Etiquetas "a la vista" de la demo, como si la cámara mirara la estantería del taller. */
const IN_VIEW = [
  { id: "cables", x: 0.26, y: 0.3 },
  { id: "pintura", x: 0.72, y: 0.34 },
  { id: "herramientas", x: 0.48, y: 0.7 },
];

function CameraScreen({ go }: { go: Navigate }) {
  const t = useT();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const [mode, setMode] = useState<CameraMode>("find");
  const [query, setQuery] = useState("cables");
  const [zoom, setZoom] = useState(1);
  const words = normalize(query.trim());
  const matchesOf = (container: DemoContainer) => [...container.items.map((item) => item.name), ...container.notes].filter((text) => !words || normalize(text).includes(words));
  const bubbles: CameraDetection[] = mode !== "find" ? [] : IN_VIEW.map(({ id, x, y }) => {
    const { container } = find(id);
    const hits = matchesOf(container);
    return {
      id, x, y, title: container.name,
      tone: words && hits.length === 0 ? "dim" : "match",
      detail: words ? (hits.length ? t("camera.matches", { count: hits.length }) : t("camera.noMatchShort")) : hits.slice(0, 2).join(" · ") || t("camera.empty"),
      label: t("camera.openContainer", { name: container.name }),
      onSelect: () => go.onContainer(id),
    };
  });
  const found = words ? ALL.filter((entry) => matchesOf(entry.container).length > 0) : [];

  return (
    <>
      <PageHeader eyebrow={t("storage.eyebrow")} title={t("camera.title")} description={t(mode === "find" ? "camera.findDescription" : "camera.description")} />
      <Reveal delay={0.05}>
        <Segmented<CameraMode> value={mode} onChange={setMode} vertical={!screens.sm} block={!screens.sm} style={{ marginBottom: token.margin }} options={[
          { value: "qr", label: t("scan.title"), icon: <ScanLine /> },
          { value: "find", label: t("camera.findMode"), icon: <Search /> },
          { value: "ar", label: <span style={{ display: "inline-flex", alignItems: "center", gap: token.marginXS }}><span>{t("camera.arMode")}</span><Tag bordered={false} style={{ marginInlineEnd: 0 }}>{t("camera.experimental")}</Tag></span>, icon: <Layers /> },
        ]} />
      </Reveal>
      <Row gutter={[token.marginLG, token.marginLG]}>
        <Col xs={24} lg={14}>
          <Reveal delay={0.1}>
            <Flex vertical gap={token.margin}>
              {mode === "find" && <Input size="large" allowClear prefix={<Search />} placeholder={t("camera.search")} aria-label={t("camera.search")} value={query} onChange={(event) => setQuery(event.target.value)} />}
              <CameraViewport
                frame={mode === "qr"}
                placeholder={<div style={{ width: "62%", transform: "scale(1.6)" }}><ContainerScene container={{ kind: "shelf", color: "purple" }} bare /></div>}
                detections={bubbles}
                controls={mode === "find" ? <Segmented<number> aria-label={t("camera.zoom")} value={zoom} onChange={setZoom} options={[1, 2, 3].map((value) => ({ value, label: `${value}×` }))} /> : undefined}
              />
              <Typography.Text type="secondary">{t(mode === "find" ? "camera.findHint" : "camera.local")}</Typography.Text>
            </Flex>
          </Reveal>
        </Col>
        <Col xs={24} lg={10}>
          <Reveal delay={0.15}>
            {mode === "find" && words ? (
              <Card styles={{ body: { padding: 0 } }}>
                <div style={{ padding: `${token.padding}px ${token.paddingLG}px 0` }}>
                  <SectionHeader icon={Search} title={t("camera.whereFound", { query: query.trim() })} description={t("camera.foundCount", { count: found.length })} />
                </div>
                <AnimatePresence initial={false}>
                  {found.map((entry, index) => {
                    const { color, Icon } = containerAppearance(entry.container);
                    const inView = IN_VIEW.some((label) => label.id === entry.container.id);
                    return <ListRow key={entry.container.id} index={index} divider={index < found.length - 1}
                      leading={<IconTile icon={Icon} color={color} size={token.controlHeight} />}
                      title={entry.container.name} meta={<span>{pathOf(entry)}</span>}
                      onOpen={() => go.onContainer(entry.container.id)} openLabel={t("camera.openContainer", { name: entry.container.name })}
                      trailing={inView ? <Tag color="success" bordered={false}>{t("camera.inView")}</Tag> : undefined} />;
                  })}
                </AnimatePresence>
              </Card>
            ) : (
              <Card>
                <SectionHeader icon={mode === "qr" ? ScanLine : Layers} title={mode === "qr" ? t("scan.manual") : t("spatial.title")} description={mode === "qr" ? t("camera.manualHint") : t("spatial.unsupported")} />
                {mode === "find" && <Button icon={<ExternalLink />} onClick={() => go.onContainer("estanteria")}>{t("camera.open")}</Button>}
              </Card>
            )}
          </Reveal>
        </Col>
      </Row>
    </>
  );
}

// ── Flujo ────────────────────────────────────────────────────────────────────────────────────

type Step = "inventory" | "space" | "container" | "item" | "camera";

export function StorageFlow() {
  const [step, setStep] = useState<Step>("inventory");
  const [spaceId, setSpaceId] = useState("taller");
  const [containerId, setContainerId] = useState("alacena");
  const [itemId, setItemId] = useState("yerba");
  const [highlight, setHighlight] = useState<string | undefined>();
  const go: Navigate = {
    onHome: () => setStep("inventory"),
    onSpace: (id) => { setSpaceId(id); setStep("space"); },
    onContainer: (id, item) => { setContainerId(id); setHighlight(item); setStep(item ? "item" : "container"); if (item) setItemId(item); },
    onItem: (id) => { setItemId(id); setHighlight(id); setStep("item"); },
    onCamera: () => setStep("camera"),
  };

  return (
    <DemoBlock
      id="flujo-almacenamiento"
      title="Flujo: almacenamiento"
      description="Inventario es una de las estrellas de la app: se recorre sin perderse y la cámara encuentra cosas de verdad. Decisiones: el inicio se ve como cada perfil elige (Lugares, Plano, Lista o Tarjetas, recordado por perfil); cada recinto tiene su página; en un recinto, un contenedor o una ficha, la ruta tocable (PathCrumbs) reemplaza al eyebrow; el contenedor muestra primero lo que tiene, sección por sección (compartimentos, productos, anotaciones, fotos), y agregar es siempre un botón de su sección; un contenedor vacío tiene un solo EmptyState; llegar con ?item= abre la ficha y resalta la fila; la cámara tiene Escanear QR, Buscar (varias etiquetas a la vez, con burbujas tocables) y AR espacial como experimental. Probá: elegí otra vista, entrá al Taller, buscá “cables” o tocá una burbuja."
      code={`
// Inicio: la vista se guarda por perfil.
const { inventoryView } = usePreferences();
<SectionHeader title={t("storage.yourPlaces")} extra={<ViewSwitcher label={t("storage.views.label")} value={inventoryView} options={options.inventory} onChange={(view) => setPreference("inventoryView", view)} />} />
{inventoryView === "places" && <PlacesView spaces={spaces} />}   // también PlanView, ListView, CardsView

// Página anidada: ruta tocable + escena que se abre.
<PageHeader crumbs={<PathCrumbs items={[{ label: "Inventario", href: "/inventario", icon: Boxes }, { label: space.name, href: spaceHref(space.id) }, { label: container.name }]} />}
  leading={<ContainerScene container={container} compact open />} title={container.name} />

// Cada sección con su botón de agregar.
<SectionHeader icon={Boxes} title={t("storage.contents.inventory")} extra={<Button type="primary" icon={<Plus />}>{t("inventory.form.title")}</Button>} />
<InventoryList containerId={id} onOpen={open} highlightId={params.get("item")} />

// Cámara: una burbuja por etiqueta a la vista.
<CameraViewport videoRef={videoRef} active={active} detections={bubbles} controls={<CameraControls … />} />
`}
    >
      <FlowFrame<Step>
        steps={[
          { value: "inventory", label: "1 · Inventario" },
          { value: "space", label: "2 · Recinto" },
          { value: "container", label: "3 · Contenedor" },
          { value: "item", label: "4 · Ficha" },
          { value: "camera", label: "5 · Cámara" },
        ]}
        step={step}
        onStep={setStep}
        status="adopted"
        screenKey={step === "container" ? `container:${containerId}` : step === "space" ? `space:${spaceId}` : step === "item" ? `item:${itemId}` : step}
      >
        {step === "inventory" && <InventoryScreen go={go} />}
        {step === "space" && <SpaceScreen id={spaceId} go={go} />}
        {step === "container" && <ContainerScreen key={containerId} id={containerId} highlight={highlight} go={go} />}
        {step === "item" && <ItemScreen key={itemId} id={itemId} go={go} />}
        {step === "camera" && <CameraScreen go={go} />}
      </FlowFrame>
    </DemoBlock>
  );
}
