"use client";

import { Flex, Tooltip, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { useI18n } from "@/i18n";
import { SPRING } from "@/lib/motion";

interface BudgetBarProps {
  currency: string;
  spentCents: number;
  /** Lo previsto que todavía no se pagó (estimado de lo pendiente y de lo comprado sin precio). */
  pendingCents: number;
  budgetCents?: number;
  /** Sin textos (para tarjetas chicas). */
  compact?: boolean;
}

/**
 * Presupuesto de un vistazo: lo gastado (lleno) y lo que falta (suave) sobre el presupuesto.
 * Si lo previsto pasa el presupuesto, la barra se pone roja y dice por cuánto.
 */
export function BudgetBar({ currency, spentCents, pendingCents, budgetCents, compact = false }: BudgetBarProps) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const total = spentCents + pendingCents;
  const scale = Math.max(budgetCents ?? 0, total, 1);
  const over = budgetCents !== undefined && total > budgetCents;
  const spentColor = over ? token.colorError : token.colorPrimary;
  const money = (cents: number) => format.money(cents, currency);

  return (
    <Flex vertical gap={compact ? 4 : 8} style={{ width: "100%" }}>
      <Tooltip title={`${t("shopping.budget.spent")}: ${money(spentCents)} · ${t("shopping.budget.pending")}: ${money(pendingCents)}`}>
        <div
          role="meter"
          aria-label={t("shopping.budget.title")}
          aria-valuemin={0}
          aria-valuemax={budgetCents ?? total}
          aria-valuenow={total}
          style={{ position: "relative", height: compact ? 6 : 10, borderRadius: 999, background: token.colorFillSecondary, overflow: "hidden" }}
        >
          <motion.div
            initial={false}
            animate={{ width: `${(Math.min(total, scale) / scale) * 100}%` }}
            transition={SPRING.soft}
            style={{ position: "absolute", insetBlock: 0, left: 0, background: over ? token.colorErrorBg : token.colorPrimaryBgHover, borderRadius: 999 }}
          />
          <motion.div
            initial={false}
            animate={{ width: `${(Math.min(spentCents, scale) / scale) * 100}%` }}
            transition={SPRING.soft}
            style={{ position: "absolute", insetBlock: 0, left: 0, background: spentColor, borderRadius: 999 }}
          />
          {budgetCents !== undefined && over && (
            <span style={{ position: "absolute", insetBlock: 0, left: `${(budgetCents / scale) * 100}%`, width: 2, background: token.colorText, opacity: 0.6 }} />
          )}
        </div>
      </Tooltip>
      {!compact && (
        <Flex justify="space-between" gap={8} wrap style={{ fontSize: token.fontSizeSM }}>
          <Flex gap={12} wrap>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: spentColor }} />
              <Typography.Text type="secondary" style={{ fontSize: "inherit" }}>
                {t("shopping.budget.spent")} <strong>{money(spentCents)}</strong>
              </Typography.Text>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: over ? token.colorErrorBg : token.colorPrimaryBgHover, border: `1px solid ${token.colorBorder}` }} />
              <Typography.Text type="secondary" style={{ fontSize: "inherit" }}>
                {t("shopping.budget.pending")} <strong>{money(pendingCents)}</strong>
              </Typography.Text>
            </span>
          </Flex>
          {budgetCents !== undefined ? (
            <Typography.Text strong style={{ fontSize: "inherit", color: over ? token.colorError : token.colorSuccessText }}>
              {over ? t("shopping.budget.over", { amount: money(total - budgetCents) }) : t("shopping.budget.left", { amount: money(budgetCents - total) })}
            </Typography.Text>
          ) : (
            <Typography.Text type="secondary" style={{ fontSize: "inherit" }}>
              {t("shopping.budget.none")}
            </Typography.Text>
          )}
        </Flex>
      )}
    </Flex>
  );
}
