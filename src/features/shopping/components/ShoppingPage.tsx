"use client";

import { Button, Card, Col, Flex, Grid, Popconfirm, Progress, Row, Skeleton, Tag, Tooltip, Typography, theme } from "antd";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ClipboardList, Eraser, MapPin, ShoppingBag, ShoppingBasket, Trash2, Wallet, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Can } from "@/components/auth/Can";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { AnimatedNumber, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { EmptyState, IconTile, PageHeader, QuantityStepper } from "@/components/ui";
import { isUnit } from "@/features/inventory/domain";
import { useI18n } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { SPRING } from "@/lib/motion";
import { estimateList, SHOPPING_LIMITS, type ShoppingEstimate } from "../domain";
import { useShoppingActions, useShoppingData, type ShoppingRow } from "../hooks";
import { CheckCircle } from "./CheckCircle";
import { QuickAdd } from "./QuickAdd";
import { QuickPrice } from "./QuickPrice";
import { ReviewPanel } from "./ReviewPanel";

export function ShoppingPage() {
  const { t } = useI18n();
  const data = useShoppingData();
  const canManage = usePermission("shopping.manage");
  const { clearBought } = useShoppingActions();
  const estimate = data ? estimateList(data.pending, data.prices) : null;
  const hasCandidates = (data?.candidates.length ?? 0) > 0;

  return (
    <RequirePermission perform="shopping.view">
      <PageHeader
        eyebrow={t("shopping.eyebrow")}
        title={t("shopping.title")}
        description={t("shopping.description")}
        extra={
          canManage &&
          (data?.bought.length ?? 0) > 0 && (
            <Popconfirm title={t("shopping.clearConfirm")} okText={t("shopping.clear")} cancelText={t("common.cancel")} onConfirm={clearBought}>
              <Button icon={<Eraser />}>{t("shopping.clear")}</Button>
            </Popconfirm>
          )
        }
      />

      {!data || !estimate ? (
        <Skeleton active />
      ) : (
        <>
          <Summary pending={data.pending.length} review={data.candidates.length} estimate={estimate} />
          <Row gutter={[24, 24]}>
            {/* En el celular, si hay algo para revisar va primero: es lo que pide una decisión. */}
            <Col xs={{ span: 24, order: hasCandidates ? 2 : 1 }} lg={{ span: 15, order: 1 }}>
              {canManage && (
                <Reveal delay={0.1}>
                  <QuickAdd />
                </Reveal>
              )}
              <Reveal delay={0.15}>
                <ListCard pending={data.pending} bought={data.bought} />
              </Reveal>
            </Col>
            <Col xs={{ span: 24, order: hasCandidates ? 1 : 2 }} lg={{ span: 9, order: 2 }}>
              <Reveal delay={0.2} style={{ position: "sticky", top: 88 }}>
                <ReviewPanel candidates={data.candidates} />
              </Reveal>
            </Col>
          </Row>
        </>
      )}
    </RequirePermission>
  );
}

// --- Resumen --------------------------------------------------------------------

function Summary({ pending, review, estimate }: { pending: number; review: number; estimate: ShoppingEstimate }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const [main, ...others] = estimate.totals;

  return (
    <Stagger delay={0.05}>
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col xs={12} md={8}>
          <SummaryTile icon={ShoppingBasket} label={t("shopping.summary.pending")}>
            <AnimatedNumber value={pending} />
          </SummaryTile>
        </Col>
        <Col xs={12} md={8}>
          <SummaryTile icon={ClipboardList} label={t("shopping.summary.review")} tone={review > 0 ? token.colorWarning : undefined}>
            <AnimatedNumber value={review} />
          </SummaryTile>
        </Col>
        <Col xs={24} md={8}>
          <SummaryTile
            icon={Wallet}
            label={t("shopping.summary.estimate")}
            hint={estimate.count > 0 ? t("shopping.summary.priced", { priced: estimate.priced, count: estimate.count }) : undefined}
          >
            {main ? format.money(main.cents, main.currency) : "—"}
            {others.length > 0 && (
              <Typography.Text type="secondary" style={{ fontSize: token.fontSize, fontWeight: 400, marginInlineStart: 8 }}>
                + {others.map((total) => format.money(total.cents, total.currency)).join(" + ")}
              </Typography.Text>
            )}
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

// --- Lista ----------------------------------------------------------------------

function ListCard({ pending, bought }: { pending: ShoppingRow[]; bought: ShoppingRow[] }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const total = pending.length + bought.length;
  const days = SHOPPING_LIMITS.boughtVisibleMs / 86_400_000;

  return (
    <Card
      title={t("shopping.list.title")}
      extra={
        total > 0 && (
          <Tooltip title={t("shopping.list.progressHint", { days })}>
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
      {total === 0 && <EmptyState icon={ShoppingBasket} title={t("shopping.list.emptyTitle")} description={t("shopping.list.emptyText")} />}

      {/* LayoutGroup: al marcar, la fila viaja de "Por comprar" a "En la bolsa" en vez de saltar. */}
      <LayoutGroup>
        <AnimatePresence initial={false}>
          {pending.map((row) => (
            <RowItem key={row.id} row={row} />
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
            <RowItem key={row.id} row={row} />
          ))}
        </AnimatePresence>
      </LayoutGroup>
    </Card>
  );
}

function RowItem({ row }: { row: ShoppingRow }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const canManage = usePermission("shopping.manage");
  const { buy, unbuy, setQuantity, remove } = useShoppingActions();
  const done = row.status === "bought";
  const unit = (count: number) => (isUnit(row.unit) ? t(`inventory.units.${row.unit}`, { count }) : row.unit);
  const cheapest = row.price?.cheapest;
  const showCheapest = !done && cheapest?.store && cheapest.amountCents < (row.price?.latest.amountCents ?? 0);

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
                {row.quantity} {unit(row.quantity)}
              </Typography.Text>
              {row.linked?.place && (
                <Tag variant="filled" icon={<MapPin />} style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {row.linked.place}
                </Tag>
              )}
              {!done && row.price && (
                <Typography.Text type="secondary" style={{ fontSize: "inherit" }}>
                  {t("shopping.approx", { amount: format.money(row.price.latest.amountCents * row.quantity, row.price.latest.currency) })}
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
              row.inventoryItemId && (
                <Can perform="prices.manage">
                  <QuickPrice itemId={row.inventoryItemId} unit={row.unit} price={row.price} />
                </Can>
              )
            ) : (
              <>
                <QuantityStepper value={row.quantity} unit={unit(row.quantity)} min={1} onStep={(delta) => setQuantity(row.id, row.quantity + delta)} />
                <Button type="text" danger aria-label={t("shopping.list.removeAria", { name: row.name })} icon={<Trash2 />} onClick={() => remove(row.id)} />
              </>
            )}
          </Flex>
        )}
      </Flex>
    </motion.div>
  );
}
