"use client";

import { Button, Flex, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { Archive, Plus } from "lucide-react";
import { useState } from "react";
import { IconTile } from "@/components/ui";
import { useI18n } from "@/i18n";
import { APPEARANCE_ICONS, tint } from "@/lib/appearance";
import { SPRING } from "@/lib/motion";
import { listName, type ListSummary } from "../hooks";
import { BudgetBar } from "./BudgetBar";

interface ListSwitcherProps {
  lists: ListSummary[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate?: () => void;
}

/** Listas como tarjetas que se deslizan: cuánto falta y, si tienen presupuesto, cómo vienen. */
export function ListSwitcher({ lists, selectedId, onSelect, onCreate }: ListSwitcherProps) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const [showArchived, setShowArchived] = useState(false);
  const archived = lists.filter((summary) => summary.list.archivedAt);
  const visible = lists.filter((summary) => !summary.list.archivedAt || showArchived || summary.list.id === selectedId);

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        role="tablist"
        aria-label={t("shopping.lists.title")}
        style={{ display: "flex", gap: 10, overflowX: "auto", padding: "4px 2px 10px", scrollSnapType: "x proximity" }}
      >
        {visible.map((summary) => (
          <ListTab key={summary.list.id} summary={summary} selected={summary.list.id === selectedId} onSelect={() => onSelect(summary.list.id)} />
        ))}
        {onCreate && (
          <motion.button
            type="button"
            onClick={onCreate}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING.snappy}
            style={{
              flex: "0 0 auto",
              minWidth: 140,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "12px 16px",
              borderRadius: token.borderRadiusLG,
              border: `1.5px dashed ${token.colorBorder}`,
              background: "transparent",
              color: token.colorTextSecondary,
              cursor: "pointer",
              font: "inherit",
            }}
          >
            <Plus /> {t("shopping.lists.new")}
          </motion.button>
        )}
      </div>
      {archived.length > 0 && (
        <Button type="link" size="small" icon={<Archive />} style={{ paddingInline: 0 }} onClick={() => setShowArchived((value) => !value)}>
          {showArchived ? t("shopping.lists.hideArchived") : t("shopping.lists.showArchived", { count: archived.length })}
        </Button>
      )}
    </div>
  );
}

function ListTab({ summary, selected, onSelect }: { summary: ListSummary; selected: boolean; onSelect: () => void }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const { list, project, budget, pending } = summary;
  const palette = tint(token, list.color);

  return (
    <motion.button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={SPRING.snappy}
      style={{
        flex: "0 0 auto",
        width: 220,
        scrollSnapAlign: "start",
        textAlign: "start",
        padding: 12,
        borderRadius: token.borderRadiusLG,
        border: `1.5px solid ${selected ? palette.solid : token.colorBorderSecondary}`,
        background: selected ? palette.bg : token.colorBgContainer,
        boxShadow: selected ? `0 0 0 3px ${palette.bg}` : undefined,
        cursor: "pointer",
        font: "inherit",
        color: token.colorText,
        opacity: list.archivedAt ? 0.6 : 1,
      }}
    >
      <Flex align="center" gap={10}>
        <IconTile icon={APPEARANCE_ICONS[list.icon]} color={list.color} size={36} solid={selected} />
        <Flex vertical style={{ minWidth: 0, flex: 1 }}>
          <Typography.Text strong ellipsis>
            {listName(list, t)}
          </Typography.Text>
          <Typography.Text type="secondary" ellipsis style={{ fontSize: token.fontSizeSM }}>
            {project ? project.name : t("shopping.lists.pendingCount", { count: pending })}
          </Typography.Text>
        </Flex>
      </Flex>
      {budget.budgetCents !== undefined && (
        <div style={{ marginTop: 10 }}>
          <BudgetBar compact currency={budget.currency} spentCents={budget.spentCents} pendingCents={budget.pendingCents + budget.boughtEstimateCents} budgetCents={budget.budgetCents} />
        </div>
      )}
    </motion.button>
  );
}
