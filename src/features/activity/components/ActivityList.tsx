"use client";

import { formatQuantity } from "@/features/inventory/format";

import { Button, Flex, Skeleton, Tag, Typography, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, BellOff, ChefHat, ListPlus, MoveRight, PackageMinus, Pencil, Plus, RotateCcwClock, ShoppingBag, Tag as PriceTag, Trash2, Undo2, type LucideIcon } from "lucide-react";
import { Fragment } from "react";
import { EmptyState } from "@/components/ui";

import { useInventoryActions } from "@/features/inventory/hooks";
import { useNow } from "@/hooks/useNow";
import { useI18n } from "@/i18n";
import { SPRING } from "@/lib/motion";
import { usePermission } from "@/lib/auth/hooks";
import { isUndoable, type ActivityEntry } from "../domain";

const DAY = 86_400_000;

function startOfDay(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

interface ActivityListProps {
  entries: ActivityEntry[] | undefined;
  /** Muestra dónde ocurrió cada acción (para el historial de toda la casa). */
  showPlace?: boolean;
}

/** Línea de tiempo agrupada por día. Las entradas nuevas aparecen arriba con animación. */
export function ActivityList({ entries, showPlace = false }: ActivityListProps) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const now = useNow();
  const { undo } = useInventoryActions();
  const canUndo = usePermission("inventory.adjust");

  if (!entries) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (entries.length === 0) {
    return <EmptyState icon={RotateCcwClock} title={t("activity.empty")} description={t("activity.emptyText")} />;
  }

  const today = startOfDay(now);
  const dayLabel = (day: number) =>
    day === today
      ? t("common.today")
      : day === today - DAY
        ? t("common.yesterday")
        : format.date(day, { weekday: "long", day: "numeric", month: "long" });


  const describe = (entry: ActivityEntry) => {
    const params = { actor: entry.actorName, name: entry.entityName, place: entry.place ?? "" };
    if (entry.module === "prices") {
      const amount = format.money(entry.amountCents ?? 0, entry.currency ?? "ARS");
      const store = entry.store ? ` ${t("prices.atStore", { store: entry.store })}` : "";
      return t("activity.prices.price", { ...params, amount: `${amount}${store}` });
    }
    if (entry.module === "members" || entry.module === "calendar") {
      return t(`activity.${entry.module}.${entry.action as "create" | "update" | "delete"}`, params);
    }
    if (entry.module === "storage") {
      return t(`activity.storage.${entry.action as "create" | "update" | "move" | "delete"}`, params);
    }
    if (entry.module === "lists" || entry.module === "projects") {
      return t(`activity.${entry.module}.${entry.action as "create" | "update" | "delete"}`, params);
    }
    if (entry.module === "recipes") {
      return t(`activity.recipes.${entry.action as "create" | "update" | "delete" | "cooked"}`, params);
    }
    if (entry.module === "shopping") {
      const quantity = entry.to ? ` (${formatQuantity(t, entry.to, entry.unit, format.number)})` : "";
      return t(`activity.shopping.${entry.action as "create" | "bought" | "dismiss" | "delete"}`, params) + quantity;
    }
    if (entry.action === "adjust" || entry.action === "consume" || entry.action === "restock" || entry.action === "undo") {
      return t(`activity.inventory.${entry.action}`, { ...params, from: entry.from ?? 0, to: formatQuantity(t, entry.to ?? 0, entry.unit, format.number) });
    }
    return t(`activity.inventory.${entry.action as "create" | "update" | "move" | "delete"}`, params);
  };

  const visual = (entry: ActivityEntry): { Icon: LucideIcon; color: string; bg: string } => {
    switch (entry.action) {
      case "create":
        return entry.module === "shopping"
          ? { Icon: ListPlus, color: token.colorPrimary, bg: token.colorPrimaryBg }
          : { Icon: Plus, color: token.colorSuccess, bg: token.colorSuccessBg };
      case "delete":
        return { Icon: Trash2, color: token.colorError, bg: token.colorErrorBg };
      case "price":
        return { Icon: PriceTag, color: token.colorWarning, bg: token.colorWarningBg };
      case "move":
        return { Icon: MoveRight, color: token.colorInfo, bg: token.colorInfoBg };
      case "update":
        return { Icon: Pencil, color: token.colorTextSecondary, bg: token.colorFillTertiary };
      case "consume":
        return { Icon: PackageMinus, color: token.colorWarning, bg: token.colorWarningBg };
      case "restock":
      case "bought":
        return { Icon: ShoppingBag, color: token.colorSuccess, bg: token.colorSuccessBg };
      case "undo":
        return { Icon: Undo2, color: token.colorTextSecondary, bg: token.colorFillTertiary };
      case "cooked":
        return { Icon: ChefHat, color: token.colorWarning, bg: token.colorWarningBg };
      case "dismiss":
        return { Icon: BellOff, color: token.colorTextSecondary, bg: token.colorFillTertiary };
      default: {
        const up = (entry.to ?? 0) >= (entry.from ?? 0);
        return { Icon: up ? ArrowUp : ArrowDown, color: token.colorPrimary, bg: token.colorPrimaryBg };
      }
    }
  };

  return (
    <Flex vertical>
      <AnimatePresence initial={false}>
        {entries.map((entry, index) => {
          const day = startOfDay(entry.at);
          const showDay = index === 0 || startOfDay(entries[index - 1].at) !== day;
          const { Icon, color, bg } = visual(entry);

          return (
            <Fragment key={entry.id}>
              {showDay && (
                <Typography.Text
                  type="secondary"
                  strong
                  style={{ fontSize: token.fontSizeSM, textTransform: "uppercase", letterSpacing: "0.08em", margin: "12px 0 4px" }}
                >
                  {dayLabel(day)}
                </Typography.Text>
              )}
              <motion.div layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING.snappy}>
                <Flex gap={12} align="flex-start" style={{ paddingBlock: 8 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 28,
                      height: 28,
                      flexShrink: 0,
                      borderRadius: "50%",
                      background: bg,
                      color,
                      fontSize: token.fontSize,
                    }}
                  >
                    <Icon />
                  </span>
                  <Flex vertical gap={2} style={{ minWidth: 0, flex: 1 }}>
                    <Typography.Text delete={entry.undoneAt !== undefined} type={entry.undoneAt !== undefined ? "secondary" : undefined}>
                      {describe(entry)}
                    </Typography.Text>
                    <Flex gap={8} align="center" wrap>
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: token.fontSizeSM }}
                        title={format.date(entry.at, { dateStyle: "full", timeStyle: "short" })}
                      >
                        {format.relative(entry.at, now)}
                      </Typography.Text>
                      {showPlace && entry.place && (
                        <Tag variant="filled" style={{ margin: 0 }}>
                          {entry.place}
                        </Tag>
                      )}
                      {entry.undoneAt !== undefined && (
                        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                          {t("activity.undoneBy", { name: entry.undoneBy ?? "" })}
                        </Typography.Text>
                      )}
                    </Flex>
                  </Flex>
                  {canUndo && isUndoable(entry, now) && (
                    <Button size="small" type="text" icon={<Undo2 />} onClick={() => undo(entry.id)} style={{ flexShrink: 0, color: token.colorTextSecondary }}>
                      {t("activity.undo")}
                    </Button>
                  )}
                </Flex>
              </motion.div>
            </Fragment>
          );
        })}
      </AnimatePresence>
    </Flex>
  );
}
