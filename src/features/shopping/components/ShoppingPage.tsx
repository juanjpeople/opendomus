"use client";

import { formatQuantity, formatUnit } from "@/features/inventory/format";

import { App, Button, Card, Col, Dropdown, Flex, Grid, Progress, Row, Tag, Tooltip, Typography, theme } from "antd";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Archive, ArchiveRestore, ArrowLeftRight, ClipboardList, Ellipsis, Eraser, FolderOpen, MapPin, Pencil, ShoppingBag, ShoppingBasket, Trash2, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { AnimatedNumber, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { EmptyState, IconTile, PageHeader, QuantityStepper, LoadingSkeleton } from "@/components/ui";

import type { Currency } from "@/features/prices/domain";
import { useI18n } from "@/i18n";
import { APPEARANCE_ICONS } from "@/lib/appearance";
import { usePermission } from "@/lib/auth/hooks";
import { SPRING } from "@/lib/motion";
import { HOME_LIST_ID, SHOPPING_LIMITS, type ListBudget, type ShoppingList } from "../domain";
import { listName, useListSummaries, useShoppingActions, useShoppingData, type ListSummary, type ShoppingRow } from "../hooks";
import { BudgetBar } from "./BudgetBar";
import { CheckCircle } from "./CheckCircle";
import { ListModal } from "./ListModal";
import { ListSwitcher } from "./ListSwitcher";
import { QuickAdd } from "./QuickAdd";
import { EstimatePrice, QuickPrice } from "./QuickPrice";
import { ReviewPanel } from "./ReviewPanel";
import { projectHref } from "@/lib/navigation/routes";

export function ShoppingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { modal } = App.useApp();
  const listId = useSearchParams().get("lista") ?? HOME_LIST_ID;
  const lists = useListSummaries();
  const data = useShoppingData(listId);
  const canManage = usePermission("shopping.manage");
  const { clearBought, archiveList, deleteList } = useShoppingActions();
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);

  const select = (id: string) => router.replace(id === HOME_LIST_ID ? "/compras" : `/compras?lista=${id}`, { scroll: false });

  if (data === null) {
    return (
      <Card>
        <EmptyState icon={ClipboardList} title={t("errors.notFound.list")} action={<Button onClick={() => select(HOME_LIST_ID)}>{t("shopping.lists.backHome")}</Button>} />
      </Card>
    );
  }

  const list = data?.list;
  const home = listId === HOME_LIST_ID;
  const summary = lists?.find((entry) => entry.list.id === listId);
  const hasCandidates = (data?.candidates.length ?? 0) > 0;

  const listActions = list
    ? [
        ...(!home
          ? [
              list.archivedAt
                ? { key: "unarchive", icon: <ArchiveRestore />, label: t("shopping.lists.unarchive"), onClick: () => archiveList(list.id, false) }
                : { key: "archive", icon: <Archive />, label: t("shopping.lists.archive"), onClick: () => archiveList(list.id, true) },
            ]
          : []),
        ...((data?.bought.length ?? 0) > 0
          ? [{ key: "clear", icon: <Eraser />, label: t("shopping.clear"), onClick: () => modal.confirm({ title: t("shopping.clearConfirm"), okText: t("shopping.clear"), cancelText: t("common.cancel"), onOk: () => clearBought(list.id) }) }]
          : []),
        ...(!home
          ? [
              { type: "divider" as const },
              {
                key: "delete",
                icon: <Trash2 />,
                danger: true,
                label: t("shopping.lists.delete"),
                onClick: () =>
                  modal.confirm({
                    title: t("shopping.lists.deleteConfirm", { name: listName(list, t) }),
                    content: t("shopping.lists.deleteText"),
                    okText: t("shopping.lists.delete"),
                    okButtonProps: { danger: true },
                    cancelText: t("common.cancel"),
                    onOk: async () => {
                      if ((await deleteList(list.id)) !== null) select(HOME_LIST_ID);
                    },
                  }),
              },
            ]
          : []),
      ]
    : [];

  return (
    <RequirePermission perform="shopping.view">
      <PageHeader
        eyebrow={
          summary?.project ? (
            <Link href={projectHref(summary.project.id)} style={{ color: "inherit" }}>
              {t("shopping.eyebrow")} · {summary.project.name}
            </Link>
          ) : (
            t("shopping.eyebrow")
          )
        }
        title={
          list ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <IconTile icon={APPEARANCE_ICONS[list.icon]} color={list.color} size={40} />
              {listName(list, t)}
              {list.archivedAt && <Tag style={{ marginInlineStart: 4 }}>{t("shopping.lists.archived")}</Tag>}
            </span>
          ) : (
            t("shopping.title")
          )
        }
        description={home ? t("shopping.description") : t("shopping.lists.description")}
        extra={
          list &&
          canManage && (
            <>
              <Tooltip title={t("shopping.lists.edit")}>
                <Button icon={<Pencil />} aria-label={t("shopping.lists.edit")} onClick={() => setDialog("edit")} />
              </Tooltip>
              {listActions.length > 0 && (
                <Dropdown menu={{ items: listActions }} trigger={["click"]} placement="bottomRight">
                  <Button icon={<Ellipsis />} aria-label={t("shopping.lists.more")} />
                </Dropdown>
              )}
            </>
          )
        }
      />

      {lists && <ListSwitcher lists={lists} selectedId={listId} onSelect={select} onCreate={canManage ? () => setDialog("create") : undefined} />}

      {!data || !list ? (
        <LoadingSkeleton />
      ) : (
        <>
          <Summary pending={data.pending.length} budget={data.budget} review={home ? data.candidates.length : undefined} />
          <Row gutter={[24, 24]}>
            {/* En el celular, si hay algo para revisar va primero: es lo que pide una decisión. */}
            <Col xs={{ span: 24, order: hasCandidates ? 2 : 1 }} lg={{ span: 15, order: 1 }}>
              {canManage && !list.archivedAt && (
                <Reveal delay={0.1}>
                  <QuickAdd key={list.id} listId={list.id} />
                </Reveal>
              )}
              <Reveal delay={0.15}>
                <ListCard list={list} lists={lists ?? []} pending={data.pending} bought={data.bought} />
              </Reveal>
            </Col>
            <Col xs={{ span: 24, order: hasCandidates ? 1 : 2 }} lg={{ span: 9, order: 2 }}>
              <Reveal delay={0.2} style={{ position: "sticky", top: 88 }}>
                <Flex vertical gap={16}>
                  {home && <ReviewPanel candidates={data.candidates} />}
                  {(!home || data.budget.budgetCents !== undefined) && <BudgetCard summary={summary} budget={data.budget} onEdit={canManage ? () => setDialog("edit") : undefined} />}
                </Flex>
              </Reveal>
            </Col>
          </Row>
        </>
      )}

      <ListModal open={dialog === "create"} onClose={() => setDialog(null)} onSaved={select} />
      <ListModal open={dialog === "edit"} list={list ?? undefined} onClose={() => setDialog(null)} />
    </RequirePermission>
  );
}

// --- Resumen y presupuesto -----------------------------------------------------------

function Summary({ pending, budget, review }: { pending: number; budget: ListBudget; review?: number }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const money = (cents: number) => format.money(cents, budget.currency);

  return (
    <Stagger delay={0.05}>
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col xs={12} md={8}>
          <SummaryTile icon={ShoppingBasket} label={t("shopping.summary.pending")}>
            <AnimatedNumber value={pending} />
          </SummaryTile>
        </Col>
        <Col xs={12} md={8}>
          {review !== undefined ? (
            <SummaryTile icon={ClipboardList} label={t("shopping.summary.review")} tone={review > 0 ? token.colorWarning : undefined}>
              <AnimatedNumber value={review} />
            </SummaryTile>
          ) : (
            <SummaryTile icon={ShoppingBag} label={t("shopping.budget.spent")}>
              {money(budget.spentCents)}
            </SummaryTile>
          )}
        </Col>
        <Col xs={24} md={8}>
          <SummaryTile
            icon={Wallet}
            label={t("shopping.summary.total")}
            tone={budget.remainingCents !== undefined && budget.remainingCents < 0 ? token.colorError : undefined}
            hint={
              budget.budgetCents !== undefined
                ? t("shopping.summary.ofBudget", { budget: money(budget.budgetCents) })
                : budget.unpriced > 0
                  ? t("shopping.summary.unpriced", { count: budget.unpriced })
                  : undefined
            }
          >
            {budget.totalCents > 0 ? money(budget.totalCents) : "—"}
          </SummaryTile>
        </Col>
      </Row>
    </Stagger>
  );
}

function SummaryTile({ icon: Icon, label, hint, tone, children }: { icon: LucideIcon; label: string; hint?: string; tone?: string; children: ReactNode }) {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();

  return (
    <StaggerItem
      style={{
        height: "100%",
        padding: screens.sm ? "14px 18px" : "12px 14px",
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
      }}
    >
      <Flex align="center" gap={8}>
        <span style={{ display: "inline-flex", color: tone ?? token.colorTextTertiary }}>
          <Icon />
        </span>
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {label}
        </Typography.Text>
      </Flex>
      <div style={{ fontSize: token.fontSizeHeading3, fontWeight: 600, letterSpacing: "-0.02em", color: tone }}>{children}</div>
      {hint && (
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {hint}
        </Typography.Text>
      )}
    </StaggerItem>
  );
}

function BudgetCard({ summary, budget, onEdit }: { summary?: ListSummary; budget: ListBudget; onEdit?: () => void }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const money = (cents: number) => format.money(cents, budget.currency);

  return (
    <Card
      title={t("shopping.budget.title")}
      extra={
        onEdit && (
          <Button type="link" size="small" onClick={onEdit} style={{ paddingInline: 0 }}>
            {budget.budgetCents === undefined ? t("shopping.budget.set") : t("shopping.budget.edit")}
          </Button>
        )
      }
    >
      <Flex vertical gap={14}>
        <BudgetBar currency={budget.currency} spentCents={budget.spentCents} pendingCents={budget.pendingCents + budget.boughtEstimateCents} budgetCents={budget.budgetCents} />
        <Flex vertical gap={6} style={{ fontSize: token.fontSizeSM }}>
          <BudgetLine label={t("shopping.budget.spentDetail")} value={money(budget.spentCents)} />
          {budget.boughtEstimateCents > 0 && <BudgetLine label={t("shopping.budget.boughtEstimate")} value={`≈ ${money(budget.boughtEstimateCents)}`} />}
          <BudgetLine label={t("shopping.budget.pendingDetail")} value={`≈ ${money(budget.pendingCents)}`} />
          <BudgetLine label={t("shopping.budget.total")} value={money(budget.totalCents)} strong />
        </Flex>
        {budget.unpriced > 0 && (
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {t("shopping.budget.unpricedHint", { count: budget.unpriced })}
          </Typography.Text>
        )}
        {summary?.project && (
          <Link href={projectHref(summary.project.id)}>
            <Button block icon={<FolderOpen />}>
              {t("shopping.lists.openProject", { name: summary.project.name })}
            </Button>
          </Link>
        )}
      </Flex>
    </Card>
  );
}

function BudgetLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <Flex justify="space-between" gap={8}>
      <Typography.Text type="secondary" style={{ fontSize: "inherit" }}>
        {label}
      </Typography.Text>
      <Typography.Text strong={strong} style={{ fontSize: "inherit" }}>
        {value}
      </Typography.Text>
    </Flex>
  );
}

// --- Lista ----------------------------------------------------------------------

function ListCard({ list, lists, pending, bought }: { list: ShoppingList; lists: ListSummary[]; pending: ShoppingRow[]; bought: ShoppingRow[] }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const total = pending.length + bought.length;
  const home = list.id === HOME_LIST_ID;
  const days = SHOPPING_LIMITS.boughtVisibleMs / 86_400_000;
  const targets = lists.filter((summary) => summary.list.id !== list.id && !summary.list.archivedAt).map((summary) => summary.list);

  return (
    <Card
      title={t("shopping.list.title")}
      extra={
        total > 0 && (
          <Tooltip title={home ? t("shopping.list.progressHint", { days }) : undefined}>
            <Flex align="center" gap={8} style={{ minWidth: 120 }}>
              <Progress percent={(bought.length / total) * 100} showInfo={false} size="small" strokeColor={token.colorSuccess} style={{ margin: 0, width: 80 }} />
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, whiteSpace: "nowrap" }}>
                {bought.length}/{total}
              </Typography.Text>
            </Flex>
          </Tooltip>
        )
      }
      styles={{ body: { padding: 0 } }}
      // Las filas tienen fondo propio: sin esto taparían las esquinas redondeadas.
      style={{ overflow: "hidden" }}
    >
      {total === 0 && <EmptyState icon={ShoppingBasket} title={t("shopping.list.emptyTitle")} description={home ? t("shopping.list.emptyText") : t("shopping.list.emptyTextList")} />}

      {/* LayoutGroup: al marcar, la fila viaja de "Por comprar" a "En la bolsa" en vez de saltar. */}
      <LayoutGroup>
        <AnimatePresence initial={false}>
          {pending.map((row) => (
            <RowItem key={row.id} row={row} currency={list.currency} targets={targets} />
          ))}
        </AnimatePresence>

        {pending.length === 0 && bought.length > 0 && (
          <Flex align="center" gap={12} style={{ padding: "20px 24px" }}>
            <IconTile icon={ShoppingBag} color="green" size={40} />
            <Typography.Text strong>{t("shopping.list.allDone")}</Typography.Text>
          </Flex>
        )}

        {bought.length > 0 && (
          <motion.div layout="position" style={{ padding: "16px 24px 4px", borderTop: `1px solid ${token.colorBorderSecondary}`, background: token.colorFillQuaternary }}>
            <Typography.Text type="secondary" strong style={{ fontSize: token.fontSizeSM, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {t("shopping.list.bought", { count: bought.length })}
            </Typography.Text>
          </motion.div>
        )}
        <AnimatePresence initial={false}>
          {bought.map((row) => (
            <RowItem key={row.id} row={row} currency={list.currency} targets={targets} />
          ))}
        </AnimatePresence>
      </LayoutGroup>
    </Card>
  );
}

function RowItem({ row, currency, targets }: { row: ShoppingRow; currency: Currency; targets: ShoppingList[] }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const canManage = usePermission("shopping.manage");
  const { buy, unbuy, setQuantity, remove, move } = useShoppingActions();
  const done = row.status === "bought";
  const unit = (count: number) => (formatUnit(t, count, row.unit));
  // Precio conocido en la moneda de la lista (si es de otra, no se mezcla: se puede estimar a mano).
  const knownPrice = row.estimateCents === undefined && row.price?.latest.currency === currency ? row.price : undefined;
  const cheapest = knownPrice?.cheapest;
  const showCheapest = !done && cheapest?.store && cheapest.amountCents < (knownPrice?.latest.amountCents ?? 0);
  const estimateText = row.estimateCents !== undefined ? t("shopping.approx", { amount: format.money(row.estimateCents * row.quantity, currency) }) : null;

  return (
    <motion.div
      layoutId={row.id}
      layout="position"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
      transition={SPRING.snappy}
      style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, background: done ? token.colorFillQuaternary : token.colorBgContainer }}
    >
      {/* Una sola línea también en el celular: los datos se acomodan abajo del nombre, no los controles. */}
      <Flex align="center" gap={screens.sm ? 16 : 10} style={{ padding: screens.sm ? "12px 24px" : "12px 16px" }}>
        <Flex align="center" gap={screens.sm ? 16 : 12} style={{ flex: "1 1 0", minWidth: 0 }}>
          <CheckCircle
            checked={done}
            label={t(done ? "shopping.list.unmarkAria" : "shopping.list.markAria", { name: row.name })}
            onToggle={canManage ? () => (done ? unbuy(row.id) : buy(row.id)) : undefined}
          />
          <Flex vertical gap={2} style={{ minWidth: 0 }}>
            <Typography.Text strong={!done} delete={done} type={done ? "secondary" : undefined} ellipsis>
              {row.name}
            </Typography.Text>
            <Flex gap={8} align="center" wrap style={{ fontSize: token.fontSizeSM }}>
              <Typography.Text type="secondary" style={{ fontSize: "inherit" }}>
                {formatQuantity(t, row.quantity, row.unit, format.number)}
              </Typography.Text>
              {row.linked?.place && (
                <Tag variant="filled" icon={<MapPin />} style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {row.linked.place}
                </Tag>
              )}
              {!done && knownPrice && (
                <Typography.Text type="secondary" style={{ fontSize: "inherit" }}>
                  {t("shopping.approx", { amount: format.money(knownPrice.latest.amountCents * row.quantity, currency) })}
                </Typography.Text>
              )}
              {!done && !knownPrice && canManage && <EstimatePrice row={row} currency={currency} />}
              {!done && !knownPrice && !canManage && estimateText && (
                <Typography.Text type="secondary" style={{ fontSize: "inherit" }}>
                  {estimateText}
                </Typography.Text>
              )}
              {showCheapest && (
                <Typography.Text style={{ fontSize: "inherit", color: token.colorSuccessText }}>
                  {t("shopping.cheapestAt", { store: cheapest!.store, amount: format.money(cheapest!.amountCents, cheapest!.currency) })}
                </Typography.Text>
              )}
              {done && !!row.restocked && (
                <Typography.Text style={{ fontSize: "inherit", color: token.colorSuccessText }}>
                  {t("shopping.list.restocked", { amount: row.restocked })}
                </Typography.Text>
              )}
            </Flex>
          </Flex>
        </Flex>

        {canManage && (
          <Flex align="center" gap={screens.sm ? 8 : 0} style={{ flexShrink: 0 }}>
            {done ? (
              <QuickPrice row={row} currency={currency} />
            ) : (
              <>
                <QuantityStepper value={row.quantity} unit={unit(row.quantity)} min={1} onStep={(delta) => setQuantity(row.id, row.quantity + delta)} />
                <Dropdown
                  trigger={["click"]}
                  placement="bottomRight"
                  menu={{
                    items: [
                      ...(targets.length > 0
                        ? [
                            {
                              key: "move",
                              icon: <ArrowLeftRight />,
                              label: t("shopping.list.moveTo"),
                              children: targets.map((target) => ({ key: `move:${target.id}`, label: listName(target, t), onClick: () => move(row.id, target.id) })),
                            },
                          ]
                        : []),
                      { key: "remove", icon: <Trash2 />, danger: true, label: t("shopping.list.remove"), onClick: () => remove(row.id) },
                    ],
                  }}
                >
                  <Button type="text" aria-label={t("shopping.list.actionsAria", { name: row.name })} icon={<Ellipsis />} />
                </Dropdown>
              </>
            )}
          </Flex>
        )}
      </Flex>
    </motion.div>
  );
}
