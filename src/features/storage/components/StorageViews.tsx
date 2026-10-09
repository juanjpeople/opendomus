"use client";

import { Button, Card, Dropdown, Flex, Grid, Select, Tooltip, Typography, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, EllipsisVertical, LayoutGrid, LayoutList, MapPinned, Pencil, Plus, Printer, SquareDashed, Trash2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Stagger, StaggerItem } from "@/components/motion";
import { FilterChips, IconTile, ListRow, PlaceCard, RoomFloor, type FloorPattern, type ViewOption } from "@/components/ui";
import { useT } from "@/i18n";
import { tint } from "@/lib/appearance";
import { DURATION, SPRING } from "@/lib/motion";
import { containerHref, spaceHref } from "@/lib/navigation/routes";
import type { InventoryView, SpaceView } from "@/lib/preferences";
import { containerAppearance, spaceAppearance, type Space, type SpaceKind } from "../domain";
import type { ContainerOverview, SpaceOverview } from "../hooks";
import { entryPath, flattenOverview, listRows, placeShortcuts, sortEntries, spaceTotals, type ContainerSort } from "../views";
import type { LabelData } from "./ContainerLabel";
import { AddTile, ContainerTile, StockBar, useContainerSummary } from "./ContainerTiles";

export const FLOOR: Record<SpaceKind, FloorPattern> = {
  kitchen: "tiles", bathroom: "tiles", bedroom: "boards", living: "boards", garden: "diagonal",
  workshop: "dots", shed: "dots", garage: "dots", other: "dots",
};

const VIEW_ICONS: Record<InventoryView, LucideIcon> = { places: MapPinned, plan: SquareDashed, list: LayoutList, cards: LayoutGrid };

/** Opciones del selector de vista. Dentro de un recinto no hay "Lugares": ya estás en uno. */
export function useViewOptions(): { inventory: ViewOption<InventoryView>[]; space: ViewOption<SpaceView>[] } {
  const t = useT();
  const option = <T extends InventoryView>(value: T): ViewOption<T> => ({ value, label: t(`storage.views.${value}`), icon: VIEW_ICONS[value] });
  return {
    inventory: [option("places"), option("plan"), option("list"), option("cards")],
    space: [option("plan"), option("list"), option("cards")],
  };
}

/** Lo que cada vista puede pedir. Sin una acción, su botón no aparece (permisos, o /design). */
export interface StorageViewActions {
  onLabels?: (labels: LabelData[]) => void;
  onAddContainer?: (spaceId: string) => void;
  onEditSpace?: (space: Space) => void;
  onDeleteSpace?: (space: Space) => void;
}

/** Etiqueta de un contenedor: abajo del nombre, dónde está ("Cocina › Alacena"). */
export function labelOf(container: { id: string; name: string; code: string }, path: string): LabelData {
  return { id: container.id, name: container.name, code: container.code, spaceName: path };
}

function useTotalsText() {
  const t = useT();
  return (space: SpaceOverview) => {
    const totals = spaceTotals(space);
    return `${t("storage.containerCount", { count: totals.containers })} · ${t("storage.itemCount", { count: totals.items })}`;
  };
}

const grid = (min: number): CSSProperties => ({ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))` });

// ── Lugares ─────────────────────────────────────────────────────────────────────────────────

/** Una tarjeta por recinto con su mini plano: el inicio más rápido para encontrar algo. */
export function PlacesView({ spaces }: { spaces: SpaceOverview[] }) {
  const t = useT();
  const { token } = theme.useToken();
  const totalsText = useTotalsText();

  return (
    <Stagger stagger={0.06} style={{ ...grid(token.controlHeightLG * 7), gap: token.marginLG }}>
      {spaces.map((space) => {
        const { color, Icon } = spaceAppearance(space);
        const { attention } = spaceTotals(space);
        const { shown, more } = placeShortcuts(space);
        return (
          <StaggerItem key={space.id} style={{ height: "100%" }}>
            <PlaceCard
              href={spaceHref(space.id)}
              title={space.name}
              icon={Icon}
              color={color}
              floor={FLOOR[space.kind]}
              meta={totalsText(space)}
              shortcuts={shown.map((container) => {
                const appearance = containerAppearance(container);
                const alert = container.needsAttention > 0;
                return {
                  key: container.id,
                  href: containerHref(container.id),
                  name: container.name,
                  label: alert ? `${container.name} · ${t("storage.attention", { count: container.needsAttention })}` : container.name,
                  icon: appearance.Icon,
                  color: appearance.color,
                  alert,
                };
              })}
              more={{ count: more, label: t("storage.moreContainers", { count: more, name: space.name }) }}
              empty={t("storage.noContainers")}
              status={attention > 0 ? { tone: "warning", text: t("storage.attention", { count: attention }) } : { tone: "success", text: t("storage.allGood") }}
            />
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}

// ── Plano ───────────────────────────────────────────────────────────────────────────────────

/** Los recintos como ambientes de su color, con sus muebles apoyados en el piso. */
export function PlanView({ spaces, actions = {}, single = false }: { spaces: SpaceOverview[]; actions?: StorageViewActions; single?: boolean }) {
  const { token } = theme.useToken();
  if (single && spaces[0]) return <SpacePlan space={spaces[0]} actions={actions} bare />;
  return (
    <Stagger stagger={0.08} style={{ columnWidth: token.controlHeightLG * 10, columnGap: token.marginLG }}>
      {spaces.map((space) => (
        <StaggerItem key={space.id} style={{ breakInside: "avoid", marginBottom: token.marginLG }}>
          <SpacePlan space={space} actions={actions} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/** Un ambiente del plano. \`bare\`: dentro de la página del recinto, sin repetir su encabezado. */
function SpacePlan({ space, actions, bare = false }: { space: SpaceOverview; actions: StorageViewActions; bare?: boolean }) {
  const t = useT();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const totalsText = useTotalsText();
  const { color, Icon } = spaceAppearance(space);
  const palette = tint(token, color);
  const { onLabels, onAddContainer, onEditSpace, onDeleteSpace } = actions;
  const path = (container: ContainerOverview) => labelOf(container, space.name);
  const menu = [
    ...(onEditSpace ? [{ key: "edit", icon: <Pencil />, label: t("storage.editSpace"), onClick: () => onEditSpace(space) }] : []),
    ...(onDeleteSpace ? [{ type: "divider" as const }, { key: "delete", danger: true, icon: <Trash2 />, label: t("storage.delete"), onClick: () => onDeleteSpace(space) }] : []),
  ];

  const floor = (
    <RoomFloor pattern={FLOOR[space.kind]} color={color}>
      {space.containers.map((container) => (
        <ContainerTile key={container.id} container={container} onLabel={onLabels ? () => onLabels([path(container)]) : undefined} />
      ))}
      {space.containers.length === 0 && (onAddContainer ? (
        <div style={{ gridColumn: "1 / -1" }}>
          <AddTile color={palette.solid} label={t("storage.addContainer")} onClick={() => onAddContainer(space.id)} />
        </div>
      ) : (
        <Typography.Text type="secondary" style={{ gridColumn: "1 / -1", padding: token.paddingSM }}>
          {t("storage.noContainers")}
        </Typography.Text>
      ))}
    </RoomFloor>
  );

  if (bare) return floor;

  return (
    <section
      aria-label={space.name}
      style={{
        padding: token.padding,
        borderRadius: token.borderRadiusLG * 2,
        border: `1px solid ${palette.border}`,
        background: `linear-gradient(160deg, ${palette.bg} 0%, ${token.colorBgContainer} 55%)`,
        boxShadow: token.boxShadowTertiary,
      }}
    >
      <Flex align="center" justify="space-between" gap={token.marginSM} wrap style={{ marginBottom: token.margin }}>
        <Link href={spaceHref(space.id)} className="od-focusable" style={{ "--od-ring": palette.solid, color: "inherit", minWidth: 0, flex: `1 1 ${token.controlHeight * 6}px`, borderRadius: token.borderRadiusLG } as CSSProperties}>
          <Flex align="center" gap={token.marginSM}>
            <IconTile icon={Icon} color={color} size={token.controlHeightLG + token.paddingXXS} solid />
            <div style={{ minWidth: 0 }}>
              <Typography.Title level={4} style={{ margin: 0, letterSpacing: "-0.02em", overflowWrap: "anywhere" }}>
                {space.name}
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {totalsText(space)}
              </Typography.Text>
            </div>
          </Flex>
        </Link>
        <Flex gap={token.marginXXS} style={{ flexShrink: 0 }}>
          {onAddContainer && (
            <Tooltip title={screens.sm ? undefined : t("storage.addContainer")}>
              <Button type="text" icon={<Plus />} aria-label={t("storage.addContainer")} onClick={() => onAddContainer(space.id)} style={{ minHeight: token.controlHeightLG + token.paddingXXS }}>
                {screens.sm && t("storage.add")}
              </Button>
            </Tooltip>
          )}
          {onLabels && space.containers.length > 0 && (
            <Tooltip title={t("storage.printLabels")}>
              <Button type="text" icon={<Printer />} aria-label={t("storage.printLabelsOf", { name: space.name })} onClick={() => onLabels(space.containers.map(path))} style={{ minWidth: token.controlHeightLG + token.paddingXXS, minHeight: token.controlHeightLG + token.paddingXXS }} />
            </Tooltip>
          )}
          {menu.length > 0 && (
            <Dropdown trigger={["click"]} menu={{ items: menu }}>
              <Button type="text" icon={<EllipsisVertical />} aria-label={t("storage.spaceActions", { name: space.name })} style={{ minWidth: token.controlHeightLG + token.paddingXXS, minHeight: token.controlHeightLG + token.paddingXXS }} />
            </Dropdown>
          )}
        </Flex>
      </Flex>
      {floor}
    </section>
  );
}

// ── Lista ───────────────────────────────────────────────────────────────────────────────────

/** Árbol recinto › contenedor › compartimento: la vista densa para recorrer todo rápido. */
export function ListView({ spaces, single = false }: { spaces: SpaceOverview[]; single?: boolean }) {
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <Stagger stagger={0.06}>
      <Flex vertical gap={token.marginLG}>
        {spaces.map((space) => (
          <StaggerItem key={space.id}>
            <SpaceList space={space} collapsed={collapsed} onToggle={toggle} single={single} />
          </StaggerItem>
        ))}
      </Flex>
    </Stagger>
  );
}

function SpaceList({ space, collapsed, onToggle, single }: { space: SpaceOverview; collapsed: ReadonlySet<string>; onToggle: (id: string) => void; single: boolean }) {
  const t = useT();
  const { token } = theme.useToken();
  const totalsText = useTotalsText();
  const summary = useContainerSummary();
  const { color, Icon } = spaceAppearance(space);
  const rows = listRows(space, collapsed);
  const indent = token.marginLG;

  return (
    <Card styles={{ body: { padding: 0 } }}>
      {!single && (
        <ListRow
          href={spaceHref(space.id)}
          openLabel={space.name}
          leading={<IconTile icon={Icon} color={color} size={token.controlHeight + token.paddingXS} solid />}
          title={space.name}
          meta={totalsText(space)}
          divider={rows.length > 0}
        />
      )}
      {rows.length === 0 && (
        <Typography.Paragraph type="secondary" style={{ margin: 0, padding: `${token.paddingSM}px ${token.paddingLG}px` }}>
          {t("storage.noContainers")}
        </Typography.Paragraph>
      )}
      <AnimatePresence initial={false}>
        {rows.map((row, index) => {
          const appearance = containerAppearance(row.container);
          return (
            <ListRow
              key={row.container.id}
              index={index}
              divider={index < rows.length - 1}
              href={containerHref(row.container.id)}
              openLabel={row.container.name}
              leading={
                <Flex align="center" style={{ paddingInlineStart: (row.depth - 1 + (single ? 0 : 1)) * indent }}>
                  <IconTile icon={appearance.Icon} color={appearance.color} size={token.controlHeight} />
                </Flex>
              }
              title={row.container.name}
              meta={summary(row.container) || undefined}
              trailing={
                <>
                  {row.container.itemCount > 0 && (
                    <div style={{ width: token.controlHeightLG * 2 }}>
                      <StockBar ok={row.container.itemCount - row.container.needsAttention} low={row.container.low} empty={row.container.empty} />
                    </div>
                  )}
                  {row.expandable && (
                    <Button
                      type="text"
                      aria-expanded={row.expanded}
                      aria-label={t(row.expanded ? "storage.hideChildren" : "storage.showChildren", { name: row.container.name })}
                      onClick={() => onToggle(row.container.id)}
                      style={{ minWidth: token.controlHeightLG + token.paddingXXS, minHeight: token.controlHeightLG + token.paddingXXS }}
                      icon={
                        <motion.span animate={{ rotate: row.expanded ? 0 : -90 }} transition={SPRING.snappy} style={{ display: "inline-flex" }}>
                          <ChevronDown />
                        </motion.span>
                      }
                    />
                  )}
                </>
              }
            />
          );
        })}
      </AnimatePresence>
    </Card>
  );
}

// ── Tarjetas ────────────────────────────────────────────────────────────────────────────────

/** Todos los contenedores, también los anidados, como fichas: filtro por recinto y orden. */
export function CardsView({ spaces, actions = {}, single = false }: { spaces: SpaceOverview[]; actions?: StorageViewActions; single?: boolean }) {
  const t = useT();
  const { token } = theme.useToken();
  const [spaceId, setSpaceId] = useState<string>("all");
  const [sort, setSort] = useState<ContainerSort>("name");
  const entries = sortEntries(flattenOverview(spaces).filter((entry) => spaceId === "all" || entry.space.id === spaceId), sort);

  return (
    <Flex vertical gap={token.margin}>
      <Flex gap={token.marginSM} wrap align="center" justify="space-between">
        {!single && spaces.length > 1 ? (
          <FilterChips<string>
            label={t("storage.filterBySpace")}
            value={spaceId}
            onChange={setSpaceId}
            options={[
              { value: "all", label: t("storage.allSpaces") },
              ...spaces.map((space) => {
                const { color, Icon } = spaceAppearance(space);
                return { value: space.id, label: space.name, color, icon: <Icon /> };
              }),
            ]}
          />
        ) : <span />}
        <Select<ContainerSort>
          aria-label={t("storage.sort.label")}
          value={sort}
          onChange={setSort}
          style={{ minWidth: token.controlHeightLG * 5 }}
          options={(["name", "items", "alerts"] as const).map((value) => ({ value, label: t(`storage.sort.${value}`) }))}
        />
      </Flex>
      <Stagger key={`${spaceId}:${sort}`} stagger={0.03} style={{ ...grid(token.controlHeightLG * 4), gap: token.marginSM }}>
        {entries.map((entry) => (
          <StaggerItem key={entry.container.id} style={{ height: "100%" }}>
            <ContainerTile
              container={entry.container}
              meta={single && entry.ancestors.length === 0 ? undefined : entryPath(entry)}
              onLabel={actions.onLabels ? () => actions.onLabels?.([labelOf(entry.container, entryPath(entry))]) : undefined}
            />
          </StaggerItem>
        ))}
      </Stagger>
    </Flex>
  );
}

/** Cambia de vista con un fundido corto: el contenido nuevo entra en cascada por su cuenta. */
export function ViewStage({ view, children }: { view: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: DURATION.fast }}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
