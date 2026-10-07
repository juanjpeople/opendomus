"use client";

import { formatUnit } from "@/features/inventory/format";

import { Badge, Button, Card, Dropdown, Flex, Tooltip, Typography, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { BellOff, CheckCheck, ChevronDown, CircleAlert, Plus, X } from "lucide-react";
import { IconTile } from "@/components/ui";

import { useI18n } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { SPRING } from "@/lib/motion";
import { useShoppingActions, type CandidateRow } from "../hooks";

/**
 * "Para revisar": lo que se acabó o quedó bajo el mínimo. Nada entra solo a la lista:
 * alguien decide si se compra (con la cantidad que falta) o se descarta.
 */
export function ReviewPanel({ candidates }: { candidates: CandidateRow[] }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const canManage = usePermission("shopping.manage");
  const { confirm } = useShoppingActions();

  return (
    <Card
      title={
        <Flex align="center" gap={8}>
          {t("shopping.review.title")}
          <Badge count={candidates.length} color={token.colorWarning} />
        </Flex>
      }
      extra={
        canManage &&
        candidates.length > 1 && (
          <Button size="small" icon={<CheckCheck />} onClick={() => confirm(candidates.map((candidate) => candidate.id))}>
            {t("shopping.review.confirmAll")}
          </Button>
        )
      }
      styles={{ body: { paddingBlock: 8 } }}
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: token.fontSizeSM, margin: "4px 0 8px" }}>
        {t("shopping.review.hint")}
      </Typography.Paragraph>

      <AnimatePresence initial={false} mode="popLayout">
        {candidates.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={SPRING.snappy}>
            <Flex align="center" gap={12} style={{ padding: "12px 0 16px" }}>
              <IconTile icon={CheckCheck} color="green" size={40} />
              <div>
                <Typography.Text strong>{t("shopping.review.emptyTitle")}</Typography.Text>
                <br />
                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                  {t("shopping.review.emptyText")}
                </Typography.Text>
              </div>
            </Flex>
          </motion.div>
        ) : (
          candidates.map((candidate) => <CandidateItem key={candidate.id} candidate={candidate} canManage={canManage} />)
        )}
      </AnimatePresence>
    </Card>
  );
}

function CandidateItem({ candidate, canManage }: { candidate: CandidateRow; canManage: boolean }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const { confirm, dismiss } = useShoppingActions();
  const { item, place } = candidate.linked;
  const unit = (count: number) => (formatUnit(t, count, item.unit));
  const empty = candidate.reason === "empty";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      // Al confirmar sale hacia la lista (izquierda en escritorio); al descartar, se desvanece.
      exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
      transition={SPRING.snappy}
      style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}
    >
      <Flex align="center" gap={12} style={{ paddingBlock: 12 }}>
        <IconTile icon={CircleAlert} color={empty ? "red" : "orange"} size={36} />
        <Flex vertical gap={2} style={{ minWidth: 0, flex: 1 }}>
          <Typography.Text strong ellipsis>
            {item.name}
          </Typography.Text>
          <Typography.Text style={{ fontSize: token.fontSizeSM, color: empty ? token.colorErrorText : token.colorWarningText }}>
            {empty
              ? t("shopping.review.empty")
              : t("shopping.review.low", { quantity: item.quantity, min: item.minThreshold, unit: unit(item.minThreshold) })}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }} ellipsis>
            {place}
            {candidate.price &&
              ` · ${t("shopping.approx", { amount: format.money(candidate.price.latest.amountCents * candidate.suggested, candidate.price.latest.currency) })}`}
          </Typography.Text>
        </Flex>
        {canManage && (
          <Flex gap={4} align="center" style={{ flexShrink: 0 }}>
            <Tooltip title={t("shopping.review.confirmHint", { amount: candidate.suggested, unit: unit(candidate.suggested) })}>
              <Button type="primary" icon={<Plus />} onClick={() => confirm([candidate.id])}>
                {candidate.suggested}
              </Button>
            </Tooltip>
            <Dropdown
              trigger={["click"]}
              placement="bottomRight"
              menu={{
                items: [
                  { key: "later", icon: <X />, label: t("shopping.review.dismiss"), onClick: () => dismiss(candidate.id) },
                  { key: "never", icon: <BellOff />, label: t("shopping.review.never"), onClick: () => dismiss(candidate.id, true) },
                ],
              }}
            >
              <Button type="text" aria-label={t("shopping.review.dismissMenu", { name: item.name })} icon={<ChevronDown />} />
            </Dropdown>
          </Flex>
        )}
      </Flex>
    </motion.div>
  );
}
